// ─────────────────────────────────────────────────────────────
// NESAM TOURS & TRAVELS — ENTERPRISE MOCK DATA
// ─────────────────────────────────────────────────────────────

// ── KPI DATA ─────────────────────────────────────────────────
export const kpiData = {
  totalBookings: { value: 12847, today: 47, change: 12.5 },
  activeTrips: { value: 23, drivers: 23 },
  totalCustomers: { value: 8924, newThisMonth: 312 },
  totalRevenue: { value: 2847650, monthly: 384200, growth: 18.3 },
  vehicles: { available: 34, onTrip: 23, maintenance: 5 },
  drivers: { online: 28, busy: 23, offline: 14 },
  vendors: { total: 18, active: 14, pending: 3, suspended: 1 },
  marketplace: { open: 7, bidReceived: 4, closed: 2 },
  penalties: { thisMonth: 12, totalAmount: 24500, pending: 3 },
  gstCollected: { thisMonth: 192100, ytd: 1142800 },
  tdsDeducted: { thisMonth: 38420, ytd: 228560 },
};

// ── REVENUE DATA ──────────────────────────────────────────────
export const revenueData = [
  { month: "Jan", total: 284000, booking: 180000, tour: 52000, airport: 28000, outstation: 16000, local: 8000 },
  { month: "Feb", total: 312000, booking: 195000, tour: 61000, airport: 31000, outstation: 18000, local: 7000 },
  { month: "Mar", total: 356000, booking: 220000, tour: 72000, airport: 35000, outstation: 21000, local: 8000 },
  { month: "Apr", total: 298000, booking: 188000, tour: 58000, airport: 29000, outstation: 16000, local: 7000 },
  { month: "May", total: 341000, booking: 211000, tour: 68000, airport: 34000, outstation: 20000, local: 8000 },
  { month: "Jun", total: 384200, booking: 238000, tour: 76000, airport: 38000, outstation: 23000, local: 9200 },
];

export const bookingCategoryData = [
  { name: "Airport Taxi", value: 3840, color: "#E21B23" },
  { name: "Outstation Cab", value: 2920, color: "#111111" },
  { name: "One Way Taxi", value: 3100, color: "#444444" },
  { name: "Local Rental", value: 1840, color: "#777777" },
  { name: "Tour Packages", value: 1147, color: "#AAAAAA" },
];

// ── BOOKINGS ──────────────────────────────────────────────────
export const bookings = [
  { id: "NTT-2024-4821", customer: "Rajesh Kumar", vendor: "Sri Murugan Cabs", service: "Airport Taxi", pickup: "Anna Nagar, Chennai", drop: "Chennai Airport", date: "24 Aug 2024", time: "06:30 AM", vehicle: "Toyota Innova", driver: "Murugan S.", fare: "₹1,250", payment: "Paid", status: "Completed", boardingOTP: "8821", verified: true },
  { id: "NTT-2024-4820", customer: "Priya Sharma", vendor: "Rajan Fleet Services", service: "Outstation Cab", pickup: "T. Nagar, Chennai", drop: "Bangalore", date: "24 Aug 2024", time: "08:00 AM", vehicle: "Toyota Innova Crysta", driver: "Rajan P.", fare: "₹4,800", payment: "Paid", status: "Ongoing", boardingOTP: "3341", verified: true },
  { id: "NTT-2024-4819", customer: "Arun Venkatesh", vendor: null, service: "Local Rental", pickup: "Adyar, Chennai", drop: "Multiple Stops", date: "24 Aug 2024", time: "09:00 AM", vehicle: "Honda City", driver: "Suresh K.", fare: "₹2,100", payment: "Pending", status: "Confirmed", boardingOTP: null, verified: false },
  { id: "NTT-2024-4818", customer: "Meenakshi R.", vendor: "Sri Murugan Cabs", service: "One Way Taxi", pickup: "Velachery, Chennai", drop: "Mahabalipuram", date: "23 Aug 2024", time: "07:00 AM", vehicle: "Maruti Dzire", driver: "Vijay M.", fare: "₹1,850", payment: "Paid", status: "Completed", boardingOTP: "5572", verified: true },
  { id: "NTT-2024-4817", customer: "Karthik Sundaram", vendor: "Tamil Nadu Fleet Co.", service: "Tour Package", pickup: "Mylapore, Chennai", drop: "Ooty", date: "23 Aug 2024", time: "05:30 AM", vehicle: "Tempo Traveller", driver: "Anand R.", fare: "₹12,500", payment: "Paid", status: "Completed", boardingOTP: "7723", verified: true },
  { id: "NTT-2024-4816", customer: "Lakshmi Devi", vendor: null, service: "Airport Taxi", pickup: "Porur, Chennai", drop: "Chennai Airport", date: "23 Aug 2024", time: "03:00 AM", vehicle: "Toyota Etios", driver: "—", fare: "₹950", payment: "Unpaid", status: "Pending", boardingOTP: null, verified: false },
  { id: "NTT-2024-4815", customer: "Vignesh Pandian", vendor: "Rajan Fleet Services", service: "Outstation Cab", pickup: "Perambur, Chennai", drop: "Tirupati", date: "22 Aug 2024", time: "04:00 AM", vehicle: "Toyota Innova", driver: "Kumar S.", fare: "₹3,600", payment: "Paid", status: "Completed", boardingOTP: "2298", verified: true },
  { id: "NTT-2024-4814", customer: "Santha Kumari", vendor: "Sri Murugan Cabs", service: "One Way Taxi", pickup: "Tambaram, Chennai", drop: "Pondicherry", date: "22 Aug 2024", time: "07:30 AM", vehicle: "Maruti Ertiga", driver: "Murugan S.", fare: "₹2,400", payment: "Refunded", status: "Cancelled", boardingOTP: null, verified: true },
];

