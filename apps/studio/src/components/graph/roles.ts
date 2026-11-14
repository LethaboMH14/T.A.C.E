import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  CalendarDays,
  Database,
  FileText,
  ListChecks,
  Mail,
  Package,
  ShieldCheck,
  Target,
  TriangleAlert,
  Wrench,
} from 'lucide-react';

/** Glyph per role name (display role from the plan, or a fixed graph role). */
export const ROLE_ICON: Record<string, LucideIcon> = {
  Analyst: BarChart3,
  'Report Writer': FileText,
  'Support Planner': ListChecks,
  Scheduler: CalendarDays,
  'Message Writer': Mail,
  Reviewer: ShieldCheck,
  Repair: Wrench,
  Goal: Target,
  Sources: Database,
  Deliver: Package,
  Stopped: TriangleAlert,
};

export const iconFor = (role: string): LucideIcon => ROLE_ICON[role] ?? FileText;

/** Roster kind label. Message Writer is "model" only when the run uses a model. */
export function kindLabel(role: string, agentsMode: 'model' | 'code' | undefined): string {
  if (role === 'Reviewer') return 'independent';
  if (role === 'Repair') return 'on demand';
  if (role === 'Message Writer' && agentsMode === 'model') return 'model';
  return 'code';
}
