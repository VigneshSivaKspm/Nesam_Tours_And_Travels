import {
  FareRule,
  FareCalculationInput,
  FareCalculationResult,
  FareBreakdownItem,
  VehicleCategory,
} from "../types";

/**
 * Checks if a given time string "HH:MM" falls within a night window (e.g. "22:00" to "05:00")
 * Handles windows crossing midnight correctly.
 */
export function isNightTime(pickupTime?: string, startTime = "22:00", endTime = "05:00"): boolean {
  if (!pickupTime) return false;
  
  const parseMinutes = (t: string) => {
    const [h, m] = t.split(":").map((n) => parseInt(n, 10) || 0);
    return h * 60 + m;
  };

  const current = parseMinutes(pickupTime);
  const start = parseMinutes(startTime);
  const end = parseMinutes(endTime);

  if (start > end) {
    // Window crosses midnight (e.g., 22:00 to 05:00)
    return current >= start || current <= end;
  } else {
    // Normal window (e.g., 01:00 to 05:00)
    return current >= start && current <= end;
  }
}

/**
 * Find the best matching FareRule from active rules using deterministic precedence:
 * 1. Origin + Destination + Vehicle Category (Fixed Route)
 * 2. Service + Vehicle Category
 * 3. Vehicle Category
 */
export function findMatchingFareRule(
  rules: FareRule[],
  input: FareCalculationInput
): FareRule | null {
  const activeRules = rules.filter((r) => r.status === "Active");

  // 1. Exact Route Match
  if (input.originLocationId && input.destinationLocationId) {
    const routeMatch = activeRules.find(
      (r) =>
        r.pricingType === "FIXED_ROUTE" &&
        r.vehicleCategoryId === input.vehicleCategoryId &&
        r.originLocationId === input.originLocationId &&
        r.destinationLocationId === input.destinationLocationId
    );
    if (routeMatch) return routeMatch;
  }

  // 2. Service + Vehicle Category Match
  if (input.serviceId || input.serviceName) {
    const serviceMatch = activeRules.find(
      (r) =>
        (r.serviceId === input.serviceId || (input.serviceName && r.serviceName === input.serviceName)) &&
        r.vehicleCategoryId === input.vehicleCategoryId
    );
    if (serviceMatch) return serviceMatch;
  }

  // 3. Vehicle Category Specific Rule
  const categoryMatch = activeRules.find(
    (r) => r.vehicleCategoryId === input.vehicleCategoryId
  );
  if (categoryMatch) return categoryMatch;

  return null;
}

/**
 * CENTRAL FARE CALCULATION ENGINE
 * Pure, deterministic fare calculation used by New Booking, Fare Preview, and Invoices.
 */