// ── CUSTOMERS ─────────────────────────────────────────────────
export const customers = [
  { id: "CUS-1001", name: "Rajesh Kumar", phone: "+91 98412 33456", email: "rajesh.kumar@email.com", bookings: 24, spent: "₹38,400", lastBooking: "24 Aug 2024", status: "Active", wallet: "₹500", disputes: 0 },
  { id: "CUS-1002", name: "Priya Sharma", phone: "+91 87654 21098", email: "priya.sharma@email.com", bookings: 12, spent: "₹19,200", lastBooking: "24 Aug 2024", status: "Active", wallet: "₹0", disputes: 0 },
  { id: "CUS-1003", name: "Arun Venkatesh", phone: "+91 94456 78901", email: "arun.v@email.com", bookings: 8, spent: "₹11,500", lastBooking: "24 Aug 2024", status: "Active", wallet: "₹200", disputes: 1 },
  { id: "CUS-1004", name: "Meenakshi R.", phone: "+91 76543 21098", email: "meenakshi.r@email.com", bookings: 31, spent: "₹52,100", lastBooking: "23 Aug 2024", status: "Active", wallet: "₹1,200", disputes: 0 },
  { id: "CUS-1005", name: "Karthik Sundaram", phone: "+91 99887 76543", email: "karthik.s@email.com", bookings: 6, spent: "₹42,000", lastBooking: "23 Aug 2024", status: "Active", wallet: "₹0", disputes: 0 },
  { id: "CUS-1006", name: "Lakshmi Devi", phone: "+91 88776 65432", email: "lakshmi.d@email.com", bookings: 3, spent: "₹4,200", lastBooking: "23 Aug 2024", status: "Inactive", wallet: "₹0", disputes: 0 },
  { id: "CUS-1007", name: "Vignesh Pandian", phone: "+91 77665 54321", email: "vignesh.p@email.com", bookings: 19, spent: "₹29,800", lastBooking: "22 Aug 2024", status: "Active", wallet: "₹350", disputes: 2 },
  { id: "CUS-1008", name: "Santha Kumari", phone: "+91 66554 43210", email: "santha.k@email.com", bookings: 5, spent: "₹7,600", lastBooking: "22 Aug 2024", status: "Blocked", wallet: "₹0", disputes: 3 },
];

// ── VENDORS ───────────────────────────────────────────────────
export const vendors = [
  {
    id: "VEN-001", name: "Sri Murugan Cabs", owner: "Murugan Selvaraj", phone: "+91 94567 88001", email: "murugan@sricabs.in", city: "Chennai",
    gst: "33AABCS1234F1Z5", status: "Active", verified: true, fleetSize: 8, activeDrivers: 6, commission: 15,
    wallet: "₹42,800", totalEarnings: "₹8,42,500", joinedDate: "12 Jan 2024", lastActivity: "24 Aug 2024",
    docs: { gstCert: "Verified", pan: "Verified", tradeLicense: "Verified", bankDetails: "Verified" },
  },
  {
    id: "VEN-002", name: "Rajan Fleet Services", owner: "Rajan Pillai", phone: "+91 87654 22345", email: "rajan@rajanfleet.com", city: "Chennai",
    gst: "33AABCR5678G2Z6", status: "Active", verified: true, fleetSize: 12, activeDrivers: 9, commission: 12,
    wallet: "₹68,400", totalEarnings: "₹14,12,300", joinedDate: "05 Mar 2024", lastActivity: "24 Aug 2024",
    docs: { gstCert: "Verified", pan: "Verified", tradeLicense: "Verified", bankDetails: "Verified" },
  },
  {
    id: "VEN-003", name: "Tamil Nadu Fleet Co.", owner: "Selvam Kumar", phone: "+91 98765 33456", email: "selvam@tnfleet.com", city: "Coimbatore",
    gst: "33AABCT9012H3Z7", status: "Active", verified: true, fleetSize: 20, activeDrivers: 14, commission: 10,
    wallet: "₹1,24,200", totalEarnings: "₹28,54,100", joinedDate: "18 Nov 2023", lastActivity: "23 Aug 2024",
    docs: { gstCert: "Verified", pan: "Verified", tradeLicense: "Verified", bankDetails: "Verified" },
  },
  {
    id: "VEN-004", name: "South India Travels", owner: "Krishnan Raj", phone: "+91 76543 44567", email: "krishnan@sitravel.com", city: "Madurai",
    gst: "33AABCS3456I4Z8", status: "Pending", verified: false, fleetSize: 5, activeDrivers: 0, commission: 15,
    wallet: "₹0", totalEarnings: "₹0", joinedDate: "20 Aug 2024", lastActivity: "20 Aug 2024",
    docs: { gstCert: "Pending", pan: "Verified", tradeLicense: "Pending", bankDetails: "Pending" },
  },
  {
    id: "VEN-005", name: "Metro Cab Network", owner: "Deepan Arasu", phone: "+91 65432 55678", email: "deepan@metrocab.in", city: "Chennai",
    gst: "33AABCM7890J5Z9", status: "Pending", verified: false, fleetSize: 3, activeDrivers: 0, commission: 15,
    wallet: "₹0", totalEarnings: "₹0", joinedDate: "22 Aug 2024", lastActivity: "22 Aug 2024",
    docs: { gstCert: "Uploaded", pan: "Verified", tradeLicense: "Uploaded", bankDetails: "Verified" },
  },
  {
    id: "VEN-006", name: "Kings Cabs", owner: "Balan Suresh", phone: "+91 54321 66789", email: "balan@kingscabs.com", city: "Chennai",
    gst: "33AABCK1234K6Z0", status: "Suspended", verified: true, fleetSize: 6, activeDrivers: 0, commission: 15,
    wallet: "₹-8,500", totalEarnings: "₹3,24,100", joinedDate: "10 Feb 2024", lastActivity: "10 Aug 2024",
    docs: { gstCert: "Verified", pan: "Verified", tradeLicense: "Expired", bankDetails: "Verified" },
  },
];

