import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeMarketplace, subscribeDrivers } from '../services/adminFirestoreService';
import { awardBid, rejectBid, postBooking, assignIndependentDriver } from '../services/marketplaceService';
import type { MarketplaceTrip, Driver } from '../types';
import { useCan } from '../components/AccessContext';

export default function Marketplace() {
  const canFinance = useCan('finance');
  const [trips, setTrips] = useState<MarketplaceTrip[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [expanded, setExpanded] = useState('');
  const [bids, setBids] = useState<Record<string, any>[]>([]);
  const [filter, setFilter] = useState('All');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [bookingCode, setBookingCode] = useState('');
  const [payout, setPayout] = useState('');
  const [driverId, setDriverId] = useState('');
  useEffect(() => { const a = subscribeMarketplace(setTrips), b = subscribeDrivers(setDrivers); return () => { a(); b(); }; }, []);
  useEffect(() => {
    setBids([]); setDriverId('');
    if (!expanded) return;
    return onSnapshot(collection(db, 'marketplace_trips', expanded, 'bids'), snap => setBids(snap.docs.map(d => ({ ...d.data(), id: d.id }))), () => setError('Could not load bids. Please retry.'));
  }, [expanded]);
  const act = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Action failed. Please retry.'); }
    finally { setBusy(false); }
  };
  const address = (v: any) => typeof v === 'string' ? v : v?.address || v?.city || '';
  return <div className="p-6 space-y-5">
    <h1 className="text-xl font-bold">Marketplace &amp; Bidding</h1>
    {error && <div role="alert" className="p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}
    <form className="bg-white border rounded-xl p-4 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void act(async () => { await postBooking(bookingCode, payout.trim() ? Number(payout) : null); setBookingCode(''); setPayout(''); }); }}>
      <label className="text-sm">Booking code / ID (fare verified)<input required value={bookingCode} onChange={e => setBookingCode(e.target.value)} className="block border p-2 rounded" /></label>
      {canFinance && <label className="text-sm">Partner payout (₹, optional)<input type="number" min="1" step="1" value={payout} onChange={e => setPayout(e.target.value)} placeholder="From commission policy" className="block border p-2 rounded" /></label>}
      <button disabled={busy} className="bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50">Post to marketplace</button>
      <p className="basis-full text-xs text-gray-500">The partner offer comes from the commission policy{canFinance ? ' unless you enter a payout (recorded as a manual payout)' : ''}.</p>
    </form>
    <label className="text-sm">Status <select value={filter} onChange={e => setFilter(e.target.value)} className="border p-2 rounded">{['All','Open','Bidding','Assigned','Closed'].map(s => <option key={s}>{s}</option>)}</select></label>
    {trips.filter(t => filter === 'All' || t.status === filter).map(t => <article key={t.id} className="bg-white border rounded-xl p-4 space-y-3">
      <div className="flex justify-between gap-3"><div><strong>{t.bookingId || t.id}</strong><p>{address(t.pickup)} → {address(t.drop)}</p></div><div>{t.status}<p>₹{Number(String(t.offeredPayout).replace(/[^\d.]/g,'')).toLocaleString('en-IN')}</p></div></div>
      <button className="text-red-600 font-semibold" onClick={() => setExpanded(expanded === t.id ? '' : t.id)}>{expanded === t.id ? 'Hide bids' : 'Review bids / assign'}</button>
      {expanded === t.id && <div className="border-t pt-3 space-y-3">
        {!bids.length && <p className="text-gray-500 text-sm">No bids received.</p>}
        {bids.map(b => <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 p-3 rounded"><span>{b.vendorName} · ₹{Number(b.vendorCounterRate || 0).toLocaleString('en-IN')} · {b.status}</span>
          {b.status === 'Pending Review' && ['Open','Bidding'].includes(t.status) && <div className="flex gap-3"><button disabled={busy} onClick={() => void act(() => awardBid(t.id, b.id))} className="text-green-700 font-semibold disabled:opacity-50">Award bid</button><button disabled={busy} onClick={() => void act(() => rejectBid(t.id, b.id))} className="text-red-700 disabled:opacity-50">Reject bid</button></div>}
        </div>)}
        {['Open','Bidding'].includes(t.status) && <div className="flex gap-3"><select aria-label="Independent driver" value={driverId} onChange={e => setDriverId(e.target.value)} className="border rounded p-2"><option value="">Choose available independent driver</option>{drivers.filter((d: any) => d.status === 'Approved' && d.presenceStatus === 'Online' && !d.vendorId && d.fleetStatus !== 'Suspended').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select><button disabled={busy || !driverId} onClick={() => void act(() => assignIndependentDriver(t.id, driverId))} className="text-red-600 disabled:opacity-50">Assign driver</button></div>}
      </div>}
    </article>)}
    {!trips.length && <p className="text-gray-500">No marketplace trips.</p>}
  </div>;
}
