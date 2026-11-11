/**
 * G02.04/G10 evaluation lane: T.A.C.E clarification UI -> AG-UI-shaped events.
 * NO model, CopilotKit runtime, connected OpenDots, persistence or approvals.
 * AG-UI 1.0 event fields based on ag-ui-protocol/ag-ui spec/1.0/schema.json.
 * CUSTOM events are T.A.C.E extensions, not standard event semantics.
 */
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const plain=x=>x!==null && typeof x==='object' && !Array.isArray(x) &&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const exact=(x,fields)=>plain(x)&&Reflect.ownKeys(x).length===fields.length &&
  fields.every(k=>own(x,k)) &&
  Reflect.ownKeys(x).every(k=>typeof k==='string'&&own(Object.getOwnPropertyDescriptors(x)[k],'value'));
const validId=s=>typeof s==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(s);
const cleanText=(s,max)=>typeof s==='string'&&s.length>0&&s.length<=max&&s.trim().length>0&&
  !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u.test(s);
const fail=code=>Object.freeze({status:'REJECTED_UI_EVENT',code});
const uniq=a=>new Set(a).size===a.length;
function validateQuestion(q){
  if(!exact(q,['id','revision','prompt','reason','options','optional']) ||
     !validId(q.id)||!Number.isSafeInteger(q.revision)||q.revision<1||
     !cleanText(q.prompt,360)||!cleanText(q.reason,360)||
     typeof q.optional!=='boolean'||!Array.isArray(q.options)||
     q.options.length<2||q.options.length>6)return false;
  const descriptions=Object.getOwnPropertyDescriptors(q.options);
  if(Reflect.ownKeys(descriptions).length!==q.options.length+1)return false;
  for(let i=0;i<q.options.length;i++){
    const d=descriptions[String(i)];
    if(!d||!own(d,'value'))return false;
    const o=d.value;
    if(!exact(o,['id','label'])||!validId(o.id)||!cleanText(o.label,160))return false;
  }
  return uniq(q.options.map(x=>x.id));
}
function validateContext(c){
  return exact(c,['threadId','runId','goalId','turnId','revision']) &&
    validId(c.threadId)&&validId(c.runId)&&validId(c.goalId)&&validId(c.turnId)&&
    Number.isSafeInteger(c.revision)&&c.revision>0;
}
/**
 * Convert one *server-supplied* pending clarification into a UI-only event stream.
 * UI approval cards and choice buttons cannot authorize actual tool effects.
 */
export function makeClarificationEvents(context,question){
  try {
    if(!validateContext(context))return fail('INVALID_UI_CONTEXT');
    if(!validateQuestion(question))return fail('INVALID_QUESTION');
    if(question.revision!==context.revision)return fail('STALE_QUESTION_REVISION');
    const choiceOptions=Object.freeze(question.options.map(o=>Object.freeze({id:o.id,label:o.label})));
    const value=Object.freeze({
      eventVersion:'tace-ui-clarification-v0.1',
      status:'CLARIFICATION_REQUIRED',
      goalId:context.goalId,turnId:context.turnId,revision:context.revision,
      question:Object.freeze({id:question.id,prompt:question.prompt,reason:question.reason,
        options:choiceOptions,optional:question.optional}),
      policyAuthority:'NONE',requiresServerValidation:true
    });
    const events=Object.freeze([
      Object.freeze({type:'RUN_STARTED',threadId:context.threadId,runId:context.runId,protocolVersion:'1.0'}),
      Object.freeze({type:'CUSTOM',name:'tace.clarification.requested.v1',value}),
      Object.freeze({type:'RUN_FINISHED',threadId:context.threadId,runId:context.runId,
        outcome:Object.freeze({type:'interrupt',interrupts:Object.freeze([])})})
    ]);
    return Object.freeze({status:'UI_EVENTS_READY',events,policyAuthority:'NONE',serverEffect:'NOT_EXECUTED'});
  }catch{return fail('INVALID_UI_INPUT');}
}
/**
 * Validates the shape of a candidate answer for a given question *in memory*.
 * Actual authenticated revision, persisted consent and replay fences are G07.
 */
export function previewClarificationAnswer(context,question,answer){
  try {
    if(!validateContext(context)||!validateQuestion(question)||
       !exact(answer,['goalId','turnId','revision','questionId','optionId','otherText']))
      return fail('INVALID_ANSWER');
    if(question.revision!==context.revision || answer.goalId!==context.goalId ||
       answer.turnId!==context.turnId || answer.revision!==context.revision ||
       answer.questionId!==question.id)return fail('STALE_OR_CROSS_GOAL_ANSWER');
    const option=question.options.find(o=>o.id===answer.optionId);
    if(!option)return fail('UNKNOWN_CHOICE');
    if(option.id==='other'){
      if(!cleanText(answer.otherText,600))return fail('MISSING_OTHER_TEXT');
    } else if(answer.otherText!==null)return fail('UNEXPECTED_OTHER_TEXT');
    return Object.freeze({
      status:'ANSWER_PREVIEW_ONLY',questionId:question.id,optionId:option.id,
      selectedLabel:option.label,otherText:option.id==='other'?answer.otherText:null,
      goalId:context.goalId,turnId:context.turnId,revision:context.revision,
      proposalRecompilationRequired:true,approvalRecheckRequired:true,
      policyAuthority:'NONE',serverEffect:'NOT_EXECUTED'
    });
  }catch{return fail('INVALID_ANSWER');}
}