// ── DRIVERS ───────────────────────────────────────────────────
export const drivers = [
  {
    id: "DRV-101", name: "Murugan S.", phone: "+91 94567 12345", vehicle: "TN01 AB 2345", vendor: "Sri Murugan Cabs",
    license: "Valid", licenseExpiry: "2027-06-30", status: "On Trip", trips: 847, earnings: "₹2,84,500",
    rating: 4.8, verified: true, wallet: "₹12,400", penalties: 0, tds: "₹2,845",
    docs: { license: "Verified", photo: "Verified", rc: "Verified", insurance: "Verified", permit: "Verified" },
    preTrip: { selfie: true, vehicleFront: true, odometer: true, rearSeat: true },
  },
  {
    id: "DRV-102", name: "Rajan P.", phone: "+91 87654 98765", vehicle: "TN02 CD 6789", vendor: "Rajan Fleet Services",
    license: "Valid", licenseExpiry: "2026-12-15", status: "On Trip", trips: 623, earnings: "₹2,12,300",
    rating: 4.7, verified: true, wallet: "₹8,200", penalties: 1, tds: "₹2,123",
    docs: { license: "Verified", photo: "Verified", rc: "Verified", insurance: "Verified", permit: "Verified" },
    preTrip: { selfie: true, vehicleFront: true, odometer: true, rearSeat: false },
  },
  {
    id: "DRV-103", name: "Suresh K.", phone: "+91 98765 43210", vehicle: "TN03 EF 1234", vendor: "Sri Murugan Cabs",
    license: "Valid", licenseExpiry: "2028-03-20", status: "On Trip", trips: 512, earnings: "₹1,72,400",
    rating: 4.9, verified: true, wallet: "₹6,800", penalties: 0, tds: "₹1,724",
    docs: { license: "Verified", photo: "Verified", rc: "Verified", insurance: "Expiring", permit: "Verified" },
    preTrip: { selfie: true, vehicleFront: true, odometer: true, rearSeat: true },
  },
  {
    id: "DRV-104", name: "Vijay M.", phone: "+91 76543 87654", vehicle: "TN04 GH 5678", vendor: "Tamil Nadu Fleet Co.",
    license: "Expiring Soon", licenseExpiry: "2024-10-01", status: "Online", trips: 398, earnings: "₹1,34,200",
    rating: 4.6, verified: true, wallet: "₹4,500", penalties: 0, tds: "₹1,342",
    docs: { license: "Expiring", photo: "Verified", rc: "Verified", insurance: "Verified", permit: "Verified" },
    preTrip: { selfie: true, vehicleFront: true, odometer: false, rearSeat: true },
  },
  {
    id: "DRV-105", name: "Anand R.", phone: "+91 65432 76543", vehicle: "TN05 IJ 9012", vendor: "Tamil Nadu Fleet Co.",
    license: "Valid", licenseExpiry: "2029-01-10", status: "Online", trips: 734, earnings: "₹2,48,900",
    rating: 4.8, verified: true, wallet: "₹9,100", penalties: 1, tds: "₹2,489",
    docs: { license: "Verified", photo: "Verified", rc: "Verified", insurance: "Verified", permit: "Verified" },
    preTrip: { selfie: true, vehicleFront: true, odometer: true, rearSeat: true },
  },
  {
    id: "DRV-106", name: "Kumar S.", phone: "+91 54321 65432", vehicle: "TN06 KL 3456", vendor: "Rajan Fleet Services",
    license: "Valid", licenseExpiry: "2027-08-22", status: "Offline", trips: 291, earnings: "₹98,300",
    rating: 4.5, verified: false, wallet: "₹3,200", penalties: 2, tds: "₹983",
    docs: { license: "Uploaded", photo: "Pending", rc: "Verified", insurance: "Verified", permit: "Pending" },
    preTrip: { selfie: false, vehicleFront: false, odometer: false, rearSeat: false },
  },
  {
    id: "DRV-107", name: "Selvam T.", phone: "+91 43210 54321", vehicle: "TN07 MN 7890", vendor: null,
    license: "Expired", licenseExpiry: "2023-05-15", status: "Suspended", trips: 156, earnings: "₹52,100",
    rating: 3.9, verified: false, wallet: "₹-5,000", penalties: 5, tds: "₹521",
    docs: { license: "Expired", photo: "Verified", rc: "Expired", insurance: "Expired", permit: "Expired" },
    preTrip: { selfie: false, vehicleFront: false, odometer: false, rearSeat: false },
  },
];

