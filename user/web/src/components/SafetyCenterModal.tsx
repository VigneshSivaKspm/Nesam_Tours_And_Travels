import React from 'react';
import { DriverInfo } from '../types';

interface SafetyCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver?: DriverInfo;
  bookingId?: string;
}

export const SafetyCenterModal: React.FC<SafetyCenterModalProps> = ({
  isOpen,
  onClose,
  driver,
  bookingId = 'NST10245',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 border border-gray-200">
        {/* Header */}
        <div className="bg-white text-gray-900 p-5 flex items-center justify-between border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E31E24] flex items-center justify-center text-white font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wider text-gray-900 uppercase">SAFETY CENTER</h3>
              <p className="text-[10px] text-gray-500 font-medium">Ride Protection & Emergency Assistance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:text-gray-900 flex items-center justify-center text-xs font-bold"
          >
            ✕
          </button>
        </div>

        {/* Safety Options */}
        <div className="p-5 space-y-3">
          {/* Option 1: Call 24/7 Helpline */}
          <a
            href="tel:8531970197"
            className="flex items-center gap-3 p-3.5 rounded-2xl border border-gray-200 hover:border-[#E31E24] bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-red-100 text-[#E31E24] flex items-center justify-center shrink-0 font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-xs font-black text-[#111111]">Call NESAM Safety Support</div>
              <div className="text-[10px] text-gray-500 font-medium">24/7 Helpline: 8531970197</div>
            </div>
            <span className="text-[10px] font-black text-[#E31E24] uppercase">CALL NOW</span>
          </a>

          {/* Option 2: Share Live Trip */}
          <button
            onClick={() => {
              alert(`Live Trip Details for Booking ${bookingId} shared with Emergency Contacts.`);
              onClose();
            }}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-gray-200 hover:border-[#E31E24] bg-gray-50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-xs font-black text-[#111111]">Share Trip with Family</div>
              <div className="text-[10px] text-gray-500 font-medium">Send live tracking link to trusted contacts</div>
            </div>
            <span className="text-[10px] font-black text-blue-600 uppercase">SHARE</span>
          </button>

          {/* Option 3: SOS Emergency */}
          <button
            onClick={() => {
              if (confirm('Are you sure you want to trigger SOS Emergency Alert to local authorities & NESAM Command Center?')) {
                alert('SOS Alert Triggered! Local dispatch and emergency contacts have been notified.');
                onClose();
              }
            }}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-red-200 bg-red-50 hover:bg-red-100 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-[#E31E24] text-white flex items-center justify-center shrink-0 font-black">
              SOS
            </div>
            <div className="flex-1">
              <div className="text-xs font-black text-[#D92D20]">POLICE / EMERGENCY SOS</div>
              <div className="text-[10px] text-red-700 font-medium">Immediate location broadcast to Police (112)</div>
            </div>
            <span className="text-[10px] font-black text-[#D92D20] bg-white px-2 py-1 rounded-md border border-red-300">ALERT</span>
          </button>

          {/* Driver & Vehicle Info */}
          {driver && (
            <div className="p-3 bg-gray-100 rounded-2xl text-[11px] text-gray-700 border border-gray-200 mt-2">
              <div className="font-bold text-[#111111] mb-1">Active Captain Info:</div>
              <div className="flex justify-between">
                <span>Captain: {driver.name}</span>
                <span className="font-bold">{driver.vehicleNumber}</span>
              </div>
              <div className="text-gray-500 text-[10px] mt-0.5">Booking Reference: {bookingId}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
