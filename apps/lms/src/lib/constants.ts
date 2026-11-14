import type { Format, HelpCategory, Lang, StepType } from './types';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
export const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16] as const; // slot start hours; 16 is the 16:00-17:00 slot

export const LANGUAGES: { code: Lang; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'zu', name: 'isiZulu' },
  { code: 'xh', name: 'isiXhosa' },
  { code: 'af', name: 'Afrikaans' },
  { code: 'st', name: 'Sesotho' },
  { code: 'tn', name: 'Setswana' },
  { code: 'nso', name: 'Sepedi' },
  { code: 'ts', name: 'Xitsonga' },
  { code: 've', name: 'Tshivenda' },
  { code: 'ss', name: 'siSwati' },
  { code: 'nr', name: 'isiNdebele' },
];

export const FORMATS: { code: Format; name: string }[] = [
  { code: 'text', name: 'Text' },
  { code: 'visual', name: 'Visual' },
  { code: 'audio', name: 'Audio' },
];

export const HELP_CATEGORIES: { code: HelpCategory; name: string }[] = [
  { code: 'concept', name: 'An idea I do not get' },
  { code: 'assignment', name: 'An assignment' },
  { code: 'time', name: 'Time and planning' },
  { code: 'motivation', name: 'Motivation' },
  { code: 'access', name: 'Getting online or a device' },
  { code: 'other', name: 'Something else' },
];

export const STEP_TITLES: Record<StepType, string> = {
  worked_example: 'Worked example',
  parsons: 'Put the lines in order',
  retrieval_quiz: 'Quick recall',
  if_then_plan: 'If this, then that',
};

export const AI_NOTICE = 'What you type here may be processed by an AI model to write your plan. Don’t include personal details.';
export const DEMO_NOTICE = 'Don’t use your real full name. Demo data only.';
export const FLOW_NOTICE = 'Your marks and requests go to the coordinator’s T.A.C.E workspace. Demo data only.';
