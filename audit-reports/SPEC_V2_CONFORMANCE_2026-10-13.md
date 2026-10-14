# Tariff & Operations Specification v2.0 — conformance check

Checked 13 Oct 2026 against `NTT / DEV-SPEC 2.0` (24 pages). Method per row: **Fixed** = changed in this pass and tested; **Conforms** = code read and matches; **Gap** = feature is absent or differs (evidence given); **Not checked** = not inspected.
The spec itself says it "does not claim that the existing application already implements these features" — most of it does not.

## 1. Onboarding (page 13) — fixed

| Spec requirement | Before | Now |
|---|---|---|
| Owner-driver: mobile verification → licence, selfie, RC, insurance, FC, permit, vehicle-front photo → Admin review | 6-step wizard also collecting name, DOB, gender, e-mail, address, city, pincode, emergency contact, Aadhaar + 2 photos, PAN, bank account, make/model/year/colour/seats/fuel typed by hand, 4 vehicle photos, policy and permit numbers | 2 steps + review: **selfie + licence**, then **vehicle** (registration number → auto-detected; RC, insurance, FC, permit, front photo with validity dates). Nothing else. |
| Vehicle identity (page 2): model, seat capacity, fuel type, document validity | typed by hand | detected from the registration number; validity dates prefilled from the register and correctable from the document |
| Vendor: request in Vendor app → office issues **one-time invitation link** → business/account details + fleet documentation → Admin approval | anyone with a phone could self-create an application | request → invitation (single use, bound to the mobile, expires, only its hash stored) → business + account details → fleet documentation per vehicle → review. Self-creation is refused by the rules. |
| Vendor employee driver: vendor adds the driver by the driver's own verified mobile; membership + vehicle assignment unlock assigned trips only | existing invite flow, but the driver was still asked for a vehicle | invited driver registers with selfie + licence only; no vehicle step |
| No duplicate active vehicle registrations | none | lookup flags a plate held by another driver, vendor vehicle or pending vendor application (without saying whose) |
| Admin review | showed typed values only | shows the server-fetched register record next to what the partner declared, flags mismatches, lists register problems (cancelled RC, private class, expired insurance/FC/permit) |

| **Admin-only emergency single-trip identity** (verified mobile, licence, live selfie, vehicle; one booking only; expires on completion/cancellation; sessions revoked; records retained) | not present | **Not built.** It needs a server function that creates the restricted account, a booking-scoped lifetime with session revocation, rule changes that keep it out of the marketplace, and an Admin form. Left out rather than half-done; say if you want it. |
| Customer signup (not on page 13; page 20 names customer name/mobile and an *optional* e-mail) | name, e-mail (required), emergency contact (required), photo | name + optional e-mail. Photo and emergency contact are added later in Profile; the SOS sheet already works without an emergency contact. |
| Driver invites (vendor app, Admin) | required a driver name | mobile (+ optional vehicle) only — "the driver's own verified identity/mobile" |
| Auth screens (all apps), Admin staff signup | mobile + OTP only; staff: name, e-mail, password | unchanged — nothing beyond the credential |

Removed from onboarding by instruction (all still editable after approval where they existed in the profile): name, DOB, gender, e-mail, address, emergency contact, Aadhaar, PAN, bank (drivers), make/model/colour/year, policy/permit numbers, rear/side/interior photos; vendors: e-mail, alternate phone, address, business-registration document, identity proof, vehicle-types/fleet-size inputs.

Consequences you should know about:

- **Driver name** is no longer collected. Until staff record it from the licence the app shows "Driver ••3210". Admin cannot approve a driver without entering it.
- **Driver payout account** is no longer collected at signup (spec lists none). Drivers add it in Profile after approval, as the profile screen already allows; a payout request without one will not have a beneficiary. Page 13 also says never to create an unverified beneficiary — decide whether to gate the first payout on it.
- **Vendor GST / business registration** is not collected. Page 10 lists GST as pending (D04), so this is easy to add back once decided.

## 2. Vehicle auto-detection — what is real and what is not

- **There is no public mParivahan / VAHAN API for private companies.** mParivahan is a NIC citizen app; vehicle data reaches businesses only through a licensed intermediary (RC-verification providers such as Surepass, Signzy, IDfy, Karza) or an approved government requester account. I could not "get the API" — it needs a commercial agreement and key from you.
- Built: `lookupVehicleByRegistration` (server) — provider adapter driven by `VEHICLE_LOOKUP_PROVIDER` / `_API_KEY` / `_API_URL` (see `functions/.env.example`), 12-hour cache, 10 lookups/hour/user, owner name stored masked, address/phone not stored, result readable by staff only.
- **Not verified against a live provider** (no credentials here). The mapper accepts the common field spellings and is unit-tested with a Surepass-shaped payload; confirm with one real plate before go-live. An unfamiliar field name yields a record without that field, never a wrong value.
- Without credentials the function answers `not_configured`; the apps fall back to document upload plus a vehicle-type choice, and the reviewer verifies by eye. Detection never invents a vehicle.
- Not done on purpose: scraping the Parivahan site (captcha-protected, terms forbid automation).
- Category is a *suggestion*. It follows passenger seats (RC seating minus the driver), so a 5-seat compact SUV cannot become "SUV 6+1". Innova vs Crysta is read from the model name; Hycross is treated as Innova.

