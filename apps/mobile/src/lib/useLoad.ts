// Loads data for a screen and reloads it whenever the screen comes back into
// view (e.g. after adding an event). Keeps the old data on screen while
// refreshing, so there's no flicker.
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const seq = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    const id = ++seq.current;
    setError(null);
    load()
      .then((d) => id === seq.current && setData(d))
      .catch((e: Error) => id === seq.current && setError(e));
  }, deps);

  useFocusEffect(run);
  return { data, error, reload: run };
}
