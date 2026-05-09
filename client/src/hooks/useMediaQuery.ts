import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export type LayoutMode = 'desktop' | 'phone-portrait' | 'phone-landscape';

// Phones in landscape are short (≤500px tall); tablets in landscape are tall enough
// (≥600px) to use the desktop elliptical table comfortably.
export function useLayoutMode(): LayoutMode {
  const isDesktop = useMediaQuery('(min-width: 768px) and (min-height: 600px)');
  const isPhoneLandscape = useMediaQuery('(orientation: landscape) and (max-height: 500px)');
  if (isDesktop) return 'desktop';
  if (isPhoneLandscape) return 'phone-landscape';
  return 'phone-portrait';
}