// ── VEHICLES ──────────────────────────────────────────────────
export const vehicles = [
  { id: "VEH-01", name: "Toyota Innova", number: "TN01 AB 2345", category: "Innova", seats: 7, fuel: "Diesel", driver: "Murugan S.", vendor: "Sri Murugan Cabs", status: "On Trip", rate: "₹18/km", docs: { rc: "Valid", insurance: "Valid", fitness: "Valid", permit: "Valid" } },
  { id: "VEH-02", name: "Toyota Innova Crysta", number: "TN02 CD 6789", category: "Innova Crysta", seats: 7, fuel: "Diesel", driver: "Rajan P.", vendor: "Rajan Fleet Services", status: "On Trip", rate: "₹22/km", docs: { rc: "Valid", insurance: "Valid", fitness: "Valid", permit: "Valid" } },
  { id: "VEH-03", name: "Honda City", number: "TN03 EF 1234", category: "Sedan", seats: 4, fuel: "Petrol", driver: "Suresh K.", vendor: "Sri Murugan Cabs", status: "On Trip", rate: "₹14/km", docs: { rc: "Valid", insurance: "Expiring", fitness: "Valid", permit: "Valid" } },
  { id: "VEH-04", name: "Maruti Dzire", number: "TN04 GH 5678", category: "Sedan", seats: 4, fuel: "Petrol", driver: "Vijay M.", vendor: "Tamil Nadu Fleet Co.", status: "Available", rate: "₹12/km", docs: { rc: "Valid", insurance: "Valid", fitness: "Expiring", permit: "Valid" } },
  { id: "VEH-05", name: "Tempo Traveller", number: "TN05 IJ 9012", category: "Tempo Traveller", seats: 12, fuel: "Diesel", driver: "Anand R.", vendor: "Tamil Nadu Fleet Co.", status: "Available", rate: "₹28/km", docs: { rc: "Valid", insurance: "Valid", fitness: "Valid", permit: "Valid" } },
  { id: "VEH-06", name: "Toyota Etios", number: "TN06 KL 3456", category: "Sedan", seats: 4, fuel: "Petrol", driver: "Kumar S.", vendor: "Rajan Fleet Services", status: "Maintenance", rate: "₹11/km", docs: { rc: "Valid", insurance: "Valid", fitness: "Expired", permit: "Expired" } },
  { id: "VEH-07", name: "Mercedes E-Class", number: "TN07 MN 7890", category: "Luxury", seats: 4, fuel: "Diesel", driver: "—", vendor: null, status: "Available", rate: "₹45/km", docs: { rc: "Valid", insurance: "Valid", fitness: "Valid", permit: "Valid" } },
];

// ── MARKETPLACE ───────────────────────────────────────────────
export const marketplaceTrips = [
  {
    id: "MKT-2024-001", bookingId: "NTT-2024-4825", pickup: "Tambaram, Chennai", drop: "Bangalore", date: "26 Aug 2024", time: "05:00 AM",
    vehicleType: "Innova/Crysta", distance: "350 km", offeredPayout: "₹7,500", status: "Open", postedAt: "2 hrs ago",
    bids: [],
  },
  {
    id: "MKT-2024-002", bookingId: "NTT-2024-4824", pickup: "Chennai Airport", drop: "Coimbatore", date: "25 Aug 2024", time: "09:00 AM",
    vehicleType: "Sedan", distance: "500 km", offeredPayout: "₹5,800", status: "Bid Received", postedAt: "5 hrs ago",
    bids: [
      { vendorId: "VEN-001", vendorName: "Sri Murugan Cabs", amount: "₹5,800", status: "Accepted", time: "3 hrs ago" },
      { vendorId: "VEN-002", vendorName: "Rajan Fleet Services", amount: "₹5,600", status: "Pending", time: "4 hrs ago" },
    ],
  },
  {
    id: "MKT-2024-003", bookingId: "NTT-2024-4823", pickup: "T. Nagar, Chennai", drop: "Ooty", date: "27 Aug 2024", time: "06:00 AM",
    vehicleType: "Tempo Traveller", distance: "540 km", offeredPayout: "₹14,000", status: "Counter Bid", postedAt: "1 hr ago",
    bids: [
      { vendorId: "VEN-003", vendorName: "Tamil Nadu Fleet Co.", amount: "₹15,500", status: "Counter", time: "30 min ago" },
    ],
  },
  {
    id: "MKT-2024-004", bookingId: "NTT-2024-4822", pickup: "Velachery, Chennai", drop: "Tirupati", date: "25 Aug 2024", time: "04:00 AM",
    vehicleType: "Innova", distance: "138 km", offeredPayout: "₹3,200", status: "Open", postedAt: "30 min ago",
    bids: [],
  },
  {
    id: "MKT-2024-005", bookingId: "NTT-2024-4821", pickup: "Anna Nagar, Chennai", drop: "Pondicherry", date: "24 Aug 2024", time: "07:00 AM",
    vehicleType: "Sedan", distance: "162 km", offeredPayout: "₹2,800", status: "Closed", postedAt: "1 day ago",
    bids: [
      { vendorId: "VEN-001", vendorName: "Sri Murugan Cabs", amount: "₹2,800", status: "Accepted", time: "22 hrs ago" },
    ],
  },
];

