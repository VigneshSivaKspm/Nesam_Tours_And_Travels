import { useEffect, useState } from 'react';

/** Tracks browser connectivity. `recovered` is true briefly after reconnecting. */
export function useNetworkStatus(): { online: boolean; recovered: boolean } {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [recovered, setRecovered] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const up = () => {
      setOnline(true);
      setRecovered(true);
      clearTimeout(timer);
      timer = setTimeout(() => setRecovered(false), 3000);
    };
    const down = () => {
      setOnline(false);
      setRecovered(false);
    };
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      clearTimeout(timer);
    };
  }, []);

  return { online, recovered };
}
