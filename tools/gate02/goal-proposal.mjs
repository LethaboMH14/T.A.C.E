/**
 * T.A.C.E G02.02 — bounded, deterministic GoalContract PROPOSAL validator.
 * Research prototype only. No LLM, real auth, tool registry, policy grant,
 * source access, execution, JSON transport parser or production JSON Schema engine.
 * See goal-proposal.schema.json and ADR-0006.
 */
import {assessTurnRevision} from './normalize-turn.mjs';

const ROOT=['schemaVersion','intent','relationToPrior','deliverables','subgoals','sourceSlots','capabilityNeeds','effectClaims','acceptanceCriteria','uncertainties'];
const MODES=new Set(['CREATE','ANALYZE','TRANSFORM','COORDINATE','COMMUNICATE','UNKNOWN']);
const RELATIONS=new Set(['NEW_GOAL','REFINEMENT','CORRECTION','UNKNOWN']);
const CAPABILITIES=new Set(['READ_SOURCE','WRITE_ARTIFACT','SEARCH_PUBLIC','CONNECTOR_READ','CONNECTOR_WRITE','MESSAGE_DRAFT','MESSAGE_SEND','SCHEDULING','UNKNOWN']);
const EFFECTS=new Set(['READ_ONLY','LOCAL_ARTIFACT','SHARED_WRITE','EXTERNAL_SEND','DESTRUCTIVE','UNKNOWN']);
const METHODS=new Set(['ARTIFACT_REOPEN','SCHEMA_VALIDATION','SOURCE_CROSSCHECK','SCHEDULE_CONFLICT_CHECK','HUMAN_REVIEW','OTHER']);
const UNCERTAINTIES=new Set(['MISSING_INPUT','AMBIGUOUS_REFERENCE','UNRESOLVED_TIME','MISSING_RECIPIENT','UNSUPPORTED_FORMAT','UNKNOWN_EFFECT','OTHER']);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const dataRecord=x=>{
  if(x===null || typeof x!=='object' || Array.isArray(x))return false;
  const proto=Object.getPrototypeOf(x);
  if(proto!==Object.prototype && proto!==null)return false;
  const descriptors=Object.getOwnPropertyDescriptors(x);
  return Reflect.ownKeys(x).every(k=>typeof k==='string' && own(descriptors,k) && own(descriptors[k],'value'));
};
const exact=(o,keys)=>dataRecord(o) && Reflect.ownKeys(o).length===keys.length &&
  keys.every(k=>own(o,k));
const denseArray=(a,min,max)=>{
  if(!Array.isArray(a) || Object.getPrototypeOf(a)!==Array.prototype ||
     a.length<min || a.length>max)return false;
  const descriptors=Object.getOwnPropertyDescriptors(a);
  if(Reflect.ownKeys(a).length!==a.length+1)return false;
  for(let i=0;i<a.length;i++)if(!own(descriptors,String(i)) ||
    !own(descriptors[String(i)],'value'))return false;
  return true;
};
const validUtf16=s=>{
  for(let i=0;i<s.length;i++){
    const c=s.charCodeAt(i);
    if(c>=0xD800 && c<=0xDBFF){
      const d=s.charCodeAt(++i);
      if(!(d>=0xDC00 && d<=0xDFFF))return false;
    } else if(c>=0xDC00 && c<=0xDFFF)return false;
  }
  return true;
};
const safeString=(s,max)=>typeof s==='string' && s.length>=1 && s.length<=max &&
  s.trim().length>0 && validUtf16(s) &&
  !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u.test(s);
const id=s=>safeString(s,32) && /^[a-z][a-z0-9_-]{0,31}$/.test(s);
const uniq=a=>new Set(a).size===a.length;
const enumVal=(v,set)=>typeof v==='string' && set.has(v);
const freezeList=a=>Object.freeze(a.map(x=>Object.freeze(x)));
const fail=code=>Object.freeze({status:'REJECTED_PROPOSAL',code});
const validIntake=i=>dataRecord(i) && i.schemaVersion==='g02-intake-v0.2' &&
  typeof i.goalId==='string' && typeof i.turnId==='string' &&
  typeof i.actorRef==='string' && typeof i.tenantRef==='string' &&
  Number.isSafeInteger(i.revision) && i.revision>=1 &&
  denseArray(i.sourceRefs,0,24) &&
  i.sourceRefs.every(s=>dataRecord(s) && s.trust==='UNVERIFIED_REFERENCE' &&
    ['upload','public','connector'].includes(s.kind) && typeof s.ref==='string');

function topo(subgoals) {
  const map=new Map(subgoals.map(s=>[s.id,s]));
  const state=new Map(),order=[];
  function visit(id){
    if(state.get(id)===1)return false;
    if(state.get(id)===2)return true;
    state.set(id,1);
    for(const dep of map.get(id).dependsOn)if(!visit(dep))return false;
    state.set(id,2);
    order.push(id);
    return true;
  }
  for(const id of map.keys())if(!visit(id))return null;
  return Object.freeze(order);
}