// ── LIVE TRIPS ────────────────────────────────────────────────
export const liveTrips = [
  {
    id: "TRP-4820", bookingId: "NTT-2024-4820", driver: "Rajan P.", vehicle: "TN02 CD 6789 • Innova Crysta",
    pickup: "T. Nagar, Chennai", drop: "Bangalore", status: "Trip Started", startedAt: "08:12 AM",
    eta: "3h 45m", currentLocation: "Krishnagiri, TN", boardingOTPVerified: true, fare: "₹4,800",
    vendor: "Rajan Fleet Services",
    preTrip: {
      selfie: "https://placehold.co/120x120/E21B23/fff?text=Selfie",
      vehicleFront: "https://placehold.co/120x120/111/fff?text=Front",
      odometer: "https://placehold.co/120x120/444/fff?text=ODO",
      rearSeat: "https://placehold.co/120x120/777/fff?text=Rear",
    },
  },
  {
    id: "TRP-4819", bookingId: "NTT-2024-4819", driver: "Suresh K.", vehicle: "TN03 EF 1234 • Honda City",
    pickup: "Adyar, Chennai", drop: "Multiple Stops", status: "Waiting at Pickup", startedAt: "09:05 AM",
    eta: "—", currentLocation: "Adyar, Chennai", boardingOTPVerified: false, fare: "₹2,100",
    vendor: "Sri Murugan Cabs",
    preTrip: {
      selfie: "https://placehold.co/120x120/E21B23/fff?text=Selfie",
      vehicleFront: "https://placehold.co/120x120/111/fff?text=Front",
      odometer: "https://placehold.co/120x120/444/fff?text=ODO",
      rearSeat: "https://placehold.co/120x120/777/fff?text=Rear",
    },
  },
  {
    id: "TRP-4815", bookingId: "NTT-2024-4815", driver: "Murugan S.", vehicle: "TN01 AB 2345 • Toyota Innova",
    pickup: "Perambur, Chennai", drop: "Tirupati", status: "En Route to Pickup", startedAt: "04:00 AM",
    eta: "15 min", currentLocation: "Perambur, Chennai", boardingOTPVerified: false, fare: "₹3,600",
    vendor: "Rajan Fleet Services",
    preTrip: {
      selfie: "https://placehold.co/120x120/E21B23/fff?text=Selfie",
      vehicleFront: "https://placehold.co/120x120/111/fff?text=Front",
      odometer: "https://placehold.co/120x120/444/fff?text=ODO",
      rearSeat: "https://placehold.co/120x120/777/fff?text=Rear",
    },
  },
];

// ── PENALTIES ─────────────────────────────────────────────────
export const penalties = [
  { id: "PNL-001", type: "Driver", entity: "Selvam T.", entityId: "DRV-107", reason: "Trip Cancellation (< 2 hrs)", amount: "₹500", walletDeducted: true, custCompensation: "₹250", date: "10 Aug 2024", status: "Applied", bookingId: "NTT-2024-4780" },
  { id: "PNL-002", type: "Driver", entity: "Kumar S.", entityId: "DRV-106", reason: "No-Show at Pickup", amount: "₹1,000", walletDeducted: true, custCompensation: "₹500", date: "12 Aug 2024", status: "Applied", bookingId: "NTT-2024-4785" },
  { id: "PNL-003", type: "Vendor", entity: "Kings Cabs", entityId: "VEN-006", reason: "Multiple Driver Cancellations", amount: "₹5,000", walletDeducted: true, custCompensation: "₹1,000", date: "08 Aug 2024", status: "Applied", bookingId: "NTT-2024-4770" },
  { id: "PNL-004", type: "Driver", entity: "Rajan P.", entityId: "DRV-102", reason: "Late Pickup (> 30 min)", amount: "₹300", walletDeducted: false, custCompensation: "₹150", date: "18 Aug 2024", status: "Disputed", bookingId: "NTT-2024-4800" },
  { id: "PNL-005", type: "Vendor", entity: "Kings Cabs", entityId: "VEN-006", reason: "Vehicle Document Lapse", amount: "₹2,500", walletDeducted: true, custCompensation: "₹0", date: "05 Aug 2024", status: "Applied", bookingId: "—" },
  { id: "PNL-006", type: "Driver", entity: "Selvam T.", entityId: "DRV-107", reason: "Behavioral Complaint", amount: "₹1,000", walletDeducted: false, custCompensation: "₹0", date: "20 Aug 2024", status: "Pending", bookingId: "NTT-2024-4810" },
];

