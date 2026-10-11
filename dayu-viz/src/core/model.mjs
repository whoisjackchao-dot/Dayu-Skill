// 模型骨架与状态规范化。零 IO、无时钟：parsedAt 必须由调用方注入。

export const UNKNOWN = 'unknown';

const CASE_STATES = [
  'NOT_APPLICABLE_APPROVED', 'NOT_RUN', 'BLOCKED', 'FAIL', 'PASS',
];

export function emptyProject(root, docsDir, parsedAt) {
  return {
    meta: { name: UNKNOWN, root, docsDir, parsedAt, inventory: [], warnings: [] },
    status: {
      phase: UNKNOWN,
      currentNode: UNKNOWN,
      sessionGoal: UNKNOWN,
      docVersion: UNKNOWN,
      handover: {
        updatedAt: UNKNOWN, completed: UNKNOWN, notCompleted: UNKNOWN,
        next: UNKNOWN, awaitingUser: UNKNOWN, dontReask: UNKNOWN, untrusted: UNKNOWN,
      },
    },
    requirements: [],
    gates: [],
    decisions: [],
    contracts: [],
    milestones: [],
    cases: [],
    trace: [],
    evidence: [],
    gaps: [],
    experiments: [],
    acceptance: [],
    redflags: [],
    agents: { sessionId: UNKNOWN, members: [], tasks: [], messages: [], subagents: [], stats: {} },
  };
}

export function addWarning(project, code, message, ref) {
  project.meta.warnings.push(ref ? { code, message, ref } : { code, message });
}

export function stripEmphasis(s) {
  return String(s ?? '').replace(/\*\*/g, '').replace(/`/g, '').trim();
}

export function normalizeDecisionState(text) {
  const t = stripEmphasis(text);
  if (!t) return UNKNOWN;
  if (t.includes('已批准')) return 'approved';
  if (t.includes('待批准')) return 'pending';
  if (t.includes('未决')) return 'undecided';
  return UNKNOWN;
}

export function normalizeCaseState(text) {
  const t = stripEmphasis(text).toUpperCase();
  if (!t) return UNKNOWN;
  // NOT_APPLICABLE_APPROVED 必须先匹配，否则会被 NOT_RUN 的包含关系误判
  for (const s of CASE_STATES) {
    if (t.includes(s)) return s;
  }
  return UNKNOWN;
}

export function extractIds(text, prefix) {
  const re = new RegExp(`\\b${prefix}(\\d{1,3})\\b`, 'g');
  const seen = new Set();
  const out = [];
  for (const m of String(text ?? '').matchAll(re)) {
    const id = `${prefix}${m[1]}`;
    if (!seen.has(id)) { seen.add(id); out.push(id); }
  }
  return out;
}

export function extractDate(text) {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(String(text ?? ''));
  return m ? m[1] : null;
}
