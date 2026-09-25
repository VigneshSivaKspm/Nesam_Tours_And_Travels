import React from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export const NetworkBanner: React.FC = () => {
  const { online, recovered } = useNetworkStatus();
  if (online && !recovered) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 inset-x-0 z-[1200] text-center text-xs font-bold py-2 px-4 ${
        online ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-white'
      }`}
    >
      {online
        ? 'Back online — syncing your latest ride updates.'
        : 'You’re offline. Showing saved data; new requests will wait until you reconnect.'}
    </div>
  );
};
