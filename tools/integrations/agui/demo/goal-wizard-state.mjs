/**
 * Local synthetic UI demonstration only. Goal proposals are model-unverified,
 * and user selections never grant policy authority, source access or execution.
 * Uses the same G02.02 v0.2 structure as the tested deterministic engine.
 */
export const SOURCE_OPTIONS=Object.freeze([
  {id:'upload',label:'Upload assessment results (CSV/Excel)'},
  {id:'lms',label:'Use a connected LMS'},
  {id:'both',label:'Uploaded results and LMS'},
  {id:'none',label:'No results yet: create a template'},
  {id:'other',label:'Another source'}
]);
export const ACTION_OPTIONS=Object.freeze([
  {id:'draft',label:'Draft reports and a proposed schedule only'},
  {id:'review',label:'Prepare drafts and messages for my review'},
  {id:'connected',label:'Propose connected updates and notifications (separate approvals)'}
]);
export const OUTCOME_OPTIONS=Object.freeze([
  {id:'gaps',label:'Identify learning gaps'},
  {id:'reports',label:'Generate performance reports'},
  {id:'improvement',label:'Create an improvement plan'},
  {id:'all',label:'All three'}
]);
export const INITIAL_STATE=Object.freeze({outcome:'all',source:null,action:null,otherSource:''});
export function questionFor(step) {
  const options=step===1?OUTCOME_OPTIONS:step===2?SOURCE_OPTIONS:step===3?ACTION_OPTIONS:null;
  if(!options)throw Error('Unknown wizard question');
  return {
    id:step===1?'outcome_q':step===2?'source_q':'action_q',
    revision:1,
    prompt:step===1?'What outcome matters most?':step===2?
      'Where should T.A.C.E get the training results?':'How far should T.A.C.E take the work?',
    reason:step===1?'Choose intended outputs':step===2?
      'Determine evidence and source-authorization needs':'Separate drafts from possible shared writes or sends',
    options:options.map(x=>({...x})),optional:false
  };
}
export function wizardReady(state){
  return OUTCOME_OPTIONS.some(x=>x.id===state?.outcome) &&
    SOURCE_OPTIONS.some(x=>x.id===state?.source) &&
    ACTION_OPTIONS.some(x=>x.id===state?.action) &&
    (state.source!=='other'||typeof state.otherSource==='string'&&
      state.otherSource.trim().length>0&&state.otherSource.length<=600);
}
const d=(id,description,formatHint)=>({id,description,formatHint});
const s=(id,outcome,dependsOn,deliverableIds,capabilityKinds,effectKinds)=>({
  id,outcome,dependsOn,deliverableIds,sourceSlots:[],capabilityKinds,effectKinds
});
const crit=(id,deliverableId,check,method,evidenceExpectation)=>({
  id,deliverableId,check,method,evidenceExpectation
});
export function buildUnverifiedGoalProposal(state){
  if(!wizardReady(state))throw Error('All three alignment answers are required');
  const gaps=state.outcome==='gaps'||state.outcome==='all';
  const reports=state.outcome==='reports'||state.outcome==='all';
  const improvement=state.outcome==='improvement'||state.outcome==='all';
  const deliverables=[],subgoals=[],capabilityNeeds=[],effectClaims=[],acceptanceCriteria=[];
  const addCapability=(kind,reason)=>{if(!capabilityNeeds.some(x=>x.kind===kind))capabilityNeeds.push({kind,reason});};
  const addEffect=(kind,description)=>{if(!effectClaims.some(x=>x.kind===kind))effectClaims.push({kind,description});};
  addCapability('READ_SOURCE','Analysis needs admitted assessment results');
  addEffect('READ_ONLY','Source reading is proposed, not performed');
  if(gaps){
    deliverables.push(d('gap_analysis','Identify learning gaps using admitted results','report'));
    acceptanceCriteria.push(crit('check_gaps','gap_analysis','Cross-check each finding against admitted results','SOURCE_CROSSCHECK','Evidence references and checked totals'));
  }
  subgoals.push(s('analyze','Analyze training results if sources become authorized',[],gaps?['gap_analysis']:[],['READ_SOURCE'],['READ_ONLY']));
  if(reports||improvement){
    addCapability('WRITE_ARTIFACT','Create local draft artifacts');addEffect('LOCAL_ARTIFACT','Create local drafts only');
  }
  if(reports){
    deliverables.push(d('performance_report','Training performance report','xlsx'));
    subgoals.push(s('report','Create a draft performance report',['analyze'],['performance_report'],['WRITE_ARTIFACT'],['LOCAL_ARTIFACT']));
    acceptanceCriteria.push(crit('check_report','performance_report','Reopen report and check formulas','ARTIFACT_REOPEN','Reopened file with verified calculations'));
  }
  if(improvement){
    deliverables.push(d('improvement_plan','Propose interventions and a conflict-free schedule','document'));
    addCapability('SCHEDULING','Propose scheduled training sessions');
    subgoals.push(s('improvement','Prepare an improvement and proposed scheduling plan',['analyze'],['improvement_plan'],['WRITE_ARTIFACT','SCHEDULING'],['LOCAL_ARTIFACT']));
    acceptanceCriteria.push(crit('check_plan','improvement_plan','Review interventions and detect scheduling conflicts','SCHEDULE_CONFLICT_CHECK','Suggested sessions with evidence of conflict review'));
  }
  if(state.action==='connected'){
    addCapability('CONNECTOR_WRITE','Potential future shared updates; do not execute');
    addCapability('MESSAGE_SEND','Potential future notifications; do not execute');
    addEffect('SHARED_WRITE','Proposed shared-system update requires real policy approval');
    addEffect('EXTERNAL_SEND','Proposed notification requires recipient and exact approval');
    const target=improvement?'improvement_plan':reports?'performance_report':'gap_analysis';
    const parent=improvement?'improvement':reports?'report':'analyze';
    subgoals.push(s('propose_updates','Propose but do not perform shared updates and notifications',
      [parent],[target],['CONNECTOR_WRITE','MESSAGE_SEND'],['SHARED_WRITE','EXTERNAL_SEND']));
  }
  const uncertainties=[{
    code:'MISSING_INPUT',
    question:state.source==='none'?'Please supply data before factual analysis':
      state.source==='other'?'Please verify access to the other source before analysis':
      'Please upload or authorize the selected training data before analysis',
    blocking:true
  }];
  if(state.action==='connected')uncertainties.push({
    code:'MISSING_RECIPIENT',question:'Which connected destinations and recipients are authorized?',blocking:true
  });
  return {
    schemaVersion:'g02-goal-proposal-v0.2',
    intent:{summary:'Analyse training results and prepare the selected outcomes',modes:[
      'ANALYZE',...(reports||improvement?['CREATE']:[]),...(improvement?['COORDINATE']:[])
    ]},
    relationToPrior:'NEW_GOAL',
    deliverables,subgoals,sourceSlots:[],capabilityNeeds,effectClaims,
    acceptanceCriteria,uncertainties
  };
}
