import React, { useState } from "react";
import { LocationItem, VehicleOption, TripRecord } from "../types";
import { vehicleCategories } from "../config/constants";
import { MapView } from "../components/MapView";
import {
  Download,
  FileText,
  CheckCircle,
  ShieldCheck,
  Printer,
  Calendar,
  Clock,
  CreditCard,
  Building,
  MapPin,
  Tag,
} from "lucide-react";

const defaultPickup: LocationItem = {
  id: "loc-1",
  name: "Home",
  address: "Nanjakavundanpalayam, Gobichettipalayam, Erode",
  type: "home",
  lat: 11.4549,
  lng: 77.4382,
};

const defaultDrop: LocationItem = {
  id: "loc-3",
  name: "Coimbatore Airport",
  address: "Civil Aerodrome Post, Coimbatore",
  type: "airport",
  lat: 11.03,
  lng: 77.0434,
};

const defaultRecentLocations: LocationItem[] = [
  {
    id: "rec-1",
    name: "Erode Railway Station",
    address: "Railway Colony, Erode",
    type: "recent",
  },
  {
    id: "rec-2",
    name: "BrookeFields Mall",
    address: "Krishnaswamy Road, Coimbatore",
    type: "recent",
  },
  {
    id: "rec-3",
    name: "PSG College of Technology",
    address: "Peelamedu, Coimbatore",
    type: "recent",
  },
];

interface BookingFlowScreenProps {
  initialServiceType?:
    | "One Way"
    | "Round Trip"
    | "Local Hourly"
    | "Airport Transfer"
    | "Multi-City"
    | "Scheduled"
    | "Corporate"
    | "Recurring Package"
    | "Local"
    | "Outstation"
    | "Airport";
  initialDropLocation?: LocationItem;
  onCancel: () => void;
  onBookingConfirmed: (trip: TripRecord) => void;
}

