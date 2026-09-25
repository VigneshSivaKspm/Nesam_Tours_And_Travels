import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DevicePosition,
  LocationError,
  getCurrentPosition,
  getLocationPermission,
  watchPosition,
  PermissionStateLite,
} from '../services/geoService';

export interface DeviceLocationState {
  position: DevicePosition | null;
  error: LocationError | null;
  permission: PermissionStateLite;
  locating: boolean;
  /** One-shot high-accuracy fix (e.g. "locate me" button). */
  locate: () => Promise<DevicePosition | null>;
}

/**
 * Keeps a live device position while mounted (`watch`), and exposes a
 * one-shot `locate()` for explicit user requests. Permission changes made in
 * browser settings are picked up without a reload.
 */
export function useDeviceLocation(watch = true): DeviceLocationState {
  const [position, setPosition] = useState<DevicePosition | null>(null);
  const [error, setError] = useState<LocationError | null>(null);
  const [permission, setPermission] = useState<PermissionStateLite>('unknown');
  const [locating, setLocating] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let status: PermissionStatus | null = null;
    const onChange = () => status && setPermission(status.state as PermissionStateLite);
    getLocationPermission().then(setPermission);
    navigator.permissions
      ?.query({ name: 'geolocation' as PermissionName })
      .then((s) => {
        status = s;
        s.addEventListener('change', onChange);
      })
      .catch(() => undefined);
    return () => {
      mounted.current = false;
      status?.removeEventListener('change', onChange);
    };
  }, []);

  useEffect(() => {
    if (!watch || permission === 'denied') return undefined;
    return watchPosition(
      (p) => {
        setPosition(p);
        setError(null);
      },
      (e) => setError(e),
    );
  }, [watch, permission]);

  const locate = useCallback(async () => {
    setLocating(true);
    try {
      const p = await getCurrentPosition();
      if (mounted.current) {
        setPosition(p);
        setError(null);
      }
      return p;
    } catch (e) {
      if (mounted.current) setError(e as LocationError);
      return null;
    } finally {
      if (mounted.current) setLocating(false);
    }
  }, []);

  return { position, error, permission, locating, locate };
}
