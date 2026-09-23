import React from 'react';

interface MapViewProps {
  pickupName?: string;
  dropName?: string;
  driverEta?: string;
  showDriver?: boolean;
  driverName?: string;
  height?: string;
  interactive?: boolean;
  onSelectMapLocation?: (locationName: string) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  pickupName = 'Gobichettipalayam',
  dropName = 'Coimbatore Airport',
  driverEta = '8 mins away',
  showDriver = false,
  driverName = 'Kumar M.',
  height = '240px',
  onSelectMapLocation,
}) => {
  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border border-[#E5E5E5] shadow-inner bg-[#EAE8E3]"
      style={{ height }}
    >
      {/* Simulated Map Grid */}
      <svg className="absolute inset-0 w-full h-full opacity-60" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#D1CEC7" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        {/* Road networks */}
        <path d="M -20 120 Q 150 180 400 80" fill="none" stroke="#FFFFFF" strokeWidth="12" />
        <path d="M 80 -10 Q 120 140 220 300" fill="none" stroke="#FFFFFF" strokeWidth="10" />
        <path d="M -20 120 Q 150 180 400 80" fill="none" stroke="#F5D77F" strokeWidth="6" />
        <path d="M 80 -10 Q 120 140 220 300" fill="none" stroke="#FFFFFF" strokeWidth="5" />

        {/* Dynamic Route Polyline */}
        <path
          d="M 60 70 Q 140 110 240 180 T 360 220"
          fill="none"
          stroke="#E31E24"
          strokeWidth="5"
          strokeDasharray="6 4"
          className="animate-pulse"
        />
      </svg>

      {/* Map Control: Locate button */}
      <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
        <button
          onClick={() => onSelectMapLocation && onSelectMapLocation('Current Location')}
          className="w-8 h-8 rounded-lg bg-white shadow-md flex items-center justify-center text-[#111111] hover:bg-gray-50 border border-gray-200"
          title="My Location"
        >
          <svg className="w-4 h-4 text-[#E31E24]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <circle cx="12" cy="12" r="3" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3m10-10h-3M5 12H2" />
          </svg>
        </button>
      </div>

      {/* Pickup Marker */}
      <div className="absolute left-[50px] top-[50px] z-10 flex flex-col items-center group cursor-pointer">
        <div className="bg-[#111111] text-white text-[9px] font-extrabold px-2.5 py-1 rounded-full shadow-lg whitespace-nowrap mb-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#20A464]" />
          <span>PICKUP: {pickupName}</span>
        </div>
        <div className="w-6 h-6 rounded-full bg-[#20A464] border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-black">
          A
        </div>
      </div>

      {/* Drop Marker */}
      <div className="absolute left-[330px] top-[200px] z-10 flex flex-col items-center group cursor-pointer">
        <div className="bg-[#E31E24] text-white text-[9px] font-extrabold px-2.5 py-1 rounded-full shadow-lg whitespace-nowrap mb-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          <span>DESTINATION: {dropName}</span>
        </div>
        <div className="w-6 h-6 rounded-full bg-[#E31E24] border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-black">
          B
        </div>
      </div>

      {/* Live Driver Marker */}
      {showDriver && (
        <div className="absolute left-[170px] top-[125px] z-20 flex flex-col items-center animate-bounce">
          <div className="bg-white border border-[#E31E24] text-[#111111] text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap mb-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20A464] animate-ping" />
            {driverName} ({driverEta})
          </div>
          <div className="w-8 h-8 rounded-full bg-[#111111] border-2 border-[#E31E24] shadow-xl flex items-center justify-center text-white">
            <svg className="w-4 h-4 text-[#E31E24]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1" />
            </svg>
          </div>
        </div>
      )}

      {/* Bottom Map Badge */}
      <div className="absolute bottom-2 left-2 z-10 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-gray-200 text-[9px] font-bold text-gray-700 shadow-sm flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[#20A464]" />
        Live GPS Tracking • Google Maps Engine
      </div>
    </div>
  );
};
