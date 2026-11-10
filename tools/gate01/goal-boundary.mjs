/** G01 contract spike: fail-closed boundary checks; NOT production authentication or authorization. */
const outputs = new Set(['txt','md','json','csv','xlsx','docx','pdf','pptx','html','diagram','image','audio','video','email_draft','calendar_proposal']);
const effects = new Set(['read_public','read_private','draft_local','write_local','write_shared','external_send','destructive']);
const allowedFields = new Set(['goal','sources','outputs','requestedActions','constraints']);
const result = (status, code, detail, extra = {}) => Object.freeze({status,code,detail,...extra});
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export function assessGoalBoundary(request, trusted = {}) {
  if (!object(request)) return result('AWAITING_INPUT','INVALID_REQUEST','Provide a goal as a structured request.');
  if (Object.keys(request).some(k => !allowedFields.has(k))) return result('BLOCKED_POLICY','UNTRUSTED_FIELD','Client requests cannot assert identity, approval, permissions or execution status.');
  const goal = request.goal;
  if (typeof goal !== 'string' || !goal.trim()) return result('AWAITING_INPUT','MISSING_GOAL','What outcome do you want to achieve?');
  if (goal.length > 6000) return result('BLOCKED_CAPABILITY','GOAL_TOO_LONG','Goal text exceeds the intake limit.');
  if (!object(trusted.identity) || typeof trusted.identity.subject !== 'string' || !trusted.identity.subject || typeof trusted.identity.tenant !== 'string' || !trusted.identity.tenant) return result('BLOCKED_POLICY','UNAUTHENTICATED','A server-verified identity is required for this execution admission.');
  const sources = request.sources ?? [];
  if (!Array.isArray(sources) || sources.length > 24 || sources.some(s => !object(s) || typeof s.kind !== 'string' || !['upload','public','connector'].includes(s.kind) || typeof s.ref !== 'string' || !s.ref)) return result('BLOCKED_CAPABILITY','INVALID_SOURCE','Unsupported source declarations.');
  const connected = new Set(Array.isArray(trusted.connected) ? trusted.connected : []);
  const notConnected = sources.find(s => s.kind === 'connector' && !connected.has(s.ref));
  if (notConnected) return result('BLOCKED_CAPABILITY','CONNECTOR_UNAVAILABLE','The requested app is not connected or permitted.');
  const files = request.outputs ?? [];
  if (!Array.isArray(files) || files.length > 16 || files.some(f => typeof f !== 'string' || !outputs.has(f))) return result('BLOCKED_CAPABILITY','INVALID_OUTPUT','A requested output format has no supported contract.');
  const supported = new Set(Array.isArray(trusted.supportedOutputs) ? trusted.supportedOutputs : []);
  const missingOutput = files.find(f => !supported.has(f));
  if (missingOutput) return result('BLOCKED_CAPABILITY','OUTPUT_TOOL_UNAVAILABLE',`No verified output tool is registered for ${missingOutput}.`);
  const constraints = request.constraints ?? {};
  if (!object(constraints) || Object.keys(constraints).some(k => !['maxCostCents','deadline','locale'].includes(k)) || (constraints.maxCostCents !== undefined && (!Number.isSafeInteger(constraints.maxCostCents) || constraints.maxCostCents < 0))) return result('BLOCKED_POLICY','INVALID_CONSTRAINTS','Invalid constraints or budget.');
  const actions = request.requestedActions ?? [];
  if (!Array.isArray(actions) || actions.length > 16 || actions.some(a => !object(a) || !effects.has(a.effect) || typeof a.target !== 'string' || !a.target)) return result('BLOCKED_POLICY','INVALID_ACTION','Unsupported or unscoped tool effect.');
  const dangerous = actions.filter(a => ['write_shared','external_send','destructive'].includes(a.effect));
  if (dangerous.some(a => a.effect === 'destructive')) return result('BLOCKED_POLICY','DESTRUCTIVE_DISABLED','Destructive actions are not available in the demonstration.');
  if (dangerous.length) return result('AWAITING_APPROVAL','EXACT_ACTION_APPROVAL_REQUIRED','The server must bind a verified approver to each exact immutable tool action before execution.',{proposedActions:dangerous.length});
  if (sources.some(s => s.kind === 'upload') && trusted.uploadsVerified !== true) return result('BLOCKED_CAPABILITY','UPLOAD_UNVERIFIED','Uploaded sources must pass server-side type, size, scope and malware policy checks.');
  return result('PLANNED','BOUNDARY_ADMITTED','Admission checks passed for drafting; actual execution requires independent downstream policy, tools and validation.',{sourceCount:sources.length,outputCount:files.length});
}