## 3. Rest of the specification — gaps found

| Page | Spec | Finding (evidence) |
|---|---|---|
| 2 | Fixed partner rates replace the flat commission | Gap — server pays partners via a configurable % commission policy (`business_config/commission`, `domain/finance.ts`). |
| 3 | One-way: 130 km floor, bata, partner per-km + bata | Gap — `domain/pricing.ts` is a generic base fare + per-km + per-minute + night + 5 % GST engine over admin-defined categories. No bata, no floor, no partner tariff. |
| 4 | Round trip billed by Indian calendar date | Gap — round trip is priced as 2 × route distance (`legs = 2`); no date-based days, minimum KM/day or bata/day. |
| 5 | Local rental: time fare, higher-of time/distance | Gap — no rental time-fare calculation server-side. D01/D02 are open decisions in the spec anyway. |
| 6–7 | Local city drop, add-ons, state charges, multi-city | Partial — category `carrierCharge` and `permitCharge` exist; no hills/pet add-ons, no state table, no multi-city product. |
| 8 | Fixed-route master → marketplace, accepted bid = payout | Gap — the Admin panel has a `FIXED_ROUTE` fare-rule type, but `functions/src` never reads `fare_rules`, so it cannot affect a real booking fare. |
| 9 | Marketplace: +5 %/hour to a ceiling, accept-current or admin-review mode | Gap — no escalation timer in `marketplace.ts` / `scheduler.ts`; no per-post mode. |
| 10 | Net settlement = entitlement − collections, no 10 % deduction | Not checked in detail — ledger/finance exist (`ledger.ts`, `finance.ts`) but run on the commission model above. |
| 11 | Pickup radius 3 km, boarding OTP, live capture | Partial — OTP and camera-session capture exist; the server's pickup radius is **2 km** (`trips.ts` `PICKUP_RADIUS_KM`), the spec's working value is 3 km (itself "subject to confirmation", D11). Left unchanged. |
| 12 | Payout due at completed_at + 4 h with states | Gap — no payout-due timer or Due/Processing/Paid/Failed/On Hold model. |
| 14 | Vehicle eligibility matrix; staged release 0/2/3 min | Gap — `categoryServesVehicle` is plain name equality, so an Innova cannot take Sedan/SUV duties as the matrix allows; no staged release. |
| 15 | Schedule-overlap check, alert ladder | Partial — unassigned-booking alerts exist (`scheduler.ts`); no driver/vehicle overlap check. |
| 16 | Customer phone: assigned driver from T−8 h, vendor always masked, audit | **Gap — privacy.** Driver app reads and dials `passengerPhone` for any assigned trip at any time; Vendor app shows `customerPhone` in trip lists. No reveal audit trail. |
| 17 | Expiry blocks, 20/7/3/1-day reminders, accident hold | Gap — no document-expiry job or auto-block. Onboarding now rejects already-expired documents. |
| 18 | Executive suspend/reassign, unblock is higher authority | Not checked — staff roles/permissions exist (`permissions.ts`). |
| 19 | ₹300 / ₹500 / ₹1,000 cancellation amounts | Gap — penalties are manual (`penalties.ts`, cap ₹1,00,000); no automatic rule. Spec also flags the MoRTH 10 %/₹100 cap as an applicability check. |
| 20 | Booking ID `NTT-2026-000001`, notifications, rating | Gap on ID — bookings use `NT<timestamp>-xxxxx` (`commerce.ts`). Notifications exist. |
| 21 | Seasonal pricing, reports | Not checked. |
| 22 | Acceptance cases | Cannot pass the pricing cases (₹2,350 / ₹7,800 / ₹1,150 …) until the tariff engine above exists. |

## 4. Recommended next work (in order)

1. Customer phone masking (page 16) — a privacy defect in shipped code, independent of tariff decisions.
2. Obtain a vehicle-data provider key and verify one real plate.
3. Decide D03/D04 and the commission-vs-fixed-partner-rate question, then build the tariff engine (pages 3, 4, 8, 9) with the page-22 cases as tests.
4. Document-expiry job and blocks (page 17); payout-due timer (page 12).

## 5. Verification run for this change

Functions `tsc` clean · domain tests 38/38 (new: 15 for vehicle registry and invitations) · Firestore rules 157/157 · Driver app `tsc`/eslint/jest 43/43 · Vendor app `tsc`/eslint/jest 28/28 · Admin, Driver web and Vendor web production builds · Android bundles for both apps export. **Not run:** the apps on a device or emulator, a deployed function against a real provider, and the Vendor/Driver web flows in a browser.
