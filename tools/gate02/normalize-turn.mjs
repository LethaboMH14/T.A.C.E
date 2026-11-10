/**
 * T.A.C.E G02.01 v0.2 — deterministic intake research spike.
 * Caller-provided "trusted" fixture is NOT authentication or an event store.
 * Real attestation, replay protection and policy enforcement belong to G07.
 */
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const plain = x => x!==null && typeof x==='object' && !Array.isArray(x) &&
  (Object.getPrototypeOf(x)===Object.prototype || Object.getPrototypeOf(x)===null) &&
  Reflect.ownKeys(x).every(k=>typeof k==='string' && own(Object.getOwnPropertyDescriptors(x),k) &&
    own(Object.getOwnPropertyDescriptors(x)[k],'value'));
const allowedRequest=new Set(['goal','sources','constraints']);
const allowedConstraints=new Set(['locale','deadline','maxCostCents']);
const allowedSource=new Set(['kind','ref']);
const keysAllowed=(o,allowed)=>Reflect.ownKeys(o).every(k=>typeof k==='string' && allowed.has(k));
const answer=(status,code,detail,record)=>Object.freeze({status,code,detail,...(record?{record}:{})});
const id=s=>typeof s==='string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(s);
const validUtf16=s=>{
  for(let i=0;i<s.length;i++){
    const c=s.charCodeAt(i);
    if(c>=0xD800 && c<=0xDBFF){
      const d=s.charCodeAt(++i);
      if(!(d>=0xDC00 && d<=0xDFFF)) return false;
    } else if(c>=0xDC00 && c<=0xDFFF) return false;
  }
  return true;
};
const forbiddenControl=s=>/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u.test(s);
const localeTag=s=>{try{const tags=Intl.getCanonicalLocales(s);return tags.length===1?tags[0]:null;}catch{return null;}};
const zoneIsValid=s=>{try{new Intl.DateTimeFormat('en-US',{timeZone:s});return true;}catch{return false;}};
const validText=(s,maxBytes)=>typeof s==='string' && validUtf16(s) &&
  !forbiddenControl(s) && new TextEncoder().encode(s).length<=maxBytes;

function validTrusted(trusted){
  if(!plain(trusted) || !plain(trusted.actor) ||
     !id(trusted.actor.subject) || !id(trusted.actor.tenant) ||
     !id(trusted.goalId) || !id(trusted.turnId) ||
     !Number.isSafeInteger(trusted.revision) || trusted.revision<1) return false;
  const parent=trusted.parentTurnId ?? null;
  if(trusted.revision===1 ? parent!==null : !id(parent)) return false;
  if(parent===trusted.turnId) return false;
  if(own(trusted,'defaultLocale') && (typeof trusted.defaultLocale!=='string' ||
     !localeTag(trusted.defaultLocale))) return false;
  if(own(trusted,'timeZone') && trusted.timeZone!==null &&
     (typeof trusted.timeZone!=='string' || !zoneIsValid(trusted.timeZone))) return false;
  return true;
}

