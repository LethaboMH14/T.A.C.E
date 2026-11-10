/**
 * T.A.C.E G02.02 — bounded, deterministic GoalContract PROPOSAL validator.
 * Research prototype only. No LLM, real auth, tool registry, policy grant,
 * source access, execution, JSON transport parser or production JSON Schema engine.
 * See goal-proposal.schema.json and ADR-0006.
 */
import {assessTurnRevision} from './normalize-turn.mjs';
import {isDeepStrictEqual} from 'node:util';
import {Buffer} from 'node:buffer';
import {createHash} from 'node:crypto';

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
// JSON Schema 2020-12 string length counts Unicode code points, not UTF-16 units.
const safeString=(s,max)=>typeof s==='string' && s.length>=1 && s.length<=max*2 &&
  validUtf16(s) && [...s].length<=max && s.trim().length>0 &&
  !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u.test(s);
const id=s=>safeString(s,32) && /^[a-z][a-z0-9_-]{0,31}$/.test(s);
const uniq=a=>new Set(a).size===a.length;
const enumVal=(v,set)=>typeof v==='string' && set.has(v);
const freezeList=a=>Object.freeze(a.map(x=>Object.freeze(x)));
const fail=code=>Object.freeze({status:'REJECTED_PROPOSAL',code});
const intakeId=s=>typeof s==='string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(s);
const intakeKeys=['schemaVersion','goalId','turnId','parentTurnId','revision','actorRef','tenantRef',
  'rawGoal','interpretationText','localeHint','timeZoneHint','deadlineText','budgetHint','sourceRefs','flags'];
const validIntake=i=>exact(i,intakeKeys) && i.schemaVersion==='g02-intake-v0.2' &&
  intakeId(i.goalId) && intakeId(i.turnId) &&
  intakeId(i.actorRef) && intakeId(i.tenantRef) &&
  Number.isSafeInteger(i.revision) && i.revision>=1 &&
  (i.revision===1 ? i.parentTurnId===null :
    intakeId(i.parentTurnId) && i.parentTurnId!==i.turnId) &&
  typeof i.rawGoal==='string' && validUtf16(i.rawGoal) &&
  Buffer.byteLength(i.rawGoal,'utf8')<=6000 &&
  typeof i.interpretationText==='string' &&
  i.interpretationText===i.rawGoal.normalize('NFC').replace(/\r\n?/g,'\n') &&
  exact(i.localeHint,['tag','source']) &&
  typeof i.localeHint.tag==='string' &&
  ['client_preference','server_default','unknown'].includes(i.localeHint.source) &&
  exact(i.timeZoneHint,['id','source']) &&
  (i.timeZoneHint.id===null || typeof i.timeZoneHint.id==='string') &&
  ['server_context','unknown'].includes(i.timeZoneHint.source) &&
  (i.timeZoneHint.source==='unknown' ? i.timeZoneHint.id===null : typeof i.timeZoneHint.id==='string') &&
  (i.deadlineText===null || typeof i.deadlineText==='string') &&
  exact(i.budgetHint,['maxCostCents','source']) &&
  (i.budgetHint.maxCostCents===null ||
    (Number.isSafeInteger(i.budgetHint.maxCostCents) && i.budgetHint.maxCostCents>=0)) &&
  ['client_cap','unspecified'].includes(i.budgetHint.source) &&
  (i.budgetHint.source==='unspecified' ? i.budgetHint.maxCostCents===null :
    i.budgetHint.maxCostCents!==null) &&
  exact(i.flags,['nfcChanged','lineEndingsChanged','bidiControlsPresent',
    'invisibleFormattingPresent','requiresSemanticClarification']) &&
  Object.values(i.flags).every(v=>typeof v==='boolean') &&
  i.flags.nfcChanged===(i.rawGoal.normalize('NFC')!==i.rawGoal) &&
  i.flags.lineEndingsChanged===/\r/.test(i.rawGoal) &&
  i.flags.bidiControlsPresent===/[\u202A-\u202E\u2066-\u2069]/u.test(i.rawGoal) &&
  i.flags.invisibleFormattingPresent===/[\u200B-\u200D\u2060\uFEFF]/u.test(i.rawGoal) &&
  i.flags.requiresSemanticClarification===
    (!/[\p{L}\p{N}]/u.test(i.interpretationText)) &&
  denseArray(i.sourceRefs,0,24) &&
  i.sourceRefs.every(s=>exact(s,['kind','ref','trust']) &&
    s.trust==='UNVERIFIED_REFERENCE' &&
    ['upload','public','connector'].includes(s.kind) && intakeId(s.ref)) &&
  uniq(i.sourceRefs.map(s=>s.kind+':'+s.ref));

