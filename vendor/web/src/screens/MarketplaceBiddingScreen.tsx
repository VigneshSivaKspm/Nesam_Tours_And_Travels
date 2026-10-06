import React, { useState } from 'react';
import { formatDateTime12 } from '../utils/time';
import { OpenTrip, BidProposal } from '../types';
import { Gavel, CheckCircle } from 'lucide-react';

interface MarketplaceBiddingScreenProps {
  openTrips: OpenTrip[];
  bidProposals: BidProposal[];
  onAcceptOfferedRate: (trip: OpenTrip) => Promise<void>;
  onSubmitCounterBid: (trip: OpenTrip, counterRate: number, note: string) => Promise<void>;
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const when = (d: Date | null) => (d ? formatDateTime12(d) : '—');

const bidStyle: Record<string, string> = {
  'Pending Review': 'bg-amber-100 text-amber-800 border-amber-300',
  Accepted: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
};

export const MarketplaceBiddingScreen: React.FC<MarketplaceBiddingScreenProps> = ({
  openTrips,
  bidProposals,
  onAcceptOfferedRate,
  onSubmitCounterBid
}) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'mybids'>('feed');
  const [selectedTripForBid, setSelectedTripForBid] = useState<OpenTrip | null>(null);
  const [counterRate, setCounterRate] = useState<string>('');
  const [bidNote, setBidNote] = useState<string>('');
  const [bidError, setBidError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [acceptingId, setAcceptingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const pendingFor = (tripId: string) => bidProposals.some(b => b.tripId === tripId && b.status === 'Pending Review');

  const handleOpenBidModal = (trip: OpenTrip) => {
    setSelectedTripForBid(trip);
    setCounterRate('');
    setBidNote('');
    setBidError('');
  };

  const handleAccept = async (trip: OpenTrip) => {
    if (acceptingId) return;
    setAcceptingId(trip.id);
    setError('');
    try {
      await onAcceptOfferedRate(trip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept this trip. Please retry.');
    } finally {
      setAcceptingId('');
    }
  };

  const handleConfirmCounterBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripForBid || submitting) return;
    const rate = Number(counterRate);
    if (!Number.isSafeInteger(rate) || rate <= 0) return setBidError('Enter your payout in whole rupees.');
    if (!bidNote.trim()) return setBidError('Add a short note for the NESAM team.');
    setSubmitting(true);
    setBidError('');
    try {
      await onSubmitCounterBid(selectedTripForBid, rate, bidNote);
      setNotice(`Counter bid of ${rupees(rate)} submitted for ${selectedTripForBid.bookingId}. NESAM operations will review it.`);
      setSelectedTripForBid(null);
    } catch (err) {
      setBidError(err instanceof Error ? err.message : 'The bid was not submitted. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">

      {/* Top Hero Header */}
      <div className="bg-[#111111] text-white p-6 rounded-2xl border border-[#262626] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#E21E26]">OPEN TRIP MARKETPLACE</span>
          <h1 className="text-xl font-extrabold mt-0.5">Marketplace & Bidding</h1>
          <p className="text-xs text-gray-400">Accept the platform’s offered payout or propose your own for NESAM to review</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[#1A1A1A] p-1.5 rounded-xl border border-[#333] shrink-0">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'feed' ? 'bg-[#E21E26] text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            Open Trip Feed ({openTrips.length})
          </button>
          <button
            onClick={() => setActiveTab('mybids')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'mybids' ? 'bg-[#E21E26] text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            My Bids ({bidProposals.length})
          </button>
        </div>
      </div>

      {notice && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {error && <div role="alert" className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl text-xs font-semibold">{error}</div>}

      {/* TAB 1: OPEN TRIP MARKETPLACE FEED */}
      {activeTab === 'feed' && (
        <div className="space-y-4">
          {openTrips.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
              <div className="text-4xl mb-3">📭</div>
              <div className="text-[15px] font-bold text-[#111] mb-1">No Open Trips</div>
              <div className="text-[13px] text-[#999]">New trip requests will appear here when available.</div>
            </div>
          ) : (
            openTrips.map(trip => (
              <div key={trip.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:border-[#E21E26] transition-all space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gray-900">{trip.bookingId}</span>
                      {trip.vehicleCategory && (
                        <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px]">
                          Required: {trip.vehicleCategory}
                        </span>
                      )}
                    </div>
                    <h2 className="text-base font-extrabold text-gray-900 mt-1">{trip.route || 'Route not recorded'}</h2>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-gray-500 font-medium">Offered Partner Payout</span>
                    <p className="text-2xl font-black text-[#E21E26]">{trip.offeredPayout !== null ? rupees(trip.offeredPayout) : 'Under review'}</p>
                    {trip.distanceKm !== null && <span className="text-[10px] text-gray-400 block font-mono">Distance: {trip.distanceKm} km</span>}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 text-xs text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-700">Pickup Location</span>
                    <p className="font-semibold text-gray-900">{trip.pickup.address || '—'}{trip.pickup.city && trip.pickup.city !== trip.pickup.address ? ` (${trip.pickup.city})` : ''}</p>
                    {trip.pickup.time && <p className="text-[11px] text-gray-500">Pickup Time: <span className="font-bold text-gray-800">{trip.pickup.time}</span></p>}
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-red-700">Drop Destination</span>
                    <p className="font-semibold text-gray-900">{trip.drop.address || '—'}{trip.drop.city && trip.drop.city !== trip.drop.address ? ` (${trip.drop.city})` : ''}</p>
                    {trip.travelDate && <p className="text-[11px] text-gray-500">Travel Date: <span className="font-bold text-gray-800">{trip.travelDate}</span></p>}
                  </div>
                </div>

                {/* Bidding Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                  {pendingFor(trip.id) ? (
                    <span className="text-xs font-semibold text-amber-700">Your bid is awaiting review</span>
                  ) : (
                    <button
                      onClick={() => handleOpenBidModal(trip)}
                      className="w-full sm:w-auto px-5 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Gavel className="w-4 h-4 text-amber-400" /> Submit Counter Bid
                    </button>
                  )}

                  <button
                    onClick={() => void handleAccept(trip)}
                    disabled={trip.offeredPayout === null || !!acceptingId}
                    title={trip.offeredPayout === null ? 'This trip’s payout is being reviewed by NESAM.' : undefined}
                    className="w-full sm:w-auto px-6 py-2.5 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-extrabold rounded-xl shadow flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {acceptingId === trip.id ? 'Accepting…' : trip.offeredPayout !== null ? `Accept at ${rupees(trip.offeredPayout)}` : 'Accept unavailable'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: MY SUBMITTED COUNTER BIDS */}
      {activeTab === 'mybids' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Gavel className="w-5 h-5 text-[#E21E26]" /> Counter Bid Status
          </h2>

          {bidProposals.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center italic">No counter bids submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {bidProposals.map(bid => (
                <div key={bid.id} className="p-4 bg-gray-50 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gray-900">{bid.bookingId || bid.tripId}</span>
                      <span className="text-[10px] text-gray-500 font-mono">({when(bid.submittedAt)})</span>
                    </div>
                    {bid.biddingNote && <p className="text-xs text-gray-600 mt-1">Note: “{bid.biddingNote}”</p>}
                    <div className="flex items-center gap-4 text-xs mt-2">
                      <span className="text-gray-500">Offered: <span className="font-bold text-gray-800">{bid.offeredPayout !== null ? rupees(bid.offeredPayout) : '—'}</span></span>
                      <span className="text-gray-500">Your bid: <span className="font-bold text-[#E21E26]">{rupees(bid.vendorCounterRate)}</span></span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${bidStyle[bid.status] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                      ● {bid.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* COUNTER BID MODAL */}
      {selectedTripForBid && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Submit Counter Bid</h3>
                <p className="text-xs text-gray-500 font-mono">Trip: {selectedTripForBid.bookingId}</p>
              </div>
              <button onClick={() => setSelectedTripForBid(null)} className="text-gray-400 hover:text-gray-700 text-sm font-bold">✕</button>
            </div>

            {bidError && <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">{bidError}</div>}

            <form onSubmit={handleConfirmCounterBid} className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-xl border text-xs space-y-1">
                <p className="text-gray-600">Route: <span className="font-bold text-gray-900">{selectedTripForBid.route || '—'}</span></p>
                <p className="text-gray-600">Offered payout: <span className="font-bold text-gray-900">{selectedTripForBid.offeredPayout !== null ? rupees(selectedTripForBid.offeredPayout) : 'Under review'}</span></p>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Your Proposed Payout (₹)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={counterRate}
                  onChange={e => { setCounterRate(e.target.value); setBidError(''); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg font-mono font-bold text-[#E21E26]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Note to NESAM Operations</label>
                <textarea
                  value={bidNote}
                  onChange={e => { setBidNote(e.target.value); setBidError(''); }}
                  placeholder="Why this payout — vehicle, driver experience, route conditions…"
                  maxLength={300}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium h-20"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setSelectedTripForBid(null)} disabled={submitting} className="px-4 py-2 border text-xs font-bold text-gray-700 rounded-xl">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-6 py-2 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow disabled:opacity-50">
                  {submitting ? 'Submitting…' : 'Confirm Counter Bid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
