import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_ATTRIBUTION, MAP_TILE_URL, DEFAULT_CENTER } from '../config/constants';
import { LatLng } from '../types';
import { isValidLatLng } from '../utils/geo';

export interface MapMarkerDriver extends LatLng {
  heading: number | null;
  label?: string;
  stale?: boolean;
}

interface RideMapProps {
  className?: string;
  /** Show a fixed pin at the map centre and report the centre after each pan. */
  centerPin?: boolean;
  onCenterChange?: (p: LatLng) => void;
  pickup?: LatLng | null;
  drop?: LatLng | null;
  driver?: MapMarkerDriver | null;
  nearby?: (LatLng & { id: string; heading: number | null })[];
  userLocation?: (LatLng & { accuracy: number }) | null;
  route?: [number, number][] | null;
  /** Change this value to re-fit the view to pickup/drop/driver/route. */
  fitKey?: string;
  /** Change `key` to pan/zoom the map to `point`. */
  panTo?: { point: LatLng; key: number; zoom?: number } | null;
  children?: React.ReactNode;
}

const carSvg = (color: string) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="${color}" stroke="#fff" stroke-width="1.2" d="M12 2c-2.2 0-3.6 1.2-4 3l-1 4.5V19a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 17 19V9.5L16 5c-.4-1.8-1.8-3-4-3z"/><path fill="#fff" opacity=".85" d="M8.6 9.2h6.8l-.7-3.1c-.2-.9-1.1-1.6-2.7-1.6s-2.5.7-2.7 1.6z"/></svg>`;

const icons = {
  pickup: L.divIcon({
    className: '',
    html: '<div class="nt-pin nt-pin-pickup"><span></span></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  }),
  drop: L.divIcon({
    className: '',
    html: '<div class="nt-pin nt-pin-drop"><span></span></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  }),
  user: L.divIcon({ className: '', html: '<div class="nt-user-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
};

function carIcon(heading: number | null, color: string, extraClass = '') {
  return L.divIcon({
    className: '',
    html: `<div class="nt-car ${extraClass}" style="transform: rotate(${heading ?? 0}deg)">${carSvg(color)}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export const RideMap: React.FC<RideMapProps> = ({
  className = 'h-72',
  centerPin = false,
  onCenterChange,
  pickup,
  drop,
  driver,
  nearby = [],
  userLocation,
  route,
  fitKey,
  panTo,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layers = useRef<{
    pickup?: L.Marker;
    drop?: L.Marker;
    driver?: L.Marker;
    user?: L.Marker;
    accuracy?: L.Circle;
    route?: L.Polyline;
    nearby: Map<string, L.Marker>;
  }>({ nearby: new Map() });
  const centerCb = useRef(onCenterChange);
  centerCb.current = onCenterChange;
  const pinRef = useRef<HTMLDivElement>(null);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return undefined;
    const start = pickup && isValidLatLng(pickup) ? pickup : DEFAULT_CENTER;
    const map = L.map(containerRef.current, {
      center: [start.lat, start.lng],
      zoom: pickup ? 16 : 12,
      zoomControl: false,
      attributionControl: true,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer(MAP_TILE_URL, { attribution: MAP_ATTRIBUTION, maxZoom: 19, subdomains: 'abc' }).addTo(map);
    mapRef.current = map;

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layers.current = { nearby: new Map() };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Centre-pin mode: report the centre after the user pans.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !centerPin) return undefined;
    const lift = () => pinRef.current?.classList.add('nt-center-pin-lifted');
    const settle = () => {
      pinRef.current?.classList.remove('nt-center-pin-lifted');
      const c = map.getCenter();
      centerCb.current?.({ lat: c.lat, lng: c.lng });
    };
    map.on('movestart', lift);
    map.on('moveend', settle);
    return () => {
      map.off('movestart', lift);
      map.off('moveend', settle);
    };
  }, [centerPin]);

  // Pickup / drop markers (pickup marker hidden while the centre pin stands in for it).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sync = (key: 'pickup' | 'drop', p: LatLng | null | undefined, show: boolean) => {
      const existing = layers.current[key];
      if (!show || !p || !isValidLatLng(p)) {
        existing?.remove();
        layers.current[key] = undefined;
        return;
      }
      if (existing) existing.setLatLng([p.lat, p.lng]);
      else layers.current[key] = L.marker([p.lat, p.lng], { icon: icons[key], keyboard: false }).addTo(map);
    };
    sync('pickup', pickup, !centerPin);
    sync('drop', drop, true);
  }, [pickup?.lat, pickup?.lng, drop?.lat, drop?.lng, centerPin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Assigned driver.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const existing = layers.current.driver;
    if (!driver || !isValidLatLng(driver)) {
      existing?.remove();
      layers.current.driver = undefined;
      return;
    }
    const icon = carIcon(driver.heading, driver.stale ? '#9CA3AF' : '#111827', 'nt-car-driver');
    if (existing) {
      existing.setLatLng([driver.lat, driver.lng]);
      existing.setIcon(icon);
    } else {
      layers.current.driver = L.marker([driver.lat, driver.lng], { icon, zIndexOffset: 1000, keyboard: false }).addTo(map);
    }
    if (driver.label) layers.current.driver!.bindTooltip(driver.label, { direction: 'top', offset: [0, -12] });
  }, [driver?.lat, driver?.lng, driver?.heading, driver?.stale, driver?.label]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nearby (anonymous) cars.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = layers.current.nearby;
    const seen = new Set<string>();
    for (const n of nearby.slice(0, 40)) {
      if (!isValidLatLng(n)) continue;
      seen.add(n.id);
      const m = current.get(n.id);
      if (m) {
        m.setLatLng([n.lat, n.lng]);
        m.setIcon(carIcon(n.heading, '#4B5563'));
      } else current.set(n.id, L.marker([n.lat, n.lng], { icon: carIcon(n.heading, '#4B5563'), interactive: false, keyboard: false }).addTo(map));
    }
    for (const [id, m] of current) {
      if (!seen.has(id)) {
        m.remove();
        current.delete(id);
      }
    }
  }, [nearby]);

  // Device location dot + accuracy ring.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const l = layers.current;
    if (!userLocation || !isValidLatLng(userLocation)) {
      l.user?.remove();
      l.accuracy?.remove();
      l.user = l.accuracy = undefined;
      return;
    }
    const ll: L.LatLngExpression = [userLocation.lat, userLocation.lng];
    const radius = Math.min(userLocation.accuracy, 500);
    if (l.user) l.user.setLatLng(ll);
    else l.user = L.marker(ll, { icon: icons.user, interactive: false, keyboard: false }).addTo(map);
    if (l.accuracy) l.accuracy.setLatLng(ll).setRadius(radius);
    else
      l.accuracy = L.circle(ll, { radius, color: '#2563EB', weight: 1, opacity: 0.4, fillOpacity: 0.08, interactive: false }).addTo(map);
  }, [userLocation?.lat, userLocation?.lng, userLocation?.accuracy]); // eslint-disable-line react-hooks/exhaustive-deps

  // Route polyline.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layers.current.route?.remove();
    layers.current.route = undefined;
    if (route && route.length > 1) {
      layers.current.route = L.polyline(route, { color: '#E31E24', weight: 5, opacity: 0.85, lineJoin: 'round' }).addTo(map);
    }
  }, [route]);

  // Fit the view when asked.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitKey === undefined) return;
    const pts: L.LatLngExpression[] = [];
    for (const p of [pickup, drop, driver]) if (p && isValidLatLng(p)) pts.push([p.lat, p.lng]);
    if (route && route.length > 1) {
      const b = L.latLngBounds(route);
      pts.push(b.getNorthEast(), b.getSouthWest());
    }
    if (pts.length === 1) map.setView(pts[0]!, 16, { animate: true });
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 16, animate: true });
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Programmatic pan.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !panTo || !isValidLatLng(panTo.point)) return;
    map.setView([panTo.point.lat, panTo.point.lng], panTo.zoom ?? Math.max(map.getZoom(), 16), { animate: true });
  }, [panTo?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`relative w-full overflow-hidden bg-[#EAE8E3] ${className}`}>
      <div ref={containerRef} className="absolute inset-0 z-0" role="application" aria-label="Map" />
      {centerPin && (
        <div ref={pinRef} className="nt-center-pin pointer-events-none absolute left-1/2 top-1/2 z-[500]" aria-hidden="true">
          <div className="nt-center-pin-head" />
          <div className="nt-center-pin-stem" />
          <div className="nt-center-pin-shadow" />
        </div>
      )}
      {children}
    </div>
  );
};
