import {
  INITIAL_STATE,OUTCOME_OPTIONS,SOURCE_OPTIONS,ACTION_OPTIONS,
  questionFor,wizardReady,buildUnverifiedGoalProposal
} from './goal-wizard-state.mjs';
import {makeClarificationEvents,previewClarificationAnswer} from '../tace-clarification-events.mjs';

/* UI-only simulation. The server must independently authenticate answer revision
   and authorize tool effects before any actual execution (G07/G11). */
let state={...INITIAL_STATE};
let step=2; // The user already answered "All three" in the original request.
let preview=null;

const $=id=>document.getElementById(id);
const ctx=n=>({threadId:'synthetic-thread',runId:'synthetic-run-'+n,
  goalId:'synthetic-goal',turnId:'synthetic-turn',revision:1});
const valueForStep=n=>n===1?state.outcome:n===2?state.source:state.action;
const optionsForStep=n=>n===1?OUTCOME_OPTIONS:n===2?SOURCE_OPTIONS:ACTION_OPTIONS;

function setError(message){
  $('inline-error').textContent=message||'';
  $('inline-error').classList.toggle('hidden',!message);
}
function updateNext(){
  const valid=step===1?!!state.outcome:step===2?
    !!state.source&&(state.source!=='other'||state.otherSource.trim().length>0):!!state.action;
  $('next-btn').disabled=!valid;
}
function renderChoices(){
  const group=$('choices');
  group.replaceChildren();
  for(const option of optionsForStep(step)){
    const label=document.createElement('label');
    label.className='choice';
    const input=document.createElement('input');
    input.type='radio';
    input.name='guided-choice';
    input.value=option.id;
    input.checked=valueForStep(step)===option.id;
    const text=document.createElement('span');
    text.textContent=option.label; // Never interpolate user-supplied HTML.
    label.append(input,text);
    input.addEventListener('change',()=>{
      if(step===1)state.outcome=option.id;
      else if(step===2)state.source=option.id;
      else state.action=option.id;
      $('other-container').classList.toggle('hidden',!(step===2&&state.source==='other'));
      updateNext();
      renderEventPreview();
    });
    group.appendChild(label);
  }
  $('other-container').classList.toggle('hidden',!(step===2&&state.source==='other'));
  $('other-text').value=state.otherSource;
}
function renderReview(){
  const labels=[
    ['Outcomes',OUTCOME_OPTIONS.find(o=>o.id===state.outcome)?.label||'Unselected'],
    ['Training data',SOURCE_OPTIONS.find(o=>o.id===state.source)?.label||'Unselected'],
    ['Requested action',ACTION_OPTIONS.find(o=>o.id===state.action)?.label||'Unselected']
  ];
  if(state.source==='other')labels.push(['Other source',state.otherSource]);
  const list=$('answers-list');
  list.replaceChildren();
  for(const [term,description] of labels){
    const dt=document.createElement('dt');
    dt.textContent=term;
    const dd=document.createElement('dd');
    dd.textContent=description;
    list.append(dt,dd);
  }
}
function renderEventPreview(){
  if(step>3){
    $('event-preview').textContent='Three local selection previews completed. No server revision was created; AG-UI would resume through a separately authenticated request.';
    return;
  }
  const candidate=makeClarificationEvents(ctx(step),questionFor(step));
  if(candidate.status!=='UI_EVENTS_READY'){
    $('event-preview').textContent='Rejected event: '+candidate.code;
    return;
  }
  const types=candidate.events.map(e=>e.type);
  const interrupt=candidate.events[2].outcome.interrupts[0];
  $('event-preview').textContent=types.join(' → ')+' · interrupt ID: '+interrupt.id+
    ' · policy authority: '+candidate.policyAuthority+' · no tool calls';
}
function renderContract(){
  if(!wizardReady(state)){
    preview=null;
    $('contract-preview').textContent='Answer the remaining questions to see the candidate GoalContract.';
    $('copy-btn').disabled=true;
    return;
  }
  try{
    preview=buildUnverifiedGoalProposal(state);
    $('contract-preview').textContent=JSON.stringify(preview,null,2);
    $('copy-btn').disabled=false;
  }catch(error){
    preview=null;
    $('contract-preview').textContent='Proposal cannot be generated: '+error.message;
    $('copy-btn').disabled=true;
  }
}
function render(){
  setError('');
  const review=step===4;
  $('question-screen').classList.toggle('hidden',review);
  $('review-screen').classList.toggle('hidden',!review);
  $('question-label').textContent=review?'ALIGNMENT COMPLETE':'QUESTION '+step+' OF 3';
  $('progress-caption').textContent=review?'Ready for a proposed contract':'Clarification · step '+step;
  $('progress-fill').style.width=(review?100:step/3*100)+'%';
  $('progress-track').setAttribute('aria-valuenow',String(review?3:step));
  $('back-btn').disabled=step===1;
  $('next-btn').textContent=review?'Start over':step===3?'Review goal proposal →':'Continue →';
  $('next-btn').disabled=false;
  if(review){
    renderReview();
  }else{
    const q=questionFor(step);
    $('question-reason').textContent=q.reason;
    $('question-title').textContent=q.prompt;
    renderChoices();
    updateNext();
  }
  renderEventPreview();
  renderContract();
}
$('other-text').addEventListener('input',event=>{
  state.otherSource=event.target.value;
  updateNext();renderContract();
});
$('back-btn').addEventListener('click',()=>{
  if(step>1)step--;
  render();
  if(step<=3)$('question-title').focus();
});
$('next-btn').addEventListener('click',()=>{
  if(step===4){state={...INITIAL_STATE};step=2;render();return;}
  const q=questionFor(step);
  const answer={
    goalId:'synthetic-goal',turnId:'synthetic-turn',revision:1,
    questionId:q.id,optionId:valueForStep(step),
    otherText:step===2&&state.source==='other'?state.otherSource:null
  };
  const verdict=previewClarificationAnswer(ctx(step),q,answer);
  if(verdict.status!=='ANSWER_PREVIEW_ONLY'){
    setError('Cannot accept the selected option: '+verdict.code);return;
  }
  step++;render();
  if(step<=3)$('question-title').focus();
});
$('copy-btn').addEventListener('click',async()=>{
  if(!preview)return;
  try{
    if(!navigator.clipboard?.writeText)throw new Error('Clipboard access unavailable');
    await navigator.clipboard.writeText(JSON.stringify(preview,null,2));
    $('copy-btn').textContent='Copied preview';
  }catch{
    setError('Clipboard unavailable. Select the JSON text above to copy it manually.');
  }
});
render();
