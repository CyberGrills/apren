import { useEffect, useState } from 'react';

export type SevenLanguage = 'en' | 'pcm';

export function readSevenLanguage(): SevenLanguage {
  try {
    return window.localStorage.getItem('7even-language-style') === 'pcm' ? 'pcm' : 'en';
  } catch {
    return 'en';
  }
}

export function useSevenLanguage(): SevenLanguage {
  const [language, setLanguage] = useState<SevenLanguage>(readSevenLanguage);
  useEffect(() => {
    const sync = (event: Event) => {
      const next = (event as CustomEvent<SevenLanguage>).detail;
      if (next === 'en' || next === 'pcm') setLanguage(next);
    };
    window.addEventListener('7even-language-change', sync);
    return () => window.removeEventListener('7even-language-change', sync);
  }, []);
  return language;
}

export function sevenCopy(language: SevenLanguage, english: string, pidgin: string): string {
  return language === 'pcm' ? pidgin : english;
}