/**
 * Returns a server-bound *candidate* interpretation. Status is never approval.
 * All proposal input is treated as untrusted, including "effectClaims".
 * The intake parameter is a test fixture until authenticated G07 middleware exists.
 */
export function validateGoalProposal(proposal,intake) {
  try { return validate(proposal,intake); }
  catch { return fail('MALFORMED_PROPOSAL'); }
}
function validate(p,intake) {
  if(!validIntake(intake))return fail('INVALID_INTAKE_CONTEXT');
  if(!exact(p,ROOT))return fail('INVALID_PROPOSAL_SHAPE');
  if(p.schemaVersion!=='g02-goal-proposal-v0.1')return fail('UNSUPPORTED_SCHEMA_VERSION');
  if(!exact(p.intent,['summary','modes']) || !safeString(p.intent.summary,400) ||
     !denseArray(p.intent.modes,1,4) || !p.intent.modes.every(x=>enumVal(x,MODES)) ||
     !uniq(p.intent.modes) || (p.intent.modes.includes('UNKNOWN') && p.intent.modes.length>1))
    return fail('INVALID_INTENT');
  if(!enumVal(p.relationToPrior,RELATIONS))return fail('INVALID_RELATION');
  if(intake.revision===1 && !['NEW_GOAL','UNKNOWN'].includes(p.relationToPrior))
    return fail('ROOT_RELATION_CONFLICT');
  if(intake.revision>1 && p.relationToPrior==='NEW_GOAL')
    return fail('NEW_GOAL_REQUIRES_NEW_INTAKE');

  if(!denseArray(p.deliverables,1,8) ||
     !p.deliverables.every(d=>exact(d,['id','description','formatHint']) &&
       id(d.id) && safeString(d.description,400) &&
       (d.formatHint===null || safeString(d.formatHint,80))) ||
     !uniq(p.deliverables.map(d=>d.id)))return fail('INVALID_DELIVERABLES');
  const deliverables=new Set(p.deliverables.map(d=>d.id));

  if(!denseArray(p.subgoals,1,12) ||
     !p.subgoals.every(s=>exact(s,['id','outcome','dependsOn','deliverableIds']) &&
       id(s.id) && safeString(s.outcome,400) &&
       denseArray(s.dependsOn,0,11) && s.dependsOn.every(id) && uniq(s.dependsOn) &&
       denseArray(s.deliverableIds,0,8) && s.deliverableIds.every(id) && uniq(s.deliverableIds)) ||
     !uniq(p.subgoals.map(s=>s.id)))return fail('INVALID_SUBGOALS');
  const subgoalIds=new Set(p.subgoals.map(s=>s.id));
  if(p.subgoals.some(s=>s.dependsOn.some(d=>!subgoalIds.has(d) || d===s.id) ||
     s.deliverableIds.some(d=>!deliverables.has(d))))
    return fail('INVALID_DAG_REFERENCE');
  if(p.deliverables.some(d=>!p.subgoals.some(s=>s.deliverableIds.includes(d.id))))
    return fail('UNMAPPED_DELIVERABLE');
  const order=topo(p.subgoals);
  if(!order)return fail('CYCLIC_CANDIDATE_DAG');

  if(!denseArray(p.sourceSlots,0,24) ||
     !p.sourceSlots.every(s=>Number.isSafeInteger(s) && s>=0 && s<24) ||
     !uniq(p.sourceSlots))return fail('INVALID_SOURCE_SLOTS');
  if(p.sourceSlots.some(s=>s>=intake.sourceRefs.length))return fail('UNBOUND_SOURCE_SLOT');

  if(!denseArray(p.capabilityNeeds,0,12) ||
     !p.capabilityNeeds.every(c=>exact(c,['kind','reason']) &&
       enumVal(c.kind,CAPABILITIES) && safeString(c.reason,240)))
    return fail('INVALID_CAPABILITY_NEEDS');
  if(!denseArray(p.effectClaims,1,8) ||
     !p.effectClaims.every(e=>exact(e,['kind','description']) &&
       enumVal(e.kind,EFFECTS) && safeString(e.description,240)))
    return fail('INVALID_EFFECT_CLAIMS');

  if(!denseArray(p.acceptanceCriteria,1,16) ||
     !p.acceptanceCriteria.every(a=>exact(a,['id','deliverableId','check','method']) &&
       id(a.id) && id(a.deliverableId) && safeString(a.check,400) &&
       enumVal(a.method,METHODS)) ||
     !uniq(p.acceptanceCriteria.map(a=>a.id)))return fail('INVALID_ACCEPTANCE_CRITERIA');
  if(p.acceptanceCriteria.some(a=>!deliverables.has(a.deliverableId)) ||
     p.deliverables.some(d=>!p.acceptanceCriteria.some(a=>a.deliverableId===d.id)))
    return fail('UNVERIFIABLE_DELIVERABLE');

  if(!denseArray(p.uncertainties,0,12) ||
     !p.uncertainties.every(u=>exact(u,['code','question','blocking']) &&
       enumVal(u.code,UNCERTAINTIES) && safeString(u.question,240) &&
       typeof u.blocking==='boolean'))return fail('INVALID_UNCERTAINTIES');

  const kinds=new Set(p.effectClaims.map(e=>e.kind));
  const caps=new Set(p.capabilityNeeds.map(c=>c.kind));
  if(kinds.has('DESTRUCTIVE'))return fail('DESTRUCTIVE_EFFECT_UNSUPPORTED');
  if(caps.has('MESSAGE_SEND') && !kinds.has('EXTERNAL_SEND') && !kinds.has('UNKNOWN'))
    return fail('EFFECT_CAPABILITY_CONFLICT');
  if(caps.has('CONNECTOR_WRITE') && !kinds.has('SHARED_WRITE') &&
     !kinds.has('EXTERNAL_SEND') && !kinds.has('UNKNOWN'))
    return fail('EFFECT_CAPABILITY_CONFLICT');

  // A new frozen allowlist copy: caller cannot mutate a validated proposal later.
  const frozen=Object.freeze({
    schemaVersion:p.schemaVersion,
    intent:Object.freeze({summary:p.intent.summary,modes:Object.freeze([...p.intent.modes])}),
    relationToPrior:p.relationToPrior,
    deliverables:freezeList(p.deliverables.map(d=>({id:d.id,description:d.description,formatHint:d.formatHint}))),
    subgoals:freezeList(p.subgoals.map(s=>({
      id:s.id,outcome:s.outcome,dependsOn:Object.freeze([...s.dependsOn]),
      deliverableIds:Object.freeze([...s.deliverableIds])
    }))),
    sourceSlots:Object.freeze([...p.sourceSlots]),
    capabilityNeeds:freezeList(p.capabilityNeeds.map(c=>({kind:c.kind,reason:c.reason}))),
    effectClaims:freezeList(p.effectClaims.map(e=>({kind:e.kind,description:e.description}))),
    acceptanceCriteria:freezeList(p.acceptanceCriteria.map(a=>({
      id:a.id,deliverableId:a.deliverableId,check:a.check,method:a.method
    }))),
    uncertainties:freezeList(p.uncertainties.map(u=>({
      code:u.code,question:u.question,blocking:u.blocking
    })))
  });
  const binding=Object.freeze({goalId:intake.goalId,turnId:intake.turnId,revision:intake.revision});
  const unknown=p.intent.modes.includes('UNKNOWN') || caps.has('UNKNOWN') ||
    kinds.has('UNKNOWN') || p.uncertainties.some(u=>u.blocking);
  const consequential=kinds.has('SHARED_WRITE') || kinds.has('EXTERNAL_SEND');
  const status=unknown?'NEEDS_CLARIFICATION':consequential?'POLICY_REVIEW_REQUIRED':'PROPOSAL_VALID';
  const code=unknown?'UNRESOLVED_PROPOSAL':consequential?'EFFECT_REQUIRES_POLICY':'STRUCTURALLY_VALID';
  return Object.freeze({status,code,binding,proposal:frozen,candidateOrder:order,
    policyAuthority:'NONE'});
}

