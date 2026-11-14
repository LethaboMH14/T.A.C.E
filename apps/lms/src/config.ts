// Public by design (LMS-SPEC.md): tables are deny-all, only the RPCs are callable with this key.
export const LMS_URL: string = (import.meta.env.VITE_LMS_URL as string | undefined) || 'https://biyneypnrnzhgyuibfwv.supabase.co';
export const LMS_KEY: string = (import.meta.env.VITE_LMS_KEY as string | undefined) || 'sb_publishable_7FY9SrZrkAPvNQjHGVgvlQ_O4jQSP_Y';