export const BookingFlowScreen: React.FC<BookingFlowScreenProps> = ({
  initialServiceType = "One Way",
  initialDropLocation,
  onCancel,
  onBookingConfirmed,
}) => {
  const [step, setStep] = useState<
    | "pickup"
    | "drop"
    | "route_preview"
    | "trip_type"
    | "vehicle"
    | "fare_estimate"
    | "passenger"
    | "summary"
    | "payment"
    | "processing"
    | "success"
  >("pickup");

  const [pickup, setPickup] = useState<LocationItem>(defaultPickup);
  const [drop, setDrop] = useState<LocationItem>(
    initialDropLocation || defaultDrop,
  );
  const [serviceType, setServiceType] = useState<string>(initialServiceType);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption>(
    vehicleCategories[1],
  );
  const [travelDate, setTravelDate] = useState("26 Aug 2026");
  const [travelTime, setTravelTime] = useState("07:00 AM");
  const [returnDate, setReturnDate] = useState("28 Aug 2026");
  const [passengerName, setPassengerName] = useState("Valued Customer");
  const [passengerPhone, setPassengerPhone] = useState("+91 85319 70197");
  const [isCorporate, setIsCorporate] = useState(false);
  const [corporateGstin, setCorporateGstin] = useState("33AAACN9042K1Z8");
  const [paymentMethod, setPaymentMethod] = useState<
    "Razorpay UPI" | "Credit/Debit Card" | "NetBanking" | "Cash on Drop"
  >("Razorpay UPI");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  // Dynamic Fare Calculation Engine
  const distanceKm =
    serviceType === "Local Hourly"
      ? 40
      : serviceType === "Multi-City"
        ? 340
        : 180;
  const baseFare = selectedVehicle.basePrice;
  const kmFare = Math.round(distanceKm * selectedVehicle.perKmRate);
  const driverBatta =
    serviceType === "Round Trip" || serviceType === "Multi-City" ? 600 : 300;
  const waitingCharges = 0;
  const tollCharges = 150;
  const subtotal =
    baseFare + kmFare + driverBatta + waitingCharges + tollCharges;
  const discount = appliedCoupon === "NESAM200" ? 200 : 0;
  const netSubtotal = Math.max(0, subtotal - discount);
  const gstAmount = Math.round(netSubtotal * 0.05);
  const totalFare = netSubtotal + gstAmount;

  const [createdTripRecord, setCreatedTripRecord] = useState<TripRecord | null>(
    null,
  );

  const handleCompletePayment = () => {
    setStep("processing");
    setTimeout(() => {
      const newTrip: TripRecord = {
        id: "trip-" + Date.now(),
        bookingId: "NST" + Math.floor(10000 + Math.random() * 90000),
        pickup,
        drop,
        tripType: serviceType as any,
        date: travelDate,
        time: travelTime,
        vehicle: selectedVehicle,
        fare: totalFare,
        status: "Confirmed",
        paymentStatus: paymentMethod === "Cash on Drop" ? "Pending" : "Paid",
        paymentMethod: paymentMethod,
        distanceKm,
        duration: "3 hr 30 min",
        otp: String(Math.floor(1000 + Math.random() * 9000)),
        passengerName,
        passengerPhone,
        driver: {
          id: "DRV-8842",
          name: "Senthil Nathan",
          phone: "+91 98400 12345",
          rating: 4.9,
          tripsCount: 420,
          vehicleName: selectedVehicle.name,
          vehicleNumber: "TN 37 BZ 9912",
          photoUrl:
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          verified: true,
          currentLat: 11.0168,
          currentLng: 76.9558,
        },
      };
      setCreatedTripRecord(newTrip);
      setStep("success");
    }, 1800);
  };

  const handleDownloadInvoicePdf = () => {
    if (!createdTripRecord) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>NESAM TAX INVOICE - ${createdTripRecord.bookingId}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 30px; color: #111; }
            .header { border-bottom: 3px solid #E21E26; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; }
            .title { font-size: 24px; font-weight: 900; color: #E21E26; }
            .subtitle { font-size: 12px; color: #666; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 12px; margin-bottom: 20px; }
            .box { background: #F9F9F9; padding: 12px; border-radius: 8px; border: 1px solid #E5E5E5; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
            th, td { border: 1px solid #E5E5E5; padding: 8px 12px; text-align: left; }
            th { background: #111; color: white; }
            .total { font-size: 16px; font-weight: bold; color: #E21E26; text-align: right; margin-top: 15px; }
            .footer { font-size: 10px; color: #999; margin-top: 40px; text-align: center; border-top: 1px solid #EEE; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="/icons/logo.png" alt="Logo" style="width: 50px; height: 50px; object-fit: contain; border-radius: 8px;" />
              <div>
                <div class="title">NESAM TOURS & TRAVELS PVT. LTD.</div>
                <div class="subtitle">Official GST Tax Invoice / E-Ticket Confirmation</div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 14px; font-weight: bold;">BOOKING ID: ${createdTripRecord.bookingId}</div>
              <div style="font-size: 11px; color: #666;">Date: ${createdTripRecord.date}</div>
            </div>
          </div>

          <div class="grid">
            <div class="box">
              <strong>CUSTOMER DETAILS</strong><br/>
              Name: ${passengerName}<br/>
              Phone: ${passengerPhone}<br/>
              ${isCorporate ? `GSTIN: ${corporateGstin}<br/>` : ""}
              Payment: ${createdTripRecord.paymentMethod} (${createdTripRecord.paymentStatus})
            </div>

            <div class="box">
              <strong>TRIP & VEHICLE DETAILS</strong><br/>
              Service: ${createdTripRecord.tripType}<br/>
              Vehicle: ${createdTripRecord.vehicle.name} (${createdTripRecord.driver?.vehicleNumber})<br/>
              Driver: ${createdTripRecord.driver?.name} (${createdTripRecord.driver?.phone})<br/>
              Customer Boarding OTP: <strong>${createdTripRecord.otp}</strong>
            </div>
          </div>

          <div class="box">
            <strong>ROUTE ITINERARY</strong><br/>
            Pickup: ${createdTripRecord.pickup.address}<br/>
            Drop: ${createdTripRecord.drop.address}<br/>
            Distance: ~${createdTripRecord.distanceKm} KM (${createdTripRecord.duration})
          </div>

          <table>
            <thead>
              <tr><th>Fare Item Description</th><th style="text-align: right;">Amount (₹)</th></tr>
            </thead>
            <tbody>
              <tr><td>Base Fare (${createdTripRecord.vehicle.name})</td><td style="text-align: right;">₹${baseFare}</td></tr>
              <tr><td>Distance Tariff (${distanceKm} KM @ ₹${selectedVehicle.perKmRate}/KM)</td><td style="text-align: right;">₹${kmFare}</td></tr>
              <tr><td>Driver Outstation Batta</td><td style="text-align: right;">₹${driverBatta}</td></tr>
              <tr><td>State Permit & Toll Charges</td><td style="text-align: right;">₹${tollCharges}</td></tr>
              <tr><td>5% Statutory GST</td><td style="text-align: right;">₹${gstAmount}</td></tr>
            </tbody>
          </table>

          <div class="total">GRAND TOTAL: ₹${totalFare}</div>

          <div class="footer">
            Thank you for choosing NESAM Tours & Travels! For support call +91 85319 70197 or email support@nesam.in
          </div>

          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="flex-1 bg-gray-50/50 overflow-y-auto py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Step Indicator Header */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <button
            onClick={onCancel}
            className="text-xs font-semibold text-gray-600 hover:text-black flex items-center gap-1 cursor-pointer"
          >
            ← Back to Home
          </button>
          <div className="text-xs font-semibold text-[#111827]">
            {step === "pickup" && "Step 1: Select Pickup Location"}
            {step === "drop" && "Step 2: Select Destination"}
            {step === "route_preview" &&
              "Step 3: Service Type & Route Overview"}
            {step === "vehicle" && "Step 4: Choose Fleet Vehicle"}
            {step === "fare_estimate" && "Step 5: Fare Calculation & Taxes"}
            {step === "summary" && "Step 6: Confirm Booking & Details"}
            {step === "payment" && "Step 7: Payment & Checkout"}
            {step === "processing" && "Processing Booking..."}
            {step === "success" && "Booking Confirmed!"}
          </div>
          <span className="text-[10px] font-extrabold text-[#E21E26] uppercase">
            NESAM BOOKING ENGINE
          </span>
        </div>

        {/* STEP 1: PICKUP LOCATION */}
        {step === "pickup" && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 max-w-xl mx-auto">
            <h2 className="text-base font-bold text-gray-900">
              Where should we pick you up?
            </h2>
            <div className="space-y-2">
              {[defaultPickup, defaultDrop].map((place) => (
                <div
                  key={place.id}
                  onClick={() => {
                    setPickup(place);
                    setStep("drop");
                  }}
                  className="p-3 border rounded-xl hover:border-[#E21E26] cursor-pointer flex items-center gap-3 bg-gray-50"
                >
                  <MapPin className="w-5 h-5 text-[#E21E26]" />
                  <div>
                    <p className="text-xs font-bold text-gray-900">
                      {place.name}
                    </p>
                    <p className="text-[11px] text-gray-500">{place.address}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: DROP LOCATION */}
        {step === "drop" && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 max-w-xl mx-auto">
            <h2 className="text-base font-bold text-gray-900">
              Where is your destination?
            </h2>
            <div className="space-y-2">
              {defaultRecentLocations.map((loc) => (
                <div
                  key={loc.id}
                  onClick={() => {
                    setDrop(loc);
                    setStep("route_preview");
                  }}
                  className="p-3 border rounded-xl hover:border-[#E21E26] cursor-pointer flex items-center gap-3 bg-gray-50"
                >
                  <MapPin className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold text-gray-900">
                      {loc.name}
                    </p>
                    <p className="text-[11px] text-gray-500">{loc.address}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: ROUTE & SERVICE TYPE SELECTION */}
        {step === "route_preview" && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6 max-w-2xl mx-auto">
            <h2 className="text-base font-bold text-gray-900">
              Select Travel Service Category
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                "One Way",
                "Round Trip",
                "Local Hourly",
                "Airport Transfer",
                "Multi-City",
                "Scheduled",
                "Corporate",
                "Recurring Package",
              ].map((st) => (
                <button
                  key={st}
                  onClick={() => setServiceType(st)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                    serviceType === st
                      ? "bg-[#E21E26] text-white border-[#E21E26] shadow"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border text-xs space-y-2">
              <div className="flex items-center justify-between text-gray-700">
                <span>Pickup:</span>
                <span className="font-bold text-gray-900">
                  {pickup.name} ({pickup.address})
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-700">
                <span>Drop:</span>
                <span className="font-bold text-gray-900">
                  {drop.name} ({drop.address})
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setStep("vehicle")}
                className="px-6 py-2.5 bg-[#E21E26] text-white text-xs font-extrabold rounded-xl shadow cursor-pointer"
              >
                Continue to Fleet Selection →
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: FLEET VEHICLE SELECTION */}
        {step === "vehicle" && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 max-w-3xl mx-auto">
            <h2 className="text-base font-bold text-gray-900">
              Choose Fleet Vehicle
            </h2>

            <div className="space-y-3">
              {vehicleCategories.map((v) => (
                <div
                  key={v.id}
                  onClick={() => setSelectedVehicle(v)}
                  className={`p-4 border rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
                    selectedVehicle.id === v.id
                      ? "border-[#E21E26] bg-red-50/20 shadow"
                      : "hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={v.image}
                      alt={v.name}
                      className="w-20 h-14 object-contain"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">
                        {v.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {v.tagline} • {v.passengers} Seats • {v.luggage} Bags
                      </p>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded mt-1 inline-block">
                        ETA: {v.eta}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-lg font-black text-[#E21E26]">
                      ₹{v.basePrice + Math.round(distanceKm * v.perKmRate)}
                    </span>
                    <p className="text-[10px] text-gray-400">
                      ₹{v.perKmRate}/KM
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setStep("fare_estimate")}
                className="px-6 py-2.5 bg-[#E21E26] text-white text-xs font-extrabold rounded-xl shadow cursor-pointer"
              >
                View Fare Breakdown →
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: FARE ESTIMATE & TAX BREAKDOWN */}
        {step === "fare_estimate" && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 max-w-xl mx-auto">
            <h2 className="text-base font-bold text-gray-900">
              Fare Calculation & Taxes
            </h2>

            <div className="bg-gray-50 p-4 rounded-xl border text-xs space-y-2.5">
              <div className="flex justify-between text-gray-600">
                <span>Base Fare ({selectedVehicle.name}):</span>
                <span className="font-bold text-gray-900">₹{baseFare}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>
                  Distance Tariff ({distanceKm} KM @ ₹
                  {selectedVehicle.perKmRate}/KM):
                </span>
                <span className="font-bold text-gray-900">₹{kmFare}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Driver Outstation Batta:</span>
                <span className="font-bold text-gray-900">₹{driverBatta}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>State Permit & Toll Charges:</span>
                <span className="font-bold text-gray-900">₹{tollCharges}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>5% Statutory GST:</span>
                <span className="font-bold text-gray-900">₹{gstAmount}</span>
              </div>

              <div className="border-t pt-2 flex justify-between text-sm font-extrabold text-[#E21E26]">
                <span>TOTAL ESTIMATED FARE:</span>
                <span>₹{totalFare}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setStep("summary")}
                className="px-6 py-2.5 bg-[#E21E26] text-white text-xs font-extrabold rounded-xl shadow cursor-pointer"
              >
                Proceed to Checkout →
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: SUMMARY & PASSENGER INFO */}
        {step === "summary" && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 max-w-xl mx-auto">
            <h2 className="text-base font-bold text-gray-900">
              Passenger Details & Schedule
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Passenger Full Name
                </label>
                <input
                  type="text"
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Mobile Phone Number
                </label>
                <input
                  type="text"
                  value={passengerPhone}
                  onChange={(e) => setPassengerPhone(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg font-semibold"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="corp"
                  checked={isCorporate}
                  onChange={(e) => setIsCorporate(e.target.checked)}
                />
                <label htmlFor="corp" className="font-bold text-gray-800">
                  Corporate Ride Booking (Add Company GSTIN)
                </label>
              </div>

              {isCorporate && (
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Company GSTIN Number
                  </label>
                  <input
                    type="text"
                    value={corporateGstin}
                    onChange={(e) => setCorporateGstin(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg font-mono font-bold uppercase"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setStep("payment")}
                className="px-6 py-2.5 bg-[#E21E26] text-white text-xs font-extrabold rounded-xl shadow cursor-pointer"
              >
                Choose Payment Method →
              </button>
            </div>
          </div>
        )}

        {/* STEP 7: PAYMENT METHOD */}
        {step === "payment" && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 max-w-xl mx-auto">
            <h2 className="text-base font-bold text-gray-900">
              Select Payment Method
            </h2>

            <div className="space-y-2">
              {[
                {
                  id: "Razorpay UPI",
                  label: "Instant Razorpay UPI (GPay / PhonePe / Paytm)",
                },
                { id: "Credit/Debit Card", label: "Credit / Debit Card" },
                { id: "NetBanking", label: "Corporate Net Banking" },
                {
                  id: "Cash on Drop",
                  label: "Cash on Drop (Pay Cash to Driver)",
                },
              ].map((pm) => (
                <div
                  key={pm.id}
                  onClick={() => setPaymentMethod(pm.id as any)}
                  className={`p-3 border rounded-xl flex items-center justify-between cursor-pointer ${
                    paymentMethod === pm.id
                      ? "border-[#E21E26] bg-red-50/20 font-bold"
                      : "bg-gray-50"
                  }`}
                >
                  <span className="text-xs text-gray-900">{pm.label}</span>
                  {paymentMethod === pm.id && (
                    <span className="text-xs font-bold text-[#E21E26]">
                      ● Selected
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-white border border-gray-200 shadow-sm text-gray-900 p-4 rounded-xl flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
              <div>
                <span className="text-[10px] text-gray-500">
                  Total Payable Fare
                </span>
                <p className="text-xl font-black text-gray-900">₹{totalFare}</p>
              </div>

              <button
                onClick={handleCompletePayment}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-extrabold rounded-xl shadow-sm cursor-pointer"
              >
                Confirm & Pay ₹{totalFare}
              </button>
            </div>
          </div>
        )}

        {/* STEP 8: PROCESSING */}
        {step === "processing" && (
          <div className="bg-white p-12 rounded-2xl border border-gray-200 shadow-sm text-center space-y-3 max-w-md mx-auto">
            <div className="w-12 h-12 border-4 border-[#E21E26] border-t-transparent rounded-full animate-spin mx-auto" />
            <h2 className="text-base font-bold text-gray-900">
              Processing Secure Booking & Dispatch...
            </h2>
            <p className="text-xs text-gray-500">
              Contacting nearby fleet driver and generating GST E-Ticket Invoice
            </p>
          </div>
        )}

        {/* STEP 9: SUCCESS CONFIRMATION & PDF TICKET */}
        {step === "success" && createdTripRecord && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6 max-w-xl mx-auto">
            <div className="text-center space-y-2 border-b pb-4">
              <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
              <h2 className="text-lg font-black text-gray-900">
                Booking Confirmed Successfully!
              </h2>
              <p className="text-xs text-gray-500 font-mono">
                Booking ID:{" "}
                <span className="font-bold text-[#E21E26]">
                  {createdTripRecord.bookingId}
                </span>
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Assigned Vehicle:</span>
                <span className="font-bold text-gray-900">
                  {createdTripRecord.vehicle.name} (
                  {createdTripRecord.driver?.vehicleNumber})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Driver Partner:</span>
                <span className="font-bold text-gray-900">
                  {createdTripRecord.driver?.name} (
                  {createdTripRecord.driver?.phone})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Customer Boarding OTP:</span>
                <span className="font-mono font-black text-lg text-[#E21E26]">
                  {createdTripRecord.otp}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDownloadInvoicePdf}
                className="flex-1 py-3 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" /> Download PDF
                Ticket / Invoice
              </button>

              <button
                onClick={() => onBookingConfirmed(createdTripRecord)}
                className="flex-1 py-3 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-extrabold rounded-xl shadow cursor-pointer"
              >
                Track Driver Live →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