/**
 * Compare two previously validated proposal snapshots and G02.01 turn metadata.
 * No semantic inference, authenticated ledger, approval or tool action occurs.
 */
export function assessGoalProposalRevision(previous,next,previousIntake,nextIntake) {
  try {
    if(!dataRecord(previous) || !dataRecord(next) ||
       !dataRecord(previous.binding) || !dataRecord(next.binding) ||
       !dataRecord(previous.proposal) || !dataRecord(next.proposal) ||
       previous.binding.goalId!==previousIntake?.goalId ||
       next.binding.goalId!==nextIntake?.goalId ||
       previous.binding.turnId!==previousIntake?.turnId ||
       next.binding.turnId!==nextIntake?.turnId ||
       previous.binding.revision!==previousIntake?.revision ||
       next.binding.revision!==nextIntake?.revision ||
       validateGoalProposal(previous.proposal,previousIntake).status==='REJECTED_PROPOSAL' ||
       validateGoalProposal(next.proposal,nextIntake).status==='REJECTED_PROPOSAL' ||
       assessTurnRevision(previousIntake,nextIntake).status!=='REVISION_REQUIRES_INTERPRETATION')
      return Object.freeze({status:'REJECTED_PROPOSAL',code:'INVALID_PROPOSAL_REVISION'});
    const effectClaimsChanged=JSON.stringify(previous.proposal.effectClaims)!==
      JSON.stringify(next.proposal.effectClaims);
    const deliverablesChanged=JSON.stringify(previous.proposal.deliverables)!==
      JSON.stringify(next.proposal.deliverables);
    return Object.freeze({
      status:'REVISION_REQUIRES_INTERPRETATION',
      code:'NEW_GOAL_PROPOSAL_REVISION',
      relationClaim:next.proposal.relationToPrior,
      effectClaimsChanged,deliverablesChanged,
      invalidatePriorApprovals:true,recheckDependentPlan:true,
      policyAuthority:'NONE'
    });
  } catch {return Object.freeze({status:'REJECTED_PROPOSAL',code:'INVALID_PROPOSAL_REVISION'});}
}
