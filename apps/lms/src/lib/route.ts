import { useEffect, useState } from 'react';

export function useRoute(): string[] {
  const read = () => window.location.hash.replace(/^#/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const on = () => setParts(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts;
}

export const go = (path: string) => {
  window.location.hash = path;
};