export function calculateCentralFare(
  input: FareCalculationInput,
  fareRules: FareRule[],
  vehicleCategories: VehicleCategory[] = []
): FareCalculationResult {
  const matchedRule = findMatchingFareRule(fareRules, input);

  // Fallback to vehicle category default fare parameters if no rule matched
  const fallbackCat = vehicleCategories.find((c) => c.id === input.vehicleCategoryId);
  let ruleToUse: Partial<FareRule> | null = matchedRule;

  let fallbackUsed = false;
  if (!ruleToUse && fallbackCat && fallbackCat.fare) {
    fallbackUsed = true;
    const f = fallbackCat.fare;
    ruleToUse = {
      name: `${fallbackCat.name} Category Base`,
      pricingType: "BASE_PLUS_PER_KM",
      baseFare: f.baseFare || 350,
      baseKm: f.baseKm || 10,
      perKmRate: f.perKmRate || 12,
      driverBatta: f.driverAllowance || f.outstationDriverBattaPerDay || 250,
      waitingChargePerHour: f.waitingChargePerHour || 80,
      tollMode: f.tollIncluded ? "Included" : "Excluded",
      parkingMode: f.parkingIncluded ? "Included" : "Excluded",
      permitCharge: f.permitCharge || 0,
      status: "Active",
    };
  }

  // Default baseline if completely unconfigured
  if (!ruleToUse) {
    ruleToUse = {
      name: "Default Taxi Rates",
      pricingType: "BASE_PLUS_PER_KM",
      baseFare: 350,
      baseKm: 10,
      perKmRate: 13,
      driverBatta: 250,
      waitingChargePerHour: 80,
      status: "Active",
    };
  }

  const breakdown: FareBreakdownItem[] = [];
  const days = Math.max(1, input.tripDays || 1);
  const distance = Math.max(0, input.distanceKm || 0);

  let baseFare = 0;
  let distanceFare = 0;
  let extraKmCharge = 0;
  let extraHourCharge = 0;
  let billableDistanceKm = distance;

  const pricingType = ruleToUse.pricingType || "BASE_PLUS_PER_KM";

  switch (pricingType) {
    case "FIXED_ROUTE": {
      baseFare = Math.round(ruleToUse.baseFare || 0);
      breakdown.push({
        label: `Fixed Route Base Fare (${input.originLocationName || "Origin"} → ${input.destinationLocationName || "Destination"})`,
        amount: baseFare,
      });
      break;
    }

    case "PER_KM": {
      const minKmDaily = ruleToUse.minimumKmPerDay || 0;
      const minKmTotal = minKmDaily * days;
      billableDistanceKm = Math.max(distance, minKmTotal);
      distanceFare = Math.round(billableDistanceKm * (ruleToUse.perKmRate || 0));

      if (minKmTotal > distance) {
        breakdown.push({
          label: `Min Distance Fare (${days} days @ ${minKmDaily} km/day = ${minKmTotal} km @ ₹${ruleToUse.perKmRate}/km)`,
          amount: distanceFare,
        });
      } else {
        breakdown.push({
          label: `Distance Fare (${billableDistanceKm} km @ ₹${ruleToUse.perKmRate}/km)`,
          amount: distanceFare,
        });
      }
      break;
    }

    case "HOURLY_RENTAL": {
      baseFare = Math.round(ruleToUse.baseFare || 0);
      const incKm = ruleToUse.baseKm || 40;
      const incHrs = ruleToUse.includedHours || 4;

      breakdown.push({
        label: `Package Base (${incHrs} hrs / ${incKm} km)`,
        amount: baseFare,
      });

      // Extra KM
      if (distance > incKm) {
        const extraKm = distance - incKm;
        extraKmCharge = Math.round(extraKm * (ruleToUse.extraKmRate || ruleToUse.perKmRate || 12));
        breakdown.push({
          label: `Extra KM Charge (${extraKm} km @ ₹${ruleToUse.extraKmRate || ruleToUse.perKmRate}/km)`,
          amount: extraKmCharge,
        });
      }

      // Extra Hours
      const hrs = input.tripHours || incHrs;
      if (hrs > incHrs) {
        const extraHrs = hrs - incHrs;
        extraHourCharge = Math.round(extraHrs * (ruleToUse.extraHourRate || ruleToUse.waitingChargePerHour || 100));
        breakdown.push({
          label: `Extra Hours Charge (${extraHrs} hrs @ ₹${ruleToUse.extraHourRate || 100}/hr)`,
          amount: extraHourCharge,
        });
      }
      break;
    }

    case "PER_DAY": {
      const minKmDaily = ruleToUse.minimumKmPerDay || 250;
      const minKmTotal = minKmDaily * days;
      billableDistanceKm = Math.max(distance, minKmTotal);
      distanceFare = Math.round(billableDistanceKm * (ruleToUse.perKmRate || 14));

      breakdown.push({
        label: `Outstation Distance Fare (${billableDistanceKm} km @ ₹${ruleToUse.perKmRate}/km)`,
        amount: distanceFare,
      });
      break;
    }

    case "BASE_PLUS_PER_KM":
    default: {
      baseFare = Math.round(ruleToUse.baseFare || 0);
      const baseKm = ruleToUse.baseKm || 0;
      breakdown.push({
        label: baseKm > 0 ? `Base Fare (includes first ${baseKm} km)` : "Base Fare",
        amount: baseFare,
      });

      if (distance > baseKm) {
        const extraKm = distance - baseKm;
        distanceFare = Math.round(extraKm * (ruleToUse.perKmRate || 0));
        breakdown.push({
          label: `Additional Distance (${extraKm} km @ ₹${ruleToUse.perKmRate}/km)`,
          amount: distanceFare,
        });
      }
      break;
    }
  }

  // Driver Batta / Allowance
  let driverBatta = 0;
  if (ruleToUse.driverBatta && ruleToUse.driverBatta > 0) {
    driverBatta = Math.round(ruleToUse.driverBatta * days);
    breakdown.push({
      label: `Driver Batta (${days} day${days > 1 ? "s" : ""} @ ₹${ruleToUse.driverBatta}/day)`,
      amount: driverBatta,
    });
  }

  // Night Surcharge
  let nightCharge = 0;
  if (
    ruleToUse.nightChargeEnabled &&
    isNightTime(input.pickupTime, ruleToUse.nightStartTime || "22:00", ruleToUse.nightEndTime || "05:00")
  ) {
    if (ruleToUse.nightChargeType === "Percentage") {
      const pct = (ruleToUse.nightChargeValue || 15) / 100;
      nightCharge = Math.round((baseFare + distanceFare) * pct);
      breakdown.push({
        label: `Night Surcharge (${ruleToUse.nightChargeValue}% for pickup between ${ruleToUse.nightStartTime || "22:00"}-${ruleToUse.nightEndTime || "05:00"})`,
        amount: nightCharge,
      });
    } else {
      nightCharge = Math.round(ruleToUse.nightChargeValue || 250);
      breakdown.push({
        label: `Night Allowance (Fixed ₹${nightCharge})`,
        amount: nightCharge,
      });
    }
  }

  // Waiting Charges
  let waitingCharge = 0;
  if (input.waitingMinutes && input.waitingMinutes > (ruleToUse.freeWaitingMinutes || 0)) {
    const billableMins = input.waitingMinutes - (ruleToUse.freeWaitingMinutes || 0);
    const billableHrs = Math.ceil(billableMins / 60);
    waitingCharge = Math.round(billableHrs * (ruleToUse.waitingChargePerHour || 80));
    breakdown.push({
      label: `Waiting Charge (${billableHrs} hrs @ ₹${ruleToUse.waitingChargePerHour || 80}/hr)`,
      amount: waitingCharge,
    });
  }

  // Toll, Parking, Permit
  let tollAmount = input.tollAmount || 0;
  if (ruleToUse.tollMode === "Fixed" && ruleToUse.fixedTollAmount) {
    tollAmount = ruleToUse.fixedTollAmount;
  }
  if (tollAmount > 0) {
    breakdown.push({ label: "Toll Charges", amount: tollAmount });
  }

  let parkingAmount = input.parkingAmount || 0;
  if (ruleToUse.parkingMode === "Fixed" && ruleToUse.fixedParkingAmount) {
    parkingAmount = ruleToUse.fixedParkingAmount;
  }
  if (parkingAmount > 0) {
    breakdown.push({ label: "Parking Charges", amount: parkingAmount });
  }

  let permitAmount = input.permitAmount || ruleToUse.permitCharge || 0;
  if (permitAmount > 0) {
    breakdown.push({ label: "Interstate Permit Charge", amount: permitAmount });
  }

  // Discount
  const discountAmount = Math.max(0, input.discountAmount || 0);
  if (discountAmount > 0) {
    breakdown.push({ label: "Discount Applied", amount: -discountAmount });
  }

  // Subtotal & GST (5% standard transport GST)
  const subtotal = Math.max(
    0,
    baseFare +
      distanceFare +
      extraKmCharge +
      extraHourCharge +
      driverBatta +
      nightCharge +
      waitingCharge +
      tollAmount +
      parkingAmount +
      permitAmount -
      discountAmount
  );

  const gstAmount = Math.round(subtotal * 0.05); // 5% GST
  const grandTotal = subtotal + gstAmount;

  breakdown.push({ label: "GST (5%)", amount: gstAmount });

  return {
    matchedRule: (ruleToUse as FareRule) || null,
    baseFare,
    distanceFare,
    driverBatta,
    nightCharge,
    waitingCharge,
    extraKmCharge,
    extraHourCharge,
    tollAmount,
    parkingAmount,
    permitAmount,
    discountAmount,
    subtotal,
    gstAmount,
    grandTotal,
    billableDistanceKm,
    breakdown,
    fallbackUsed,
  };
}