export const penaltyRules = [
  { trigger: "Driver cancels < 2 hrs before pickup", driverPenalty: "₹500", custCompensation: "50% of penalty", timing: "Immediate" },
  { trigger: "Driver cancels < 30 min before pickup", driverPenalty: "₹1,000", custCompensation: "50% of penalty", timing: "Immediate" },
  { trigger: "Driver no-show at pickup", driverPenalty: "₹1,000", custCompensation: "₹500 flat", timing: "Post complaint" },
  { trigger: "Vendor cancels trip assigned", driverPenalty: "₹2,500 (Vendor)", custCompensation: "₹500 flat", timing: "Immediate" },
  { trigger: "Driver late > 30 min (verified)", driverPenalty: "₹300", custCompensation: "₹150 flat", timing: "Post complaint" },
  { trigger: "Behavioral complaint verified", driverPenalty: "₹1,000", custCompensation: "₹0", timing: "Post review" },
];

// ── DRIVER EARNINGS ───────────────────────────────────────────
export const driverEarnings = [
  { driverId: "DRV-101", driver: "Murugan S.", vendor: "Sri Murugan Cabs", tripsThisMonth: 124, grossEarnings: "₹44,200", commission: "₹6,630 (15%)", netEarnings: "₹37,570", tdsDeducted: "₹442", walletBalance: "₹12,400", pendingPayout: "₹0", lastPayout: "15 Aug 2024" },
  { driverId: "DRV-102", driver: "Rajan P.", vendor: "Rajan Fleet Services", tripsThisMonth: 98, grossEarnings: "₹38,400", commission: "₹4,608 (12%)", netEarnings: "₹33,792", tdsDeducted: "₹384", walletBalance: "₹8,200", pendingPayout: "₹15,000", lastPayout: "10 Aug 2024" },
  { driverId: "DRV-103", driver: "Suresh K.", vendor: "Sri Murugan Cabs", tripsThisMonth: 87, grossEarnings: "₹32,100", commission: "₹4,815 (15%)", netEarnings: "₹27,285", tdsDeducted: "₹321", walletBalance: "₹6,800", pendingPayout: "₹0", lastPayout: "20 Aug 2024" },
  { driverId: "DRV-104", driver: "Vijay M.", vendor: "Tamil Nadu Fleet Co.", tripsThisMonth: 62, grossEarnings: "₹22,800", commission: "₹2,280 (10%)", netEarnings: "₹20,520", tdsDeducted: "₹228", walletBalance: "₹4,500", pendingPayout: "₹8,000", lastPayout: "12 Aug 2024" },
  { driverId: "DRV-105", driver: "Anand R.", vendor: "Tamil Nadu Fleet Co.", tripsThisMonth: 108, grossEarnings: "₹41,200", commission: "₹4,120 (10%)", netEarnings: "₹37,080", tdsDeducted: "₹412", walletBalance: "₹9,100", pendingPayout: "₹20,000", lastPayout: "18 Aug 2024" },
];

// ── VENDOR FINANCE ────────────────────────────────────────────
export const vendorFinance = [
  { vendorId: "VEN-001", vendor: "Sri Murugan Cabs", tripsThisMonth: 211, grossRevenue: "₹76,300", commission: "₹11,445 (15%)", vendorEarning: "₹64,855", gstPayable: "₹3,815", tdsDeducted: "₹763", netPayout: "₹60,277", walletBalance: "₹42,800", pendingPayout: "₹0", lastPayout: "20 Aug 2024", razorpayRoute: "Settled" },
  { vendorId: "VEN-002", vendor: "Rajan Fleet Services", tripsThisMonth: 324, grossRevenue: "₹1,24,800", commission: "₹14,976 (12%)", vendorEarning: "₹1,09,824", gstPayable: "₹6,240", tdsDeducted: "₹1,248", netPayout: "₹1,02,336", walletBalance: "₹68,400", pendingPayout: "₹0", lastPayout: "22 Aug 2024", razorpayRoute: "Settled" },
  { vendorId: "VEN-003", vendor: "Tamil Nadu Fleet Co.", tripsThisMonth: 512, grossRevenue: "₹2,12,400", commission: "₹21,240 (10%)", vendorEarning: "₹1,91,160", gstPayable: "₹10,620", tdsDeducted: "₹2,124", netPayout: "₹1,78,416", walletBalance: "₹1,24,200", pendingPayout: "₹40,000", lastPayout: "15 Aug 2024", razorpayRoute: "Processing" },
  { vendorId: "VEN-006", vendor: "Kings Cabs", tripsThisMonth: 0, grossRevenue: "₹0", commission: "₹0", vendorEarning: "₹0", gstPayable: "₹0", tdsDeducted: "₹0", netPayout: "₹0", walletBalance: "₹-8,500", pendingPayout: "₹0", lastPayout: "10 Aug 2024", razorpayRoute: "On Hold" },
];

