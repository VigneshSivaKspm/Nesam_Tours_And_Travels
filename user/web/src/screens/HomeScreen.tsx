import React, { useState } from "react";
import { LocationItem } from "../types";
import {
  vehicleCategories,
  activeOffers as availableOffers,
} from "../config/constants";

interface HomeScreenProps {
  onStartBooking: (
    serviceType: "Local" | "Outstation" | "Airport" | "One Way" | "Round Trip",
    preselectedDrop?: LocationItem,
  ) => void;
  onOpenSavedPlaces: () => void;
  onOpenOffers: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartBooking,
  onOpenOffers,
}) => {
  const [selectedService, setSelectedService] = useState<
    "Airport" | "Outstation" | "One Way" | "Local" | "Round Trip"
  >("Outstation");
  const [pickupInput, setPickupInput] = useState("Koduvilar Patti, Theni");
  const [destinationInput, setDestinationInput] = useState("");

  return (
    <div className="flex-1 overflow-y-auto bg-white flex flex-col justify-between">
      <div className="space-y-16 pb-16">
        {/* ── HERO & INTEGRATED SEARCH ── */}
        <section className="bg-gray-50/80 border-b border-gray-200 py-12 px-4 sm:px-6">
          <div className="max-web-width space-y-8">
            {/* Headline */}
            <div className="max-w-2xl space-y-2">
              <span className="text-xs font-semibold text-[#E31E24] uppercase tracking-wider">
                NESAM TOURS & TRAVELS PRIVATE LIMITED
              </span>
              <h1 className="text-3xl sm:text-4xl font-bold text-[#111827] tracking-tight">
                Reliable Outstation, Airport & City Cabs
              </h1>
              <p className="text-sm text-gray-600 font-normal">
                Safe journey, happy memories. Book verified cabs across Tamil
                Nadu with transparent pricing.
              </p>
            </div>

            {/* Uber-Style Search Widget Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
              {/* Category Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-4">
                {[
                  {
                    id: "Outstation",
                    label: "Outstation Cab",
                    iconPath:
                      "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9",
                  },
                  {
                    id: "Airport",
                    label: "Airport Taxi",
                    iconPath: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
                  },
                  {
                    id: "One Way",
                    label: "One Way Taxi",
                    iconPath:
                      "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z",
                  },
                  {
                    id: "Local",
                    label: "Local Rental",
                    iconPath:
                      "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
                  },
                ].map((tab) => {
                  const isActive = selectedService === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedService(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? "bg-[#E31E24] text-white font-semibold shadow-xs"
                          : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d={tab.iconPath}
                        />
                      </svg>
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Form Input Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Pickup Location
                  </label>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 focus-within:border-[#E31E24] focus-within:bg-white transition-all">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <input
                      type="text"
                      value={pickupInput}
                      onChange={(e) => setPickupInput(e.target.value)}
                      className="bg-transparent text-xs font-medium text-[#111827] w-full focus:outline-none placeholder-gray-400"
                      placeholder="Enter pickup city..."
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Destination
                  </label>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 focus-within:border-[#E31E24] focus-within:bg-white transition-all">
                    <span className="w-2 h-2 rounded-full bg-[#E31E24] shrink-0" />
                    <input
                      type="text"
                      value={destinationInput}
                      onChange={(e) => setDestinationInput(e.target.value)}
                      className="bg-transparent text-xs font-medium text-[#111827] w-full focus:outline-none placeholder-gray-400"
                      placeholder="Search destination..."
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Date & Time
                  </label>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-[#111827]">
                      24 Aug 2026, 06:30 AM
                    </span>
                    <span className="text-xs font-semibold text-[#E31E24] cursor-pointer hover:underline">
                      Change
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                onClick={() => {
                  const dropItem: LocationItem | undefined = destinationInput
                    ? {
                        id: `loc-${Date.now()}`,
                        name: destinationInput,
                        address: destinationInput,
                        type: "other",
                      }
                    : undefined;
                  onStartBooking(selectedService, dropItem);
                }}
                className="w-full bg-[#E31E24] text-white py-3.5 rounded-xl font-semibold text-xs hover:bg-[#B91C1C] transition-colors shadow-xs flex items-center justify-center gap-2"
              >
                <span>Search Available Cabs</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </section>

        {/* ── FLEET SELECTION SHOWCASE ── */}
        <section className="max-web-width px-4 sm:px-6 space-y-6">
          <div className="flex justify-between items-end border-b border-gray-200 pb-3">
            <div>
              <span className="text-xs font-semibold text-[#E31E24] uppercase tracking-wider">
                OUR FLEET
              </span>
              <h2 className="text-xl font-bold text-[#111827] mt-0.5">
                Clean & Verified Vehicles
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {vehicleCategories.slice(0, 4).map((veh) => (
              <div
                key={veh.id}
                onClick={() => onStartBooking("Outstation")}
                className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs hover:shadow-md hover:border-[#E31E24] transition-all cursor-pointer space-y-3 flex flex-col justify-between"
              >
                <img
                  src={veh.image}
                  alt={veh.name}
                  className="w-full h-32 object-cover rounded-lg border border-gray-100"
                />
                <div>
                  <span className="text-[10px] font-semibold text-[#E31E24] bg-red-50 px-2 py-0.5 rounded-md">
                    {veh.category}
                  </span>
                  <h3 className="text-sm font-bold text-[#111827] mt-1.5">
                    {veh.name}
                  </h3>
                  <p className="text-xs text-gray-500 font-normal mt-0.5">
                    {veh.tagline}
                  </p>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">
                    {veh.passengers} Seats · AC
                  </span>
                  <span className="font-bold text-[#111827]">
                    From ₹{veh.basePrice}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── PROMO BANNER ── */}
        <section className="max-web-width px-4 sm:px-6">
          <div
            onClick={onOpenOffers}
            className="bg-white text-gray-900 p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:border-[#E31E24] transition-colors"
          >
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#E31E24] uppercase tracking-wider">
                SPECIAL OFFER
              </span>
              <h3 className="text-base font-bold text-gray-900">
                {availableOffers[0].discount}
              </h3>
              <p className="text-xs text-gray-500">{availableOffers[0].desc}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700">
                Code: {availableOffers[0].code}
              </div>
              <button className="bg-[#E31E24] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#B91C1C] shrink-0">
                Apply Offer
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ── FOOTER ── */}
      <footer className="bg-[#111827] text-white pt-10 pb-8 px-4 sm:px-6 border-t border-gray-800">
        <div className="max-web-width grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-gray-800">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <img
                src="/icons/logo.png"
                alt="NESAM Tours & Travels"
                className="w-8 h-8 rounded-lg object-contain bg-white/10 p-0.5"
              />
              <h3 className="text-sm font-bold text-white">
                NESAM TOURS & TRAVELS
              </h3>
            </div>
            <p className="text-xs text-gray-400">PRIVATE LIMITED</p>
            <p className="text-xs text-gray-400 italic">
              "Safe Journey, Happy Memories"
            </p>
          </div>

          <div className="space-y-1 text-xs">
            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Helpline & Contact
            </h4>
            <div className="text-gray-300 font-medium">Phone: 8531970197</div>
            <div className="text-gray-400">
              Email: nesamtoursandtravels@gmail.com
            </div>
            <div className="text-gray-400">
              Web: www.nesamtoursandtravels.com
            </div>
          </div>

          <div className="space-y-1 text-xs">
            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Registered Office
            </h4>
            <p className="text-gray-400 leading-relaxed">
              NO.46 GOUNDAR STREET, KODUVILAR PATTI,
              <br />
              THENI - 625534, TAMIL NADU
            </p>
          </div>
        </div>

        <div className="max-web-width pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-gray-500 gap-2">
          <span>
            © 2026 NESAM TOURS & TRAVELS PRIVATE LIMITED. All Rights Reserved.
          </span>
          <span>Official Customer Web Portal</span>
        </div>
      </footer>
    </div>
  );
};
