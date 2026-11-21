// Language + right-to-left support.
// Arabic is the default. The choice is saved on the phone and applied
// instantly: the whole layout flips direction without restarting the app.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nManager } from 'react-native';
import { strings, type Locale, type Strings } from './strings';

const KEY = 'yahal.locale';

// We flip the layout ourselves (see Row / Txt in components/ui.tsx) so the
// language can change instantly without restarting the app. That means the
// system-wide RTL switch must stay OFF, or Arabic phones would flip twice.
// Trade-off: the native navigation header keeps its back button on the left.
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

type I18n = {
  locale: Locale;
  isRTL: boolean;
  t: Strings;
  /** null until we know whether the parent picked a language before */
  hasChosen: boolean | null;
  setLocale: (l: Locale) => void;
};

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ar');
  const [hasChosen, setHasChosen] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'ar' || v === 'en') setLocaleState(v);
        setHasChosen(v === 'ar' || v === 'en');
      })
      .catch(() => setHasChosen(false));
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setHasChosen(true);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);

  const value = useMemo<I18n>(
    () => ({ locale, isRTL: locale === 'ar', t: strings[locale], hasChosen, setLocale }),
    [locale, hasChosen, setLocale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside I18nProvider');
  return v;
}

/** Arabic month names / numbers via the built-in Intl API. */
export function formatDay(day: string | Date, locale: Locale, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const d = typeof day === 'string' ? new Date(`${day}T00:00:00`) : day;
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-KW' : 'en-GB', opts).format(d);
}

export function formatTime(d: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-KW' : 'en-GB', { hour: 'numeric', minute: '2-digit' }).format(d);
}