export function normalizeGoalTurn(request,trusted={}) {
  if(!plain(request)) return answer('AWAITING_INPUT','INVALID_REQUEST','Expected a JSON-shaped goal request.');
  if(!keysAllowed(request,allowedRequest)) return answer('BLOCKED_POLICY','CLIENT_AUTHORITY_FIELD','Client fields cannot assert identity, role or approval.');
  if(!validTrusted(trusted)) return answer('BLOCKED_POLICY','UNATTESTED_TURN','Valid server-stamped goal, actor, tenant and revision are required.');

  const rawGoal=request.goal;
  if(typeof rawGoal!=='string') return answer('AWAITING_INPUT','MISSING_GOAL','Describe the desired outcome.');
  if(!validUtf16(rawGoal)) return answer('BLOCKED_POLICY','INVALID_UNICODE','Unpaired UTF-16 surrogate is not accepted.');
  if(forbiddenControl(rawGoal)) return answer('BLOCKED_POLICY','FORBIDDEN_CONTROL','Unsafe control character in goal.');
  if(new TextEncoder().encode(rawGoal).length>6000) return answer('BLOCKED_CAPABILITY','GOAL_TOO_LONG','Goal exceeds the 6000 UTF-8 byte intake limit.');
  const nfc=rawGoal.normalize('NFC');
  const interpretationText=nfc.replace(/\r\n?/g,'\n');
  const hasLetterOrNumber=/[\p{L}\p{N}]/u.test(interpretationText);
  const hasEmoji=/\p{Extended_Pictographic}/u.test(interpretationText);
  if(!hasLetterOrNumber && !hasEmoji) return answer('AWAITING_INPUT','MISSING_GOAL','Describe an outcome in words, numbers or an interpretable symbol.');

  const sources=own(request,'sources')?request.sources:[];
  if(!Array.isArray(sources) || sources.length>24) return answer('BLOCKED_CAPABILITY','INVALID_SOURCE_REFERENCE','Expected up to 24 opaque source handles.');
  const seen=new Set();
  for(const s of sources){
    if(!plain(s) || !keysAllowed(s,allowedSource) ||
       !['upload','public','connector'].includes(s.kind) || !id(s.ref))
      return answer('BLOCKED_CAPABILITY','INVALID_SOURCE_REFERENCE','Source must contain only kind and opaque handle.');
    const key=s.kind+':'+s.ref;
    if(seen.has(key)) return answer('BLOCKED_CAPABILITY','DUPLICATE_SOURCE_REFERENCE','Duplicate source handle.');
    seen.add(key);
  }

  const constraints=own(request,'constraints')?request.constraints:{};
  if(!plain(constraints) || !keysAllowed(constraints,allowedConstraints))
    return answer('BLOCKED_POLICY','INVALID_CONSTRAINTS','Unknown or malformed constraints.');
  if(own(constraints,'deadline') && (!validText(constraints.deadline,200) || !constraints.deadline.trim()))
    return answer('BLOCKED_POLICY','INVALID_DEADLINE','Deadline text is invalid.');
  if(own(constraints,'maxCostCents') &&
     (!Number.isSafeInteger(constraints.maxCostCents) || constraints.maxCostCents<0))
    return answer('BLOCKED_POLICY','INVALID_BUDGET','Cost cap must be a non-negative integer.');
  if(own(constraints,'locale') && typeof constraints.locale!=='string')
    return answer('BLOCKED_POLICY','INVALID_LOCALE','Explicit locale must be a string.');
  const localeInput=own(constraints,'locale')?constraints.locale:(trusted.defaultLocale ?? 'und');
  const locale=localeTag(localeInput);
  if(!locale) return answer('BLOCKED_POLICY','INVALID_LOCALE','Invalid BCP 47 language tag.');

  const record=Object.freeze({
    schemaVersion:'g02-intake-v0.2',
    goalId:trusted.goalId,
    turnId:trusted.turnId,
    parentTurnId:trusted.parentTurnId ?? null,
    revision:trusted.revision,
    actorRef:trusted.actor.subject,
    tenantRef:trusted.actor.tenant,
    rawGoal, // INTERNAL ONLY; never log or hand to model; exact JS text, not HTTP bytes
    interpretationText,
    localeHint:Object.freeze({tag:locale,source:own(constraints,'locale')?'client_preference':own(trusted,'defaultLocale')?'server_default':'unknown'}),
    timeZoneHint:Object.freeze({id:trusted.timeZone ?? null,source:trusted.timeZone?'server_context':'unknown'}),
    deadlineText:own(constraints,'deadline')?constraints.deadline:null,
    budgetHint:Object.freeze({maxCostCents:own(constraints,'maxCostCents')?constraints.maxCostCents:null,source:own(constraints,'maxCostCents')?'client_cap':'unspecified'}),
    sourceRefs:Object.freeze(sources.map(s=>Object.freeze({kind:s.kind,ref:s.ref,trust:'UNVERIFIED_REFERENCE'}))),
    flags:Object.freeze({
      nfcChanged:nfc!==rawGoal,
      lineEndingsChanged:/\r/.test(rawGoal),
      bidiControlsPresent:/[\u202A-\u202E\u2066-\u2069]/u.test(rawGoal),
      invisibleFormattingPresent:/[\u200B-\u200D\u2060\uFEFF]/u.test(rawGoal),
      requiresSemanticClarification:!hasLetterOrNumber
    })
  });
  return answer('NORMALIZED','INTAKE_READY','Shape-only intake passed; no authorization, source validation or semantic understanding implied.',record);
}

/**
 * Explicitly allowlisted, non-authoritative view for the model.
 * Excludes rawGoal, actorRef, tenantRef, goalId, turnId and source handles.
 * Caller must still treat interpretationText as untrusted with respect to policy.
 */
export function projectForInterpreter(record) {
  if(!plain(record) || record.schemaVersion!=='g02-intake-v0.2' ||
     typeof record.interpretationText!=='string' || !Array.isArray(record.sourceRefs) ||
     !plain(record.localeHint) || !plain(record.timeZoneHint) ||
     !plain(record.budgetHint) || !plain(record.flags)) {
    return Object.freeze({status:'BLOCKED_POLICY',code:'INVALID_INTAKE_RECORD'});
  }
  return Object.freeze({
    schemaVersion:'g02-interpreter-view-v0.2',
    interpretationText:record.interpretationText,
    localeHint:Object.freeze({tag:record.localeHint.tag,source:record.localeHint.source}),
    timeZoneHint:Object.freeze({id:record.timeZoneHint.id,source:record.timeZoneHint.source}),
    deadlineText:record.deadlineText,
    budgetHint:Object.freeze({maxCostCents:record.budgetHint.maxCostCents,source:record.budgetHint.source}),
    sourceDescriptors:Object.freeze(record.sourceRefs.map((s,i)=>Object.freeze({slot:i,kind:s.kind,trust:'UNVERIFIED_REFERENCE'}))),
    flags:Object.freeze({requiresSemanticClarification:record.flags.requiresSemanticClarification})
  });
}

/**
 * Metadata-only predecessor check; NOT a database compare-and-swap.
 * Server must atomically enforce uniqueness and current revision in G07.
 */
export function assessTurnRevision(previous,next) {
  if(!plain(previous) || !plain(next) ||
     !id(previous.goalId) || !id(next.goalId) ||
     !id(previous.turnId) || !id(next.turnId) ||
     !id(previous.actorRef) || !id(next.actorRef) ||
     !id(previous.tenantRef) || !id(next.tenantRef) ||
     !Number.isSafeInteger(previous.revision) || !Number.isSafeInteger(next.revision) ||
     previous.goalId!==next.goalId ||
     previous.actorRef!==next.actorRef || previous.tenantRef!==next.tenantRef ||
     next.parentTurnId!==previous.turnId || next.revision!==previous.revision+1 ||
     previous.turnId===next.turnId) {
    return Object.freeze({status:'BLOCKED_POLICY',code:'INVALID_TURN_LINEAGE'});
  }
  return Object.freeze({
    status:'REVISION_REQUIRES_INTERPRETATION',
    code:'NEW_VERIFIED_TURN',
    invalidatePriorApprovals:true,
    recheckDependentPlan:true
  });
}
