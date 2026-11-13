import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGoalTurn} from '../../../gate02/normalize-turn.mjs';
import {validateGoalProposal} from '../../../gate02/goal-proposal.mjs';
import {makeClarificationEvents,previewClarificationAnswer} from '../tace-clarification-events.mjs';
import {INITIAL_STATE,SOURCE_OPTIONS,ACTION_OPTIONS,OUTCOME_OPTIONS,questionFor,wizardReady,buildUnverifiedGoalProposal} from './goal-wizard-state.mjs';

const ctx={actor:{subject:'synthetic-user',tenant:'synthetic-org'},goalId:'synthetic-goal',turnId:'synthetic-turn',revision:1,defaultLocale:'en-ZA',timeZone:'Africa/Johannesburg'};
const intake=normalizeGoalTurn({goal:'Analyze training results and prepare an improvement plan'},ctx).record;
const state=(outcome='all',source='upload',action='draft')=>({...INITIAL_STATE,outcome,source,action});
const checked=x=>validateGoalProposal(buildUnverifiedGoalProposal(x),intake);
test('W01 starts with all three chosen and source unanswered',()=>{assert.equal(INITIAL_STATE.outcome,'all');assert.equal(wizardReady(INITIAL_STATE),false);});
test('W02 exact three questions with stable IDs',()=>assert.deepEqual([1,2,3].map(n=>questionFor(n).id),['outcome_q','source_q','action_q']));
test('W03 each question is eligible for AG-UI clarification interruption',()=>{
  for(let n=1;n<=3;n++){
    const e=makeClarificationEvents({threadId:'thread',runId:'run'+n,goalId:'synthetic-goal',turnId:'synthetic-turn',revision:1},questionFor(n));
    assert.equal(e.status,'UI_EVENTS_READY');assert.equal(e.events[2].outcome.type,'interrupt');
  }
});
test('W04 missing source or action never reaches proposal generator',()=>{assert.throws(()=>buildUnverifiedGoalProposal({...INITIAL_STATE,source:'upload'}));});
test('W05 all three choices produce three deliverables',()=>{const p=buildUnverifiedGoalProposal(state());assert.deepEqual(p.deliverables.map(d=>d.id),['gap_analysis','performance_report','improvement_plan']);});
test('W06 selected source remains unbound and requires verified input',()=>{const p=buildUnverifiedGoalProposal(state());assert.deepEqual(p.sourceSlots,[]);assert.equal(p.uncertainties[0].blocking,true);});
test('W07 no actual executed effect or permission is claimed',()=>{const p=buildUnverifiedGoalProposal(state());assert.equal(Object.hasOwn(p,'approved'),false);assert.equal(Object.hasOwn(p,'executed'),false);});
test('W08 all three plus draft passes deterministic proposal shape, needs input',()=>{const r=checked(state());assert.equal(r.status,'NEEDS_CLARIFICATION');assert.equal(r.policyAuthority,'NONE');});
test('W09 all three plus connected action still does not authorize a send',()=>{const r=checked(state('all','lms','connected'));assert.equal(r.status,'NEEDS_CLARIFICATION');assert.equal(r.policyAuthority,'NONE');assert.equal(r.proposal.effectClaims.some(e=>e.kind==='EXTERNAL_SEND'),true);});
test('W10 all outcome types yield structurally accepted proposals for 3 action modes',()=>{
  for(const o of OUTCOME_OPTIONS)for(const a of ACTION_OPTIONS){
    const r=checked(state(o.id,'upload',a.id));assert.notEqual(r.status,'REJECTED_PROPOSAL',o.id+' '+a.id+' '+r.code);
  }
});
test('W11 unavailable data never manufactures actual read source handles',()=>{const p=buildUnverifiedGoalProposal(state('all','none'));assert.equal(p.sourceSlots.length,0);assert.equal(p.uncertainties[0].question.includes('supply data'),true);});
test('W12 Other source requires a bounded meaningful description',()=>{assert.equal(wizardReady({...state(),source:'other'}),false);assert.equal(wizardReady({...state(),source:'other',otherSource:'x'.repeat(141)}),false);assert.equal(wizardReady({...state(),source:'other',otherSource:'Paper files'}),true);});
test('W13 Other source is preserved as an unresolved requirement, not an installed tool',()=>{const p=buildUnverifiedGoalProposal({...state(),source:'other',otherSource:'Paper attendance books'});assert.equal(p.uncertainties[0].question.includes('Paper attendance books'),true);});
test('W14 no HTML/script execution is performed by proposal state builder',()=>{const p=buildUnverifiedGoalProposal({...state(),source:'other',otherSource:'<img src=x onerror=alert(1)>'});assert.equal(p.uncertainties[0].question.includes('<img'),true);assert.equal(Object.hasOwn(p,'script'),false);});
test('W15 preview answer checks option and cannot create real turn',()=>{const q=questionFor(2),c={threadId:'thread',runId:'run',goalId:'synthetic-goal',turnId:'synthetic-turn',revision:1};const a=previewClarificationAnswer(c,q,{goalId:'synthetic-goal',turnId:'synthetic-turn',revision:1,questionId:q.id,optionId:'upload',otherText:null});assert.equal(a.status,'ANSWER_PREVIEW_ONLY');assert.equal(Object.hasOwn(a,'newTurnId'),false);});
test('W16 no option silently means permission to write',()=>{for(const a of ACTION_OPTIONS){const r=checked(state('all','upload',a.id));assert.equal(r.policyAuthority,'NONE');assert.equal(r.verificationStatus,'NOT_RUN');}});
test('W17 G02.02 acceptance criteria contain explicit expected evidence',()=>{const p=buildUnverifiedGoalProposal(state());assert.equal(p.acceptanceCriteria.every(c=>c.evidenceExpectation.length>0),true);});
test('W18 question options include alternative to connected data',()=>assert.equal(SOURCE_OPTIONS.some(o=>o.id==='none'),true));
