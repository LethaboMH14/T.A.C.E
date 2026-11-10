import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeGoalTurn} from './normalize-turn.mjs';
import {validateGoalProposal,assessGoalProposalRevision} from './goal-proposal.mjs';

const trusted={actor:{subject:'teacher-demo',tenant:'synthetic-school'},goalId:'goal-1',turnId:'t1',revision:1,defaultLocale:'en-ZA',timeZone:'Africa/Johannesburg'};
const intake=(sources=[],ctx=trusted)=>normalizeGoalTurn({goal:'Create a study template',sources},ctx).record;
const sourceRefs=[{kind:'upload',ref:'source-1'},{kind:'connector',ref:'source-2'}];
const simple=()=>({
  schemaVersion:'g02-goal-proposal-v0.1',
  intent:{summary:'Create a study-plan template',modes:['CREATE']},
  relationToPrior:'NEW_GOAL',
  deliverables:[{id:'template',description:'Editable study-plan template',formatHint:'xlsx'}],
  subgoals:[{id:'draft',outcome:'Produce the template',dependsOn:[],deliverableIds:['template']}],
  sourceSlots:[],
  capabilityNeeds:[{kind:'WRITE_ARTIFACT',reason:'Create a local file'}],
  effectClaims:[{kind:'LOCAL_ARTIFACT',description:'Create a local template only'}],
  acceptanceCriteria:[{id:'reopen',deliverableId:'template',check:'Reopen saved template',method:'ARTIFACT_REOPEN'}],
  uncertainties:[]
});
const mixed=()=>{
  const p=simple();
  p.intent={summary:'Analyze synthetic data and produce support drafts',modes:['ANALYZE','CREATE','COORDINATE']};
  p.deliverables.push({id:'report',description:'Gap analysis report',formatHint:'csv'});
  p.subgoals=[{id:'analysis',outcome:'Analyze source slots',dependsOn:[],deliverableIds:['report']},
    {id:'draft',outcome:'Draft support plan',dependsOn:['analysis'],deliverableIds:['template']}];
  p.acceptanceCriteria.push({id:'crosscheck',deliverableId:'report',check:'Check evidence',method:'SOURCE_CROSSCHECK'});
  p.sourceSlots=[0,1];
  p.capabilityNeeds.push({kind:'READ_SOURCE',reason:'Read authorized source data'});
  return p;
};
const run=(p=simple(),i=intake())=>validateGoalProposal(p,i);
const mutate=fn=>{const p=simple();fn(p);return run(p);};
const reject=(r,code)=>{assert.equal(r.status,'REJECTED_PROPOSAL');assert.equal(r.code,code);};
const secondIntake=(overrides={})=>intake([],{...trusted,turnId:'t2',parentTurnId:'t1',revision:2,...overrides});
const second=()=>{const p=simple();p.relationToPrior='CORRECTION';return p;};
const validatedPair=()=>{const a=intake(),b=secondIntake();return {a,b,p:run(simple(),a),q:run(second(),b)};};

