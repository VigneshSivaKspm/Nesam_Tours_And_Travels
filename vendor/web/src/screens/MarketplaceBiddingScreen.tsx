import React, { useState } from 'react';
import { OpenTrip, BidProposal } from '../types';
import { Gavel, CheckCircle, Clock, Send, ShieldCheck, MapPin, AlertCircle, ArrowUpRight } from 'lucide-react';

interface MarketplaceBiddingScreenProps {
  openTrips: OpenTrip[];
  bidProposals: BidProposal[];
  onAcceptOfferedRate: (trip: OpenTrip) => void;
  onSubmitCounterBid: (trip: OpenTrip, counterRate: number, note: string) => void;
}

export const MarketplaceBiddingScreen: React.FC<MarketplaceBiddingScreenProps> = ({
  openTrips,
  bidProposals,
  onAcceptOfferedRate,
  onSubmitCounterBid
}) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'mybids'>('feed');
  const [selectedTripForBid, setSelectedTripForBid] = useState<OpenTrip | null>(null);
  const [counterRate, setCounterRate] = useState<number>(4500);
  const [bidNote, setBidNote] = useState<string>('');
  const [bidSuccessMsg, setBidSuccessMsg] = useState<boolean>(false);

  const handleOpenBidModal = (trip: OpenTrip) => {
    setSelectedTripForBid(trip);
    setCounterRate(trip.offeredPayout + 300); // Default counter suggestion
    setBidNote('Clean commercial vehicle with top rated outstation driver.');
  };

  const handleConfirmCounterBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripForBid) return;

    onSubmitCounterBid(selectedTripForBid, counterRate, bidNote);
    setSelectedTripForBid(null);
    setBidSuccessMsg(true);
    setTimeout(() => setBidSuccessMsg(false), 4000);
  };

  return (
    <div className="space-y-6 pb-20">

      {/* Top Hero Header */}
      <div className="bg-[#111111] text-white p-6 rounded-2xl border border-[#262626] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#E21E26]">LIVE TRIP DISPATCH ENGINE</span>
          <h1 className="text-xl font-extrabold mt-0.5">Marketplace & Bidding Engine</h1>
          <p className="text-xs text-gray-400">Accept offered customer rates or submit competitive counter bids</p>
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

      {bidSuccessMsg && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Counter bid submitted successfully! Super Admin & Customer will review your proposed payout.</span>
        </div>
      )}

      {/* TAB 1: OPEN TRIP MARKETPLACE FEED */}
      {activeTab === 'feed' && (
        <div className="space-y-4">
          {openTrips.filter(t => t.status === 'Open' || t.status === 'Bidding').length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-dashed text-center">
              <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-800">No open trips available in marketplace</p>
              <p className="text-xs text-gray-500 mt-1">Check back shortly for newly published outstation and city rides.</p>
            </div>
          ) : (
            openTrips.filter(t => t.status === 'Open' || t.status === 'Bidding').map(trip => (
              <div key={trip.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:border-[#E21E26] transition-all space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gray-900">{trip.bookingId}</span>
                      <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px]">
                        Required: {trip.vehicleCategory}
                      </span>
                    </div>
                    <h2 className="text-base font-extrabold text-gray-900 mt-1">{trip.route}</h2>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-gray-500 font-medium">Customer Offered Rate</span>
                    <p className="text-2xl font-black text-[#E21E26]">₹{trip.offeredPayout.toLocaleString('en-IN')}</p>
                    <span className="text-[10px] text-gray-400 block font-mono">Distance: {trip.distanceKm} KM</span>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 text-xs text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-700">Pickup Location</span>
                    <p className="font-semibold text-gray-900">{trip.pickup.address} ({trip.pickup.city})</p>
                    <p className="text-[11px] text-gray-500">Pickup Time: <span className="font-bold text-gray-800">{trip.pickup.time}</span></p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-red-700">Drop Destination</span>
                    <p className="font-semibold text-gray-900">{trip.drop.address} ({trip.drop.city})</p>
                    <p className="text-[11px] text-gray-500">Travel Date: <span className="font-bold text-gray-800">{trip.travelDate}</span></p>
                  </div>
                </div>

                {/* Bidding Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => handleOpenBidModal(trip)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Gavel className="w-4 h-4 text-amber-400" /> Submit Counter Bid
                  </button>

                  <button
                    onClick={() => onAcceptOfferedRate(trip)}
                    className="w-full sm:w-auto px-6 py-2.5 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-extrabold rounded-xl shadow flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" /> Accept Instant Booking (₹{trip.offeredPayout})
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
            <Gavel className="w-5 h-5 text-[#E21E26]" /> Active Counter Bid Status Tracker
          </h2>

          {bidProposals.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center italic">No counter bids submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {bidProposals.map(bid => (
                <div key={bid.id} className="p-4 bg-gray-50 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gray-900">{bid.bookingId}</span>
                      <span className="text-[10px] text-gray-500 font-mono">({bid.submittedAt})</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Note: "{bid.biddingNote}"</p>
                    <div className="flex items-center gap-4 text-xs mt-2">
                      <span className="text-gray-500">Customer Rate: <span className="font-bold text-gray-800">₹{bid.offeredPayout}</span></span>
                      <span className="text-gray-500">Your Proposed Counter: <span className="font-bold text-[#E21E26]">₹{bid.vendorCounterRate}</span></span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
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

            <form onSubmit={handleConfirmCounterBid} className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-xl border text-xs space-y-1">
                <p className="text-gray-600">Route: <span className="font-bold text-gray-900">{selectedTripForBid.route}</span></p>
                <p className="text-gray-600">Customer Offered Rate: <span className="font-bold text-gray-900">₹{selectedTripForBid.offeredPayout}</span></p>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Your Proposed Counter Rate (₹)</label>
                <input
                  type="number"
                  value={counterRate}
                  onChange={e => setCounterRate(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg font-mono font-bold text-[#E21E26]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Bidding Note to Customer / Admin</label>
                <textarea
                  value={bidNote}
                  onChange={e => setBidNote(e.target.value)}
                  placeholder="e.g. Clean Innova Crysta with experienced outstation driver"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium h-20"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedTripForBid(null)}
                  className="px-4 py-2 border text-xs font-bold text-gray-700 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow"
                >
                  Confirm Counter Bid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
