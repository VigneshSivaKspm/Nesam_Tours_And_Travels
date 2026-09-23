import { RoleDefinition } from '../types';

export const roles: RoleDefinition[] = [
  { name: "Super Admin", permissions: ["Dashboard", "Bookings", "Customers", "Vendors", "Drivers", "Vehicles", "Marketplace", "Payments", "Penalties", "Reports", "Notifications", "Staff", "Settings"], color: "#E21B23" },
  { name: "Booking Manager", permissions: ["Dashboard", "Bookings", "Customers", "Drivers", "Vehicles", "Notifications"], color: "#3B82F6" },
  { name: "Finance Manager", permissions: ["Dashboard", "Payments", "Reports", "Invoices"], color: "#10B981" },
  { name: "Fleet Coordinator", permissions: ["Dashboard", "Vendors", "Vehicles", "Drivers", "Marketplace"], color: "#F59E0B" },
  { name: "Support Agent", permissions: ["Bookings", "Customers", "Notifications"], color: "#8B5CF6" },
];

export const penaltyRules = [
  { trigger: "Driver cancels < 2 hrs before pickup", driverPenalty: "₹500", custCompensation: "50% of penalty", timing: "Immediate" },
  { trigger: "Driver cancels < 30 min before pickup", driverPenalty: "₹1,000", custCompensation: "50% of penalty", timing: "Immediate" },
  { trigger: "Driver no-show at pickup", driverPenalty: "₹1,000", custCompensation: "₹500 flat", timing: "Post complaint" },
  { trigger: "Vendor cancels trip assigned", driverPenalty: "₹2,500 (Vendor)", custCompensation: "₹500 flat", timing: "Immediate" },
  { trigger: "Driver late > 30 min (verified)", driverPenalty: "₹300", custCompensation: "₹150 flat", timing: "Post complaint" },
  { trigger: "Behavioral complaint verified", driverPenalty: "₹1,000", custCompensation: "₹0", timing: "Post review" },
];

export const fareRules = [
  { id: "FAR-01", service: "Airport Taxi", vehicleType: "Sedan", baseFare: "₹350", perKm: "₹12", driverBatta: "₹250", waitingPerHr: "₹80", nightSurcharge: "20%", gst: "5%" },
  { id: "FAR-02", service: "Airport Taxi", vehicleType: "Innova", baseFare: "₹450", perKm: "₹18", driverBatta: "₹350", waitingPerHr: "₹100", nightSurcharge: "20%", gst: "5%" },
  { id: "FAR-03", service: "Outstation", vehicleType: "Sedan", baseFare: "₹0", perKm: "₹14", driverBatta: "₹300/day", waitingPerHr: "₹100", nightSurcharge: "15%", gst: "5%" },
  { id: "FAR-04", service: "Outstation", vehicleType: "Innova", baseFare: "₹0", perKm: "₹20", driverBatta: "₹400/day", waitingPerHr: "₹120", nightSurcharge: "15%", gst: "5%" },
  { id: "FAR-05", service: "Local Rental", vehicleType: "Sedan", baseFare: "₹800/4hrs", perKm: "₹12", driverBatta: "₹150", waitingPerHr: "₹80", nightSurcharge: "10%", gst: "5%" },
];
