export type Kind = 'learner' | 'mentor';
export type Format = 'text' | 'visual' | 'audio';
export type Lang = 'en' | 'zu' | 'xh' | 'af' | 'st' | 'tn' | 'nso' | 'ts' | 've' | 'ss' | 'nr';
export type HelpCategory = 'concept' | 'assignment' | 'time' | 'motivation' | 'access' | 'other';

export interface Profile {
  id: string;
  kind: Kind;
  display_name: string;
  claimed: boolean;
}

export interface Latest {
  score: number;
  minutes: number;
  source: string;
  at: string;
}

export interface Skill {
  id: string;
  name: string;
  threshold: number;
  latest: Latest | null;
}

export interface Window {
  day: string;
  start: string;
  end: string;
}

export interface Me {
  profile: {
    id: string;
    kind: Kind;
    display_name: string;
    prefs: { format: Format; language: Lang };
    mentor_skills?: unknown;
    capacity?: number | null;
  };
  skills: Skill[];
  help: unknown[];
  availability: Window[];
  unread: number;
  contact?: { email: string | null; phone: string | null; consent_at: string | null } | null;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
}

export interface QuizReview {
  id: string;
  your: number;
  right: number;
  explanation: string;
}

export interface QuizResult {
  score: number;
  correct: number;
  total: number;
  review: QuizReview[];
}

export interface Message {
  id: string;
  run_id: string;
  kind: string;
  subject: string;
  body: string;
  format: Format | string;
  language: Lang | string;
  payload: MessagePayload | null;
  at: string;
  read: boolean;
}

export type StepType = 'worked_example' | 'parsons' | 'retrieval_quiz' | 'if_then_plan';

export interface MessagePayload {
  skills?: { id: string; name: string; score: number; threshold: number }[];
  steps?: ({ type?: StepType; title?: string; body?: string; why?: string; when?: string; with?: string } | string)[];
  machine_translated?: boolean;
  reviewer_note?: string;
  session?: { mentor?: string; day_label?: string; day?: string; start?: string; end?: string };
}