test('P01 simple local artifact proposal structurally valid, not approved',()=>{const r=run();assert.equal(r.status,'PROPOSAL_VALID');assert.equal(r.code,'STRUCTURALLY_VALID');assert.equal(r.policyAuthority,'NONE');});
test('P02 one subgoal candidate order is deterministic',()=>assert.deepEqual(run().candidateOrder,['draft']));
test('P03 mixed-domain outcome DAG accepted with source slots',()=>{const r=run(mixed(),intake(sourceRefs));assert.equal(r.status,'PROPOSAL_VALID');assert.deepEqual(r.candidateOrder,['analysis','draft']);});
test('P04 model never supplies trusted goal or actor binding',()=>{const r=run();assert.deepEqual(r.binding,{goalId:'goal-1',turnId:'t1',revision:1});assert.equal(Object.hasOwn(r.proposal,'actor'),false);});
test('P05 source slot does not expose real source handle in proposal',()=>{const r=run(mixed(),intake(sourceRefs));assert.deepEqual(r.proposal.sourceSlots,[0,1]);assert.equal(JSON.stringify(r.proposal).includes('source-1'),false);});
test('P06 source slot without intake source is rejected',()=>{const p=simple();p.sourceSlots=[0];reject(run(p),'UNBOUND_SOURCE_SLOT');});
test('P07 source slots cannot duplicate',()=>{const p=mixed();p.sourceSlots=[0,0];reject(run(p,intake(sourceRefs)),'INVALID_SOURCE_SLOTS');});
test('P08 negative source slot is invalid',()=>{const p=simple();p.sourceSlots=[-1];reject(run(p),'INVALID_SOURCE_SLOTS');});
test('P09 fractional source slot is invalid',()=>{const p=simple();p.sourceSlots=[0.5];reject(run(p),'INVALID_SOURCE_SLOTS');});
test('P10 source slot above global max invalid',()=>{const p=simple();p.sourceSlots=[24];reject(run(p),'INVALID_SOURCE_SLOTS');});
test('P11 model-supplied approval field rejected',()=>reject(mutate(p=>p.approved=true),'INVALID_PROPOSAL_SHAPE'));
test('P12 model-supplied tenant field rejected',()=>reject(mutate(p=>p.tenant='other'),'INVALID_PROPOSAL_SHAPE'));
test('P13 model-supplied toolResult field rejected',()=>reject(mutate(p=>p.toolResult='done'),'INVALID_PROPOSAL_SHAPE'));
test('P14 model-supplied source handle field rejected',()=>reject(mutate(p=>p.sourceRef='source-1'),'INVALID_PROPOSAL_SHAPE'));
test('P15 missing required top-level field rejected',()=>reject(mutate(p=>delete p.subgoals),'INVALID_PROPOSAL_SHAPE'));
test('P16 unknown nested field rejected',()=>reject(mutate(p=>p.intent.role='admin'),'INVALID_INTENT'));
test('P17 inherited prototype root rejected',()=>{const p=Object.create(simple());reject(run(p),'INVALID_PROPOSAL_SHAPE');});
test('P18 accessor getter in root rejected without invocation',()=>{const p=simple();Object.defineProperty(p,'approved',{get(){throw Error('executed');},enumerable:true});reject(run(p),'INVALID_PROPOSAL_SHAPE');});
test('P19 accessor getter in nested intent rejected without invocation',()=>{const p=simple();Object.defineProperty(p.intent,'summary',{get(){throw Error('executed');},enumerable:true});reject(run(p),'INVALID_INTENT');});
test('P20 sparse subgoal array rejected',()=>reject(mutate(p=>{p.subgoals=new Array(1);}), 'INVALID_SUBGOALS'));
test('P21 unsupported schema version rejected',()=>reject(mutate(p=>p.schemaVersion='g02-goal-proposal-v9'),'UNSUPPORTED_SCHEMA_VERSION'));
test('P22 missing intake context rejected',()=>reject(validateGoalProposal(simple(),null),'INVALID_INTAKE_CONTEXT'));
test('P23 fake intake schema version rejected',()=>reject(validateGoalProposal(simple(),{...intake(),schemaVersion:'bad'}),'INVALID_INTAKE_CONTEXT'));
test('P24 too many deliverables rejected',()=>reject(mutate(p=>p.deliverables=Array.from({length:9},(_,i)=>({id:'d'+i,description:'Result',formatHint:null}))),'INVALID_DELIVERABLES'));
test('P25 duplicate deliverable IDs rejected',()=>reject(mutate(p=>p.deliverables.push({...p.deliverables[0]})),'INVALID_DELIVERABLES'));
test('P26 invalid deliverable ID rejected',()=>reject(mutate(p=>p.deliverables[0].id='../file'),'INVALID_DELIVERABLES'));
test('P27 empty deliverable description rejected',()=>reject(mutate(p=>p.deliverables[0].description='  '),'INVALID_DELIVERABLES'));
test('P28 format hint null accepted without inventing a format',()=>{const p=simple();p.deliverables[0].formatHint=null;assert.equal(run(p).proposal.deliverables[0].formatHint,null);});
test('P29 invalid format hint rejected',()=>reject(mutate(p=>p.deliverables[0].formatHint=''),'INVALID_DELIVERABLES'));
test('P30 too many candidate subgoals rejected',()=>reject(mutate(p=>p.subgoals=Array.from({length:13},(_,i)=>({id:'s'+i,outcome:'Step',dependsOn:[],deliverableIds:['template']}))),'INVALID_SUBGOALS'));
test('P31 duplicate subgoal IDs rejected',()=>reject(mutate(p=>p.subgoals.push({...p.subgoals[0]})),'INVALID_SUBGOALS'));
test('P32 unknown dependency rejected',()=>reject(mutate(p=>p.subgoals[0].dependsOn=['missing']),'INVALID_DAG_REFERENCE'));
test('P33 self dependency rejected',()=>reject(mutate(p=>p.subgoals[0].dependsOn=['draft']),'INVALID_DAG_REFERENCE'));
test('P34 cycle across two candidate subgoals rejected',()=>{const p=simple();p.subgoals[0].dependsOn=['review'];p.subgoals.push({id:'review',outcome:'Review',dependsOn:['draft'],deliverableIds:[]});reject(run(p),'CYCLIC_CANDIDATE_DAG');});
test('P35 unknown deliverable reference rejected',()=>reject(mutate(p=>p.subgoals[0].deliverableIds=['missing']),'INVALID_DAG_REFERENCE'));
test('P36 deliverable without candidate subgoal rejected',()=>reject(mutate(p=>p.subgoals[0].deliverableIds=[]),'UNMAPPED_DELIVERABLE'));
test('P37 duplicate subgoal dependency rejected',()=>{const p=mixed();p.subgoals[1].dependsOn=['analysis','analysis'];reject(run(p,intake(sourceRefs)),'INVALID_SUBGOALS');});
test('P38 acceptance criterion references unknown deliverable rejected',()=>reject(mutate(p=>p.acceptanceCriteria[0].deliverableId='other'),'UNVERIFIABLE_DELIVERABLE'));
test('P39 missing acceptance criterion for deliverable rejected',()=>reject(mutate(p=>p.acceptanceCriteria=[]),'INVALID_ACCEPTANCE_CRITERIA'));
test('P40 duplicate acceptance IDs rejected',()=>reject(mutate(p=>p.acceptanceCriteria.push({...p.acceptanceCriteria[0]})),'INVALID_ACCEPTANCE_CRITERIA'));
test('P41 unknown verification method rejected',()=>reject(mutate(p=>p.acceptanceCriteria[0].method='AI_SAYS_DONE'),'INVALID_ACCEPTANCE_CRITERIA'));
test('P42 malformed Unicode in acceptance check rejected',()=>reject(mutate(p=>p.acceptanceCriteria[0].check='bad\uD800'),'INVALID_ACCEPTANCE_CRITERIA'));
test('P43 unsafe terminal control in summary rejected',()=>reject(mutate(p=>p.intent.summary='Plan\u001B[31m'),'INVALID_INTENT'));
test('P44 multilingual and math preserved in candidate text',()=>{const p=simple();p.intent.summary='Hlela ama-fractions: √4 ≤ 2 — שלום';assert.equal(run(p).proposal.intent.summary,p.intent.summary);});
test('P45 empty intent modes rejected',()=>reject(mutate(p=>p.intent.modes=[]),'INVALID_INTENT'));
test('P46 duplicate intent modes rejected',()=>reject(mutate(p=>p.intent.modes=['CREATE','CREATE']),'INVALID_INTENT'));
test('P47 UNKNOWN cannot mix with known modes',()=>reject(mutate(p=>p.intent.modes=['UNKNOWN','CREATE']),'INVALID_INTENT'));
test('P48 root cannot claim refinement',()=>reject(mutate(p=>p.relationToPrior='REFINEMENT'),'ROOT_RELATION_CONFLICT'));
test('P49 new goal on existing goalId requires fresh intake',()=>{const p=second();p.relationToPrior='NEW_GOAL';reject(run(p,secondIntake()),'NEW_GOAL_REQUIRES_NEW_INTAKE');});
test('P50 valid correction claim on second turn is advisory only',()=>{const r=run(second(),secondIntake());assert.equal(r.status,'PROPOSAL_VALID');assert.equal(r.proposal.relationToPrior,'CORRECTION');assert.equal(r.policyAuthority,'NONE');});
test('P51 root UNKNOWN relation allowed',()=>{const p=simple();p.relationToPrior='UNKNOWN';assert.equal(run(p).status,'PROPOSAL_VALID');});
test('P52 blocking uncertainty routes to clarification candidate',()=>{const p=simple();p.uncertainties=[{code:'MISSING_INPUT',question:'Which source?',blocking:true}];assert.equal(run(p).status,'NEEDS_CLARIFICATION');});
test('P53 nonblocking uncertainty does not automatically block',()=>{const p=simple();p.uncertainties=[{code:'OTHER',question:'Preferred color?',blocking:false}];assert.equal(run(p).status,'PROPOSAL_VALID');});
test('P54 unknown effect routes to clarification even without uncertainty',()=>{const p=simple();p.effectClaims=[{kind:'UNKNOWN',description:'Effect not yet known'}];assert.equal(run(p).status,'NEEDS_CLARIFICATION');});
test('P55 unknown capability routes to clarification',()=>{const p=simple();p.capabilityNeeds=[{kind:'UNKNOWN',reason:'Tool not identified'}];assert.equal(run(p).status,'NEEDS_CLARIFICATION');});
test('P56 unknown intent mode routes to clarification',()=>{const p=simple();p.intent.modes=['UNKNOWN'];assert.equal(run(p).status,'NEEDS_CLARIFICATION');});
test('P57 external send claim requires later policy review',()=>{const p=simple();p.effectClaims=[{kind:'EXTERNAL_SEND',description:'Send a message'}];assert.equal(run(p).status,'POLICY_REVIEW_REQUIRED');});
test('P58 shared write claim requires later policy review',()=>{const p=simple();p.effectClaims=[{kind:'SHARED_WRITE',description:'Update shared doc'}];assert.equal(run(p).status,'POLICY_REVIEW_REQUIRED');});
test('P59 destructive effect claim rejected by prototype',()=>{const p=simple();p.effectClaims=[{kind:'DESTRUCTIVE',description:'Delete data'}];reject(run(p),'DESTRUCTIVE_EFFECT_UNSUPPORTED');});
test('P60 message send capability with local-only effect rejected',()=>{const p=simple();p.capabilityNeeds=[{kind:'MESSAGE_SEND',reason:'Send email'}];reject(run(p),'EFFECT_CAPABILITY_CONFLICT');});
test('P61 message send capability with unknown effect requires clarification',()=>{const p=simple();p.capabilityNeeds=[{kind:'MESSAGE_SEND',reason:'Send email'}];p.effectClaims=[{kind:'UNKNOWN',description:'Need review'}];assert.equal(run(p).status,'NEEDS_CLARIFICATION');});
test('P62 connector write with read-only effect rejected',()=>{const p=simple();p.capabilityNeeds=[{kind:'CONNECTOR_WRITE',reason:'Update app'}];p.effectClaims=[{kind:'READ_ONLY',description:'Read only'}];reject(run(p),'EFFECT_CAPABILITY_CONFLICT');});
test('P63 connector write with shared effect requires policy review',()=>{const p=simple();p.capabilityNeeds=[{kind:'CONNECTOR_WRITE',reason:'Update app'}];p.effectClaims=[{kind:'SHARED_WRITE',description:'Update shared app'}];assert.equal(run(p).status,'POLICY_REVIEW_REQUIRED');});
test('P64 a risky effect plus blocking uncertainty clarifies first',()=>{const p=simple();p.effectClaims=[{kind:'EXTERNAL_SEND',description:'Send'}];p.uncertainties=[{code:'MISSING_RECIPIENT',question:'To whom?',blocking:true}];assert.equal(run(p).status,'NEEDS_CLARIFICATION');});
test('P65 frozen validated result cannot be changed by caller mutation',()=>{const p=simple();const r=run(p);p.deliverables[0].description='Mutated after validation';assert.equal(r.proposal.deliverables[0].description,'Editable study-plan template');assert.equal(Object.isFrozen(r.proposal.subgoals[0].dependsOn),true);assert.equal(Object.isFrozen(r.binding),true);});
test('P66 every status explicitly denies policy authority',()=>{for(const p of [simple(),(()=>{const x=simple();x.effectClaims=[{kind:'EXTERNAL_SEND',description:'Send'}];return x;})(),(()=>{const x=simple();x.intent.modes=['UNKNOWN'];return x;})()])assert.equal(run(p).policyAuthority,'NONE');});
test('P67 valid revision always invalidates previous approvals',()=>{const {a,b,p,q}=validatedPair();const r=assessGoalProposalRevision(p,q,a,b);assert.equal(r.status,'REVISION_REQUIRES_INTERPRETATION');assert.equal(r.invalidatePriorApprovals,true);assert.equal(r.recheckDependentPlan,true);});
test('P68 changed effect claim reported but never authorized',()=>{const {a,b,p}=validatedPair();const q=run({...second(),effectClaims:[{kind:'EXTERNAL_SEND',description:'Send'}]},b);const r=assessGoalProposalRevision(p,q,a,b);assert.equal(r.effectClaimsChanged,true);assert.equal(r.policyAuthority,'NONE');});
test('P69 changed deliverable reported',()=>{const {a,b,p}=validatedPair();const x=second();x.deliverables[0].description='Revised template';const q=run(x,b);assert.equal(assessGoalProposalRevision(p,q,a,b).deliverablesChanged,true);});
test('P70 same proposal wording in new turn still invalidates approvals',()=>{const {a,b,p}=validatedPair();const q=run(second(),b);assert.equal(assessGoalProposalRevision(p,q,a,b).invalidatePriorApprovals,true);});
test('P71 cross-goal revision rejected',()=>{const {a,p}=validatedPair();const b=secondIntake({goalId:'goal-2'}),q=run(second(),b);reject(assessGoalProposalRevision(p,q,a,b),'INVALID_PROPOSAL_REVISION');});
test('P72 cross-tenant revision rejected',()=>{const {a,p}=validatedPair();const b=secondIntake({actor:{subject:'teacher-demo',tenant:'other'}}),q=run(second(),b);reject(assessGoalProposalRevision(p,q,a,b),'INVALID_PROPOSAL_REVISION');});
test('P73 wrong-parent revision rejected',()=>{const {a,p}=validatedPair();const b=secondIntake({parentTurnId:'wrong'}),q=run(second(),b);reject(assessGoalProposalRevision(p,q,a,b),'INVALID_PROPOSAL_REVISION');});
test('P74 stale revision rejected',()=>{const {a,p}=validatedPair();const b=intake(),q=run(simple(),b);reject(assessGoalProposalRevision(p,q,a,b),'INVALID_PROPOSAL_REVISION');});
test('P75 forged result binding rejected',()=>{const {a,b,p,q}=validatedPair();reject(assessGoalProposalRevision(p,{...q,binding:{...q.binding,goalId:'forged'}},a,b),'INVALID_PROPOSAL_REVISION');});
test('P76 invalid second proposal rejected during revision',()=>{const {a,b,p,q}=validatedPair();reject(assessGoalProposalRevision(p,{...q,proposal:{...q.proposal,approved:true}},a,b),'INVALID_PROPOSAL_REVISION');});
test('P77 candidate DAG never becomes an execution graph',()=>{const r=run();assert.equal(Object.hasOwn(r,'toolCalls'),false);assert.equal(Object.hasOwn(r,'executed'),false);assert.equal(Object.hasOwn(r,'approved'),false);});
test('P78 no model/provider or installed app is inferred from format hint',()=>{const r=run();assert.equal(r.proposal.deliverables[0].formatHint,'xlsx');assert.equal(Object.hasOwn(r,'connectorAvailable'),false);});
test('P79 invalid capability type rejected',()=>reject(mutate(p=>p.capabilityNeeds[0].kind='SUPER_ADMIN'),'INVALID_CAPABILITY_NEEDS'));
test('P80 invalid uncertainty boolean rejected',()=>reject(mutate(p=>p.uncertainties=[{code:'OTHER',question:'Unknown?',blocking:'yes'}]),'INVALID_UNCERTAINTIES'));
test('P81 schema JSON is parseable, draft 2020-12 and closed at root',()=>{const schema=JSON.parse(readFileSync(new URL('./goal-proposal.schema.json',import.meta.url),'utf8'));assert.equal(schema.$schema,'https://json-schema.org/draft/2020-12/schema');assert.equal(schema.additionalProperties,false);assert.equal(schema.properties.schemaVersion.const,'g02-goal-proposal-v0.1');});
test('P82 schema required keys and prototype match',()=>{const schema=JSON.parse(readFileSync(new URL('./goal-proposal.schema.json',import.meta.url),'utf8'));assert.deepEqual([...schema.required].sort(),Object.keys(simple()).sort());assert.equal(schema.properties.subgoals.maxItems,12);assert.equal(schema.properties.deliverables.maxItems,8);assert.equal(schema.properties.sourceSlots.maxItems,24);});
test('P83 schema enums mirror validator effect/capability examples',()=>{const schema=JSON.parse(readFileSync(new URL('./goal-proposal.schema.json',import.meta.url),'utf8'));assert.deepEqual(schema.properties.effectClaims.items.properties.kind.enum,['READ_ONLY','LOCAL_ARTIFACT','SHARED_WRITE','EXTERNAL_SEND','DESTRUCTIVE','UNKNOWN']);assert.equal(schema.properties.capabilityNeeds.items.additionalProperties,false);});
test('P84 non-JSON function-valued nested field rejected',()=>reject(mutate(p=>p.deliverables[0].formatHint=()=>{}),'INVALID_DELIVERABLES'));
test('P85 huge intent summary rejected',()=>reject(mutate(p=>p.intent.summary='x'.repeat(401)),'INVALID_INTENT'));
test('P86 invalid extra nested effect authority rejected',()=>reject(mutate(p=>p.effectClaims[0].approved=true),'INVALID_EFFECT_CLAIMS'));
test('P87 effect claim array cannot be empty',()=>reject(mutate(p=>p.effectClaims=[]),'INVALID_EFFECT_CLAIMS'));
test('P88 source slot 0 bound to actual source is structurally valid only',()=>{const p=simple();p.sourceSlots=[0];const r=run(p,intake([{kind:'upload',ref:'handle-1'}]));assert.equal(r.status,'PROPOSAL_VALID');assert.equal(r.policyAuthority,'NONE');});