// ── PAYMENTS ──────────────────────────────────────────────────
export const payments = [
  { id: "TXN-84921", bookingId: "NTT-2024-4821", customer: "Rajesh Kumar", amount: "₹1,250", method: "UPI", gateway: "PhonePe", date: "24 Aug 2024", status: "Success", refund: "—", gst: "₹59.5", vendorShare: "₹1,062.5", commission: "₹187.5" },
  { id: "TXN-84920", bookingId: "NTT-2024-4820", customer: "Priya Sharma", amount: "₹4,800", method: "Credit Card", gateway: "Razorpay", date: "24 Aug 2024", status: "Success", refund: "—", gst: "₹228.6", vendorShare: "₹4,224", commission: "₹576" },
  { id: "TXN-84919", bookingId: "NTT-2024-4819", customer: "Arun Venkatesh", amount: "₹2,100", method: "Cash", gateway: "—", date: "24 Aug 2024", status: "Pending", refund: "—", gst: "₹100", vendorShare: "₹1,785", commission: "₹315" },
  { id: "TXN-84918", bookingId: "NTT-2024-4818", customer: "Meenakshi R.", amount: "₹1,850", method: "UPI", gateway: "GPay", date: "23 Aug 2024", status: "Success", refund: "—", gst: "₹88.1", vendorShare: "₹1,572.5", commission: "₹277.5" },
  { id: "TXN-84817", bookingId: "NTT-2024-4817", customer: "Karthik Sundaram", amount: "₹12,500", method: "Net Banking", gateway: "Razorpay", date: "23 Aug 2024", status: "Success", refund: "—", gst: "₹595.2", vendorShare: "₹11,250", commission: "₹1,250" },
  { id: "TXN-84814", bookingId: "NTT-2024-4814", customer: "Santha Kumari", amount: "₹2,400", method: "Debit Card", gateway: "Razorpay", date: "22 Aug 2024", status: "Refunded", refund: "₹2,400", gst: "₹0", vendorShare: "₹0", commission: "₹0" },
];

// ── GST / TDS RECORDS ─────────────────────────────────────────
export const gstRecords = [
  { month: "Aug 2024", totalTripRevenue: "₹3,84,200", gstRate: "5%", gstCollected: "₹19,210", gstPayable: "₹19,210", status: "Pending" },
  { month: "Jul 2024", totalTripRevenue: "₹3,41,000", gstRate: "5%", gstCollected: "₹17,050", gstPayable: "₹17,050", status: "Filed" },
  { month: "Jun 2024", totalTripRevenue: "₹2,98,000", gstRate: "5%", gstCollected: "₹14,900", gstPayable: "₹14,900", status: "Filed" },
];

export const tdsRecords = [
  { month: "Aug 2024", totalPayouts: "₹3,84,200", tdsRate: "1%", tdsDeducted: "₹3,842", driverCommissions: "₹42,100", status: "Pending" },
  { month: "Jul 2024", totalPayouts: "₹3,41,000", tdsRate: "1%", tdsDeducted: "₹3,410", driverCommissions: "₹38,900", status: "Filed" },
  { month: "Jun 2024", totalPayouts: "₹2,98,000", tdsRate: "1%", tdsDeducted: "₹2,980", driverCommissions: "₹32,100", status: "Filed" },
];

// ── NOTIFICATIONS ─────────────────────────────────────────────
export const notifications = [
  { id: 1, type: "booking", title: "New Booking Received", message: "Booking NTT-2024-4826 from Deepa Ramesh for Airport Taxi to Chennai Airport", time: "2 min ago", read: false },
  { id: 2, type: "payment", title: "Payment Received", message: "₹4,800 received for booking NTT-2024-4820 via Credit Card (Razorpay)", time: "15 min ago", read: false },
  { id: 3, type: "trip", title: "Trip Completed", message: "Trip NTT-2024-4817 completed by driver Anand R. • ₹12,500", time: "1 hr ago", read: false },
  { id: 4, type: "alert", title: "Vehicle Maintenance Alert", message: "Toyota Etios (TN06 KL 3456) insurance is expiring in 7 days", time: "2 hr ago", read: true },
  { id: 5, type: "vendor", title: "New Vendor Registration", message: "Metro Cab Network (VEN-005) has submitted registration documents for review", time: "3 hr ago", read: true },
  { id: 6, type: "penalty", title: "Penalty Applied", message: "₹500 penalty applied to DRV-107 Selvam T. for trip cancellation on NTT-2024-4780", time: "4 hr ago", read: true },
  { id: 7, type: "marketplace", title: "Counter Bid Received", message: "Tamil Nadu Fleet Co. placed counter bid of ₹15,500 on trip MKT-2024-003 (Ooty route)", time: "5 hr ago", read: false },
  { id: 8, type: "driver", title: "New Driver Registration", message: "Selvam Kumar has submitted KYC documents for verification", time: "6 hr ago", read: true },
  { id: 9, type: "alert", title: "TDS Filing Reminder", message: "August 2024 TDS return due in 7 days. Total TDS collected: ₹3,842", time: "1 day ago", read: true },
  { id: 10, type: "payout", title: "Payout Processed", message: "₹1,78,416 Razorpay Route settlement processed for Tamil Nadu Fleet Co.", time: "2 days ago", read: true },
];