function intakeFingerprint(i) {
  // Internal correlation checksum, NOT a MAC, signature, proof of authentication,
  // anonymization or permission. Never expose it in the model projection.
  const manifest={
    schemaVersion:i.schemaVersion,goalId:i.goalId,turnId:i.turnId,
    parentTurnId:i.parentTurnId,revision:i.revision,
    actorRef:i.actorRef,tenantRef:i.tenantRef,rawGoal:i.rawGoal,
    interpretationText:i.interpretationText,localeHint:i.localeHint,
    timeZoneHint:i.timeZoneHint,deadlineText:i.deadlineText,
    budgetHint:i.budgetHint,sourceRefs:i.sourceRefs,flags:i.flags
  };
  return createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
}

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
  if(p.schemaVersion!=='g02-goal-proposal-v0.2')return fail('UNSUPPORTED_SCHEMA_VERSION');
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
     !p.subgoals.every(s=>exact(s,['id','outcome','dependsOn','deliverableIds','sourceSlots','capabilityKinds','effectKinds']) &&
       id(s.id) && safeString(s.outcome,400) &&
       denseArray(s.dependsOn,0,11) && s.dependsOn.every(id) && uniq(s.dependsOn) &&
       denseArray(s.deliverableIds,0,8) && s.deliverableIds.every(id) && uniq(s.deliverableIds) &&
       denseArray(s.sourceSlots,0,24) && s.sourceSlots.every(n=>Number.isSafeInteger(n) && n>=0 && n<24) && uniq(s.sourceSlots) &&
       denseArray(s.capabilityKinds,0,12) && s.capabilityKinds.every(k=>enumVal(k,CAPABILITIES)) && uniq(s.capabilityKinds) &&
       denseArray(s.effectKinds,1,8) && s.effectKinds.every(k=>enumVal(k,EFFECTS)) && uniq(s.effectKinds)) ||
     !uniq(p.subgoals.map(s=>s.id)))return fail('INVALID_SUBGOALS');
  const subgoalIds=new Set(p.subgoals.map(s=>s.id));
  if(p.subgoals.some(s=>s.dependsOn.some(d=>!subgoalIds.has(d) || d===s.id) ||
     s.deliverableIds.some(d=>!deliverables.has(d))))
    return fail('INVALID_DAG_REFERENCE');
  if(p.deliverables.some(d=>!p.subgoals.some(s=>s.deliverableIds.includes(d.id))))
    return fail('UNMAPPED_DELIVERABLE');
  const order=topo(p.subgoals);
  if(!order)return fail('CYCLIC_CANDIDATE_DAG');
  // Every intermediate node must contribute to an eventual deliverable.
  const useful=new Set();
  const byId=new Map(p.subgoals.map(s=>[s.id,s]));
  function mark(id){if(useful.has(id))return;useful.add(id);for(const d of byId.get(id).dependsOn)mark(d);}
  for(const s of p.subgoals)if(s.deliverableIds.length)mark(s.id);
  if(p.subgoals.some(s=>!useful.has(s.id)))return fail('ORPHAN_SUBGOAL');

  if(!denseArray(p.sourceSlots,0,24) ||
     !p.sourceSlots.every(s=>Number.isSafeInteger(s) && s>=0 && s<24) ||
     !uniq(p.sourceSlots))return fail('INVALID_SOURCE_SLOTS');
  if(p.sourceSlots.some(s=>s>=intake.sourceRefs.length))return fail('UNBOUND_SOURCE_SLOT');

  if(!denseArray(p.capabilityNeeds,0,12) ||
     !p.capabilityNeeds.every(c=>exact(c,['kind','reason']) &&
       enumVal(c.kind,CAPABILITIES) && safeString(c.reason,240)) ||
     !uniq(p.capabilityNeeds.map(c=>c.kind)))
    return fail('INVALID_CAPABILITY_NEEDS');
  if(!denseArray(p.effectClaims,1,8) ||
     !p.effectClaims.every(e=>exact(e,['kind','description']) &&
       enumVal(e.kind,EFFECTS) && safeString(e.description,240)) ||
     !uniq(p.effectClaims.map(e=>e.kind)))
    return fail('INVALID_EFFECT_CLAIMS');

  if(!denseArray(p.acceptanceCriteria,1,16) ||
     !p.acceptanceCriteria.every(a=>exact(a,['id','deliverableId','check','method','evidenceExpectation']) &&
       id(a.id) && id(a.deliverableId) && safeString(a.check,400) &&
       enumVal(a.method,METHODS) && safeString(a.evidenceExpectation,240)) ||
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
  const slots=new Set(p.sourceSlots);
  if(p.subgoals.some(s=>s.sourceSlots.some(n=>!slots.has(n)) ||
       s.capabilityKinds.some(k=>!caps.has(k)) ||
       s.effectKinds.some(k=>!kinds.has(k))))
    return fail('INVALID_SUBGOAL_MAPPING');
  const usedSlots=new Set(p.subgoals.flatMap(s=>s.sourceSlots));
  const usedCaps=new Set(p.subgoals.flatMap(s=>s.capabilityKinds));
  const usedEffects=new Set(p.subgoals.flatMap(s=>s.effectKinds));
  if([...slots].some(n=>!usedSlots.has(n)) ||
      [...caps].some(k=>!usedCaps.has(k)) ||
      [...kinds].some(k=>!usedEffects.has(k)))
    return fail('UNMAPPED_GLOBAL_CLAIM');
  for(const s of p.subgoals) {
    const sc=new Set(s.capabilityKinds),se=new Set(s.effectKinds);
    if(sc.has('MESSAGE_SEND') && !se.has('EXTERNAL_SEND') && !se.has('UNKNOWN'))
      return fail('EFFECT_CAPABILITY_CONFLICT');
    if(sc.has('CONNECTOR_WRITE') && !se.has('SHARED_WRITE') &&
       !se.has('EXTERNAL_SEND') && !se.has('UNKNOWN'))
      return fail('EFFECT_CAPABILITY_CONFLICT');
    if(sc.has('WRITE_ARTIFACT') && !se.has('LOCAL_ARTIFACT') &&
       !se.has('SHARED_WRITE') && !se.has('UNKNOWN'))
      return fail('EFFECT_CAPABILITY_CONFLICT');
    if(sc.has('MESSAGE_DRAFT') && !se.has('LOCAL_ARTIFACT') &&
       !se.has('SHARED_WRITE') && !se.has('UNKNOWN'))
      return fail('EFFECT_CAPABILITY_CONFLICT');
  }
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
      deliverableIds:Object.freeze([...s.deliverableIds]),
      sourceSlots:Object.freeze([...s.sourceSlots]),
      capabilityKinds:Object.freeze([...s.capabilityKinds]),
      effectKinds:Object.freeze([...s.effectKinds])
    }))),
    sourceSlots:Object.freeze([...p.sourceSlots]),
    capabilityNeeds:freezeList(p.capabilityNeeds.map(c=>({kind:c.kind,reason:c.reason}))),
    effectClaims:freezeList(p.effectClaims.map(e=>({kind:e.kind,description:e.description}))),
    acceptanceCriteria:freezeList(p.acceptanceCriteria.map(a=>({
      id:a.id,deliverableId:a.deliverableId,check:a.check,method:a.method,
      evidenceExpectation:a.evidenceExpectation
    }))),
    uncertainties:freezeList(p.uncertainties.map(u=>({
      code:u.code,question:u.question,blocking:u.blocking
    })))
  });
  // Limits the serialized allowlist; transport must independently cap raw JSON.
  if(Buffer.byteLength(JSON.stringify(frozen),'utf8')>32768)return fail('PROPOSAL_TOO_LARGE');
  const binding=Object.freeze({goalId:intake.goalId,turnId:intake.turnId,revision:intake.revision,
    intakeFingerprint:intakeFingerprint(intake)});
  const unknown=p.intent.modes.includes('UNKNOWN') || caps.has('UNKNOWN') ||
    kinds.has('UNKNOWN') || p.uncertainties.some(u=>u.blocking);
  const consequential=kinds.has('SHARED_WRITE') || kinds.has('EXTERNAL_SEND');
  const status=unknown?'NEEDS_CLARIFICATION':consequential?'POLICY_REVIEW_REQUIRED':'PROPOSAL_VALID';
  const code=unknown?'UNRESOLVED_PROPOSAL':consequential?'EFFECT_REQUIRES_POLICY':'STRUCTURALLY_VALID';
  return Object.freeze({status,code,binding,proposal:frozen,candidateOrder:order,
    policyAuthority:'NONE',semanticStatus:'UNVERIFIED',verificationStatus:'NOT_RUN'});
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
       assessTurnRevision(previousIntake,nextIntake).status!=='REVISION_REQUIRES_INTERPRETATION')
      return Object.freeze({status:'REJECTED_PROPOSAL',code:'INVALID_PROPOSAL_REVISION'});
    // Compare *all* fields with fresh canonical results. A forged status, order,
    // revision binding or policy flag cannot pass merely because the proposal parses.
    // This is not a signature: G07 must persist and authenticate ledger snapshots.
    const checkedPrevious=validateGoalProposal(previous.proposal,previousIntake);
    const checkedNext=validateGoalProposal(next.proposal,nextIntake);
    if(checkedPrevious.status==='REJECTED_PROPOSAL' ||
       checkedNext.status==='REJECTED_PROPOSAL' ||
       !isDeepStrictEqual(previous,checkedPrevious) ||
       !isDeepStrictEqual(next,checkedNext))
      return Object.freeze({status:'REJECTED_PROPOSAL',code:'INVALID_PROPOSAL_REVISION'});
    const effectClaimsChanged=JSON.stringify(previous.proposal.effectClaims)!==
      JSON.stringify(next.proposal.effectClaims);
    const deliverablesChanged=JSON.stringify(previous.proposal.deliverables)!==
      JSON.stringify(next.proposal.deliverables);
    const capabilityNeedsChanged=JSON.stringify(previous.proposal.capabilityNeeds)!==
      JSON.stringify(next.proposal.capabilityNeeds);
    const sourceSlotsChanged=JSON.stringify(previous.proposal.sourceSlots)!==
      JSON.stringify(next.proposal.sourceSlots);
    return Object.freeze({
      status:'REVISION_REQUIRES_INTERPRETATION',
      code:'NEW_GOAL_PROPOSAL_REVISION',
      relationClaim:next.proposal.relationToPrior,
      effectClaimsChanged,deliverablesChanged,capabilityNeedsChanged,sourceSlotsChanged,
      semanticContinuity:'UNVERIFIED',
      invalidatePriorApprovals:true,recheckDependentPlan:true,
      policyAuthority:'NONE'
    });
  } catch {return Object.freeze({status:'REJECTED_PROPOSAL',code:'INVALID_PROPOSAL_REVISION'});}
}
