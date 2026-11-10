/**
 * T.A.C.E G02.01 deterministic intake spike.
 * NOT production auth, secure parsing, LLM interpretation or an executor.
 */
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const isRecord = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const allowedRequest = new Set(['goal','sources','constraints']);
const allowedConstraints = new Set(['locale','deadline','maxCostCents']);
const allowedSource = new Set(['kind','ref']);
const response = (status,code,detail,data) => Object.freeze({
  status,code,detail,...(data ? {record:data} : {})
});
const nonempty = (s,max=200) => typeof s==='string' && s.length>0 && s.length<=max;
const localeTag = s => {try {const tags=Intl.getCanonicalLocales(s);return tags.length===1?tags[0]:null;}catch{return null;}};
const zoneIsValid = s => {try{new Intl.DateTimeFormat('en-US',{timeZone:s});return true;}catch{return false;}};

export function normalizeGoalTurn(request,trusted={}) {
  if (!isRecord(request)) return response('AWAITING_INPUT','INVALID_REQUEST','Provide a structured goal request.');
  if (Object.keys(request).some(k=>!allowedRequest.has(k))) return response('BLOCKED_POLICY','CLIENT_AUTHORITY_FIELD','Client requests cannot assert actor, approval or turn identity.');
  if (!isRecord(trusted) || !isRecord(trusted.actor) || !nonempty(trusted.actor.subject) ||
      !nonempty(trusted.actor.tenant) || !nonempty(trusted.turnId) ||
      !Number.isSafeInteger(trusted.revision) || trusted.revision<1 ||
      (trusted.parentTurnId!==undefined && trusted.parentTurnId!==null && !nonempty(trusted.parentTurnId))) {
    return response('BLOCKED_POLICY','UNATTESTED_TURN','A server-attested actor, tenant, turn and revision are required.');
  }
  const rawGoal=request.goal;
  if (typeof rawGoal!=='string') return response('AWAITING_INPUT','MISSING_GOAL','Describe the desired outcome.');
  if (rawGoal.length>6000) return response('BLOCKED_CAPABILITY','GOAL_TOO_LONG','Goal exceeds the intake limit.');
  if (rawGoal.includes('\u0000')) return response('BLOCKED_POLICY','NULL_BYTE','Goal contains a null byte.');
  const nfc=rawGoal.normalize('NFC');
  const interpretationText=nfc.replace(/\r\n?/g,'\n');
  if (!/[\p{L}\p{N}]/u.test(interpretationText)) return response('AWAITING_INPUT','MISSING_GOAL','Describe the outcome in words or numbers.');
  const sources=request.sources ?? [];
  if (!Array.isArray(sources) || sources.length>24 || sources.some(s=>!isRecord(s) ||
      Object.keys(s).some(k=>!allowedSource.has(k)) ||
      !['upload','public','connector'].includes(s.kind) || !nonempty(s.ref,500))) {
    return response('BLOCKED_CAPABILITY','INVALID_SOURCE_REFERENCE','Only typed opaque source references may enter intake.');
  }
  const constraints=request.constraints ?? {};
  if (!isRecord(constraints) || Object.keys(constraints).some(k=>!allowedConstraints.has(k)) ||
      (own(constraints,'deadline') && (typeof constraints.deadline!=='string' || constraints.deadline.length>200)) ||
      (own(constraints,'maxCostCents') && (!Number.isSafeInteger(constraints.maxCostCents) || constraints.maxCostCents<0))) {
    return response('BLOCKED_POLICY','INVALID_CONSTRAINTS','Unsupported constraints or invalid values.');
  }
  const localeInput=constraints.locale ?? trusted.defaultLocale ?? 'und';
  if (typeof localeInput!=='string') return response('BLOCKED_POLICY','INVALID_LOCALE','Invalid language tag.');
  const locale=localeTag(localeInput);
  if (!locale) return response('BLOCKED_POLICY','INVALID_LOCALE','Invalid BCP 47 language tag.');
  if (trusted.timeZone!==undefined && trusted.timeZone!==null &&
      (typeof trusted.timeZone!=='string' || !zoneIsValid(trusted.timeZone))) {
    return response('BLOCKED_POLICY','INVALID_TIME_ZONE','Invalid server time-zone identifier.');
  }
  const record=Object.freeze({
    schemaVersion:'g02-intake-v0.1',
    turnId:trusted.turnId,
    parentTurnId:trusted.parentTurnId ?? null,
    revision:trusted.revision,
    actorRef:trusted.actor.subject,
    tenantRef:trusted.actor.tenant,
    rawGoal,
    interpretationText,
    localeHint:Object.freeze({tag:locale,source:own(constraints,'locale')?'client_preference':trusted.defaultLocale?'server_default':'unknown'}),
    timeZoneHint:Object.freeze({id:trusted.timeZone ?? null,source:trusted.timeZone?'server_context':'unknown'}),
    deadlineText:constraints.deadline ?? null,
    sourceRefs:Object.freeze(sources.map(s=>Object.freeze({kind:s.kind,ref:s.ref,trust:'UNVERIFIED_REFERENCE'}))),
    flags:Object.freeze({
      nfcChanged:nfc!==rawGoal,
      lineEndingsChanged:/\r/.test(rawGoal),
      bidiControlsPresent:/[\u202A-\u202E\u2066-\u2069]/u.test(rawGoal),
      invisibleFormattingPresent:/[\u200B-\u200D\u2060\uFEFF]/u.test(rawGoal)
    })
  });
  return response('NORMALIZED','INTAKE_READY','Deterministic intake passed; no permission or source safety is implied.',record);
}

/**
 * Metadata-only lineage check. Does not infer semantic changes.
 * Any new turn conservatively invalidates prior approvals.
 */
export function assessTurnRevision(previous,next) {
  if (!isRecord(previous) || !isRecord(next) ||
      !nonempty(previous.turnId) || !nonempty(next.turnId) ||
      !nonempty(previous.actorRef) || !nonempty(next.actorRef) ||
      !nonempty(previous.tenantRef) || !nonempty(next.tenantRef) ||
      !Number.isSafeInteger(previous.revision) || !Number.isSafeInteger(next.revision) ||
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
