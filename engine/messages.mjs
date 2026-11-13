// Typed agent-to-agent messages (zod). Contract: engine/AGENTS-SPEC.md section 2.
// Every message is validated before it is emitted. Invalid input throws BAD_MESSAGE.
import { z } from 'zod';
import { EVENT } from './contracts.mjs';

export const AgentMessage = z.object({
  id: z.string().regex(/^M-\d{3,}$/),
  type: z.enum(['REQUEST', 'RESULT', 'CHALLENGE', 'DECISION', 'ESCALATE']),
  from: z.string().min(1).max(40),
  to: z.string().min(1).max(40),
  about: z.object({
    artifact: z.string().optional(),
    digest: z.string().optional(),
    checkId: z.string().optional(),
  }).strict().optional(),
  reason: z.string().min(1).max(500),
  body: z.unknown().optional(),
}).strict();

function badMessage(parsed) {
  const issues = parsed.error.issues
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
  const err = new Error(`BAD_MESSAGE: ${issues}`);
  err.code = 'BAD_MESSAGE';
  err.issues = parsed.error.issues;
  return err;
}

export function createMessenger(emit = () => {}) {
  const sent = [];
  let seq = 0;

  return {
    /**
     * @param {{type, from, to, about?, reason, body?}} input
     * @returns the validated message, with the next id (M-001, M-002, ...)
     */
    send(input) {
      if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        const err = new Error('BAD_MESSAGE: input must be an object');
        err.code = 'BAD_MESSAGE';
        throw err;
      }
      if ('id' in input) {
        const err = new Error('BAD_MESSAGE: id is assigned by the messenger, not the caller');
        err.code = 'BAD_MESSAGE';
        throw err;
      }
      const id = `M-${String(seq + 1).padStart(3, '0')}`;
      const parsed = AgentMessage.safeParse({ ...input, id });
      if (!parsed.success) throw badMessage(parsed);

      const msg = parsed.data;
      seq += 1;
      sent.push(msg);
      emit(EVENT.AGENT_MESSAGE, msg, { taskId: null, role: msg.from });
      return msg;
    },
    list() {
      return sent.slice();
    },
  };
}