// ── STAFF / ROLES ─────────────────────────────────────────────
export const staff = [
  { id: "STF-001", name: "Pradeep Kumar", email: "pradeep@nesamtours.in", role: "Super Admin", phone: "+91 94567 00001", status: "Active", lastLogin: "24 Aug 2024, 09:00 AM", permissions: ["All Access"] },
  { id: "STF-002", name: "Sumathi Devi", email: "sumathi@nesamtours.in", role: "Booking Manager", phone: "+91 87654 00002", status: "Active", lastLogin: "24 Aug 2024, 08:30 AM", permissions: ["Bookings", "Customers", "Drivers"] },
  { id: "STF-003", name: "Kiran Raj", email: "kiran@nesamtours.in", role: "Finance Manager", phone: "+91 98765 00003", status: "Active", lastLogin: "23 Aug 2024, 06:00 PM", permissions: ["Payments", "Reports", "GST/TDS"] },
  { id: "STF-004", name: "Anitha S.", email: "anitha@nesamtours.in", role: "Fleet Coordinator", phone: "+91 76543 00004", status: "Active", lastLogin: "24 Aug 2024, 07:45 AM", permissions: ["Vendors", "Vehicles", "Drivers", "Marketplace"] },
  { id: "STF-005", name: "Ramesh V.", email: "ramesh@nesamtours.in", role: "Support Agent", phone: "+91 65432 00005", status: "Inactive", lastLogin: "20 Aug 2024, 03:00 PM", permissions: ["Bookings", "Customers"] },
];

export const roles = [
  { name: "Super Admin", permissions: ["Dashboard", "Bookings", "Customers", "Vendors", "Drivers", "Vehicles", "Marketplace", "Payments", "Penalties", "Reports", "Notifications", "Staff", "Settings"], color: "#E21B23" },
  { name: "Booking Manager", permissions: ["Dashboard", "Bookings", "Customers", "Drivers", "Vehicles", "Notifications"], color: "#3B82F6" },
  { name: "Finance Manager", permissions: ["Dashboard", "Payments", "Reports", "Invoices"], color: "#10B981" },
  { name: "Fleet Coordinator", permissions: ["Dashboard", "Vendors", "Vehicles", "Drivers", "Marketplace"], color: "#F59E0B" },
  { name: "Support Agent", permissions: ["Bookings", "Customers", "Notifications"], color: "#8B5CF6" },
];

// ── REPORTS DATA ──────────────────────────────────────────────
export const reportData = {
  bookingsByType: [
    { name: "Airport Taxi", thisMonth: 842, lastMonth: 780, growth: 7.9 },
    { name: "Outstation Cab", thisMonth: 634, lastMonth: 590, growth: 7.5 },
    { name: "One Way Taxi", thisMonth: 712, lastMonth: 640, growth: 11.3 },
    { name: "Local Rental", thisMonth: 398, lastMonth: 420, growth: -5.2 },
    { name: "Tour Package", thisMonth: 214, lastMonth: 178, growth: 20.2 },
  ],
  revenueByVendor: [
    { vendor: "Tamil Nadu Fleet Co.", revenue: 212400, trips: 512 },
    { vendor: "Rajan Fleet Services", revenue: 124800, trips: 324 },
    { vendor: "Sri Murugan Cabs", revenue: 76300, trips: 211 },
    { vendor: "Direct (No Vendor)", revenue: 31200, trips: 94 },
  ],
  cancellationReasons: [
    { reason: "Driver Cancelled", count: 38, pct: 42 },
    { reason: "Customer Cancelled", count: 28, pct: 31 },
    { reason: "Vehicle Unavailable", count: 14, pct: 15 },
    { reason: "Payment Failed", count: 11, pct: 12 },
  ],
};

// ── SERVICES / FARE RULES ─────────────────────────────────────
export const fareRules = [
  { id: "FAR-01", service: "Airport Taxi", vehicleType: "Sedan", baseFare: "₹350", perKm: "₹12", driverBatta: "₹250", waitingPerHr: "₹80", nightSurcharge: "20%", gst: "5%" },
  { id: "FAR-02", service: "Airport Taxi", vehicleType: "Innova", baseFare: "₹450", perKm: "₹18", driverBatta: "₹350", waitingPerHr: "₹100", nightSurcharge: "20%", gst: "5%" },
  { id: "FAR-03", service: "Outstation", vehicleType: "Sedan", baseFare: "₹0", perKm: "₹14", driverBatta: "₹300/day", waitingPerHr: "₹100", nightSurcharge: "15%", gst: "5%" },
  { id: "FAR-04", service: "Outstation", vehicleType: "Innova", baseFare: "₹0", perKm: "₹20", driverBatta: "₹400/day", waitingPerHr: "₹120", nightSurcharge: "15%", gst: "5%" },
  { id: "FAR-05", service: "Local Rental", vehicleType: "Sedan", baseFare: "₹800/4hrs", perKm: "₹12", driverBatta: "₹150", waitingPerHr: "₹80", nightSurcharge: "10%", gst: "5%" },
];
