# NESAM new documents: requirements and code gap analysis

Date: 09 October 2026. Scope: all 43 pages in the three PDFs under `E:\Legendary One\nesam documents\new`, compared with the current local source tree. This is a static code review, not a runtime, accounting, legal, or production certification. Existing uncommitted changes were preserved.

## Reading order and precedence

1. `Nesam_Developer_Functional_Specification_v1_0.pdf` (16 pages, 08 Oct) defines earlier workflow and examples. It explicitly leaves D01-D10 open.
2. `Nesam_Vehicle_Category_and_Vendor_Duty_Rules.pdf` (3 pages, 08 Oct) adds the five-category vehicle matrix and unrestricted **vendor listing/claim** visibility, while keeping assignment eligibility strict.
3. `Nesam_Developer_Tariff_and_Operations_v2_0.pdf` (24 pages, 09 Oct) supersedes the old normal-duty 10% commission and rolling-time interpretations. It expressly says that it has **not** inspected the application. Its D01-D15 decisions remain open.

The user's direct instruction in this conversation requires **no driver selfie** and **three live vehicle photos** (front, rear, dashboard/interior). Both functional/tariff PDFs still demand a selfie and only a front vehicle photo for trip evidence. This is a source conflict; the user instruction takes precedence. Another conflict is immediate visibility of approved bookings to all eligible independent drivers/vendors versus the PDFs' 0/2/3-minute staged release. Do not silently choose the PDFs' timing as approved policy.

## Highest-priority confirmed gaps

| Priority | Requirement and document location | Current code evidence | Assessment |
|---|---|---|---|
| P0 | Normal duties use fixed partner tariffs, not 10% commission (v2 pp. 2-4, 10) | `functions/src/commerce.ts` still requires `loadCommissionPolicy` and calls `partnerPayoutFor`; `functions/src/domain/finance.ts` calculates payout as a percentage of fare; `functions/src/marketplace.ts` derives default offers from commission. | Material commercial mismatch. New bookings and partner settlement may use the superseded model. No tariff migration or rollout is evidenced. |
| P0 | New customer tariffs, 130-km normal one-way minimum, calendar-day round trips, rental/city/multi-city modes, fixed-route exception (v2 pp. 3-8) | `functions/src/domain/pricing.ts` uses generic category rates, `legs = 2` for round trips, 12-hour allowance, and hard-coded GST 5%. Admin has a separate fixed-route rule UI, but the authoritative server path shown here does not apply the v2 service-specific tariffs. | Do not deploy new tariffs until server pricing, previews, booking snapshots, invoice, settlement, and parity tests agree. Rental distance must stay gated by D01. |
| P0 | Customer phone: vendor always masked; assigned driver only from T-8h; audit every reveal (v2 p. 16) | `firestore.rules` allows an assigned vendor/driver to read the entire `bookings/{id}` document containing `phone`. `vendor/app/src/services/vendorService.ts` maps that raw number and `vendor/app/src/screens/TripsScreen.tsx` offers a Call button. | Direct privacy-rule violation. A UI mask alone cannot fix the payload leak. Separate protected contact storage/read API and audit are required. |
| P0 | Vehicle matrix and seating checks on server (addendum pp. 1-3; v2 p. 14) | `firestore.rules` checks an `eligibleVehicleTypes` alias list for independent drivers, but vendor dispatch checks ownership, approval and vehicle number, without explicit matrix/capacity checks. `driver/app/src/utils/earnings.ts` uses loose string matching. | Matrix cases V01-V10 are not demonstrated. A Sedan can potentially be assigned to a Crysta duty through the current vendor rule. |
| P0 | Reached Pickup requires fresh server-validated location within approved radius (v1 pp. 6-7; v2 p. 11) | `functions/src/trips.ts` sets `PICKUP_RADIUS_KM = 2` and records `location_unavailable` while allowing Reached if no fix/coordinates exist. | The docs' working value is 3 km, subject to D11; user approval is needed for final radius. Regardless of radius, unavailable location must not silently pass a required location gate. |
| P0 | End Trip accepts total billable Trip KM and calculates final fare/extra distance (v1 pp. 7-9, 15; v2 pp. 3, 11-12) | `driver/app/src/screens/TripScreen.tsx` and web ask for `endOdometer`; `functions/src/trips.ts` stores ending odometer and completes, with no final fare calculation in this path. | The required total-KM input and final invoice adjustment are not implemented by this transition. Existing finance finalization may lock an unchanged quote. |
| P1 | Normal-duty timed release and marketplace post modes/escalating offer (v1 p. 5; v2 pp. 8-9, 14) | `functions/src/bookingOps.ts` opens the marketplace record immediately on approval and announces to eligible drivers/vendors. `functions/src/marketplace.ts` has one offer amount and bid/assign actions. No 120/180-second release or hourly 5%/ceiling scheduler was found. | Current behaviour follows the user's earlier immediate-visibility request, but conflicts with the PDFs. Marketplace accept and admin-reviewed bidding need a selected mode before the new escalation rule can be implemented. |
| P1 | Four-hour partner payout due/overdue workflow (v2 p. 12) | `functions/src/ledger.ts` provides wallets and payout requests, but no completion+4h due timestamp or overdue scheduler was found. | Not evidenced; requires receipt validation, holds, transfer confirmation and idempotent retry. |

## Page-by-page review: functional specification v1.0

| Page | Requirements reviewed | Code/document conclusion |
|---|---|---|
| 1 | Document control, confirmed/recommended/decision notation, scope | A development brief, not proof of implementation. Its 08 Oct date matters for v2 supersession. |
| 2 | Customer/Admin/owner-driver/vendor/vendor-driver roles; fleet driver denied marketplace/wallet | Role separation exists in parts of rules and apps; server-side role/ownership checks still need all A01-A04 flows verified. |
| 3 | Driver documents and approval; vendor application/invitation; account states | Approval/onboarding modules exist. Vendor entry choice D03 remains a business decision. Selfie requirement conflicts with user's later direct instruction for trip selfies; identity onboarding selfie is a separate decision to clarify. |
| 4 | Stable driver/vehicle IDs, separate membership, admin-controlled transfers, schedule overlap | Separate IDs/relations partly exist. Current vendor dispatch blocker rejects any other Assigned/Ongoing booking rather than computing a time-window/travel buffer; transfer/overlap policy is incomplete. |
| 5 | Approval-triggered 0/120/180-second release, atomic claim, vendor reserve then assign | Atomic claim patterns exist; staged release was not found. This conflicts with the user's immediate-visibility request. D01/D06 open. |
| 6 | Start-for-pickup evidence, Reached, OTP, In Progress, Trip KM, invoice/settlement separation | OTP and ordered trip states exist. Selfie/front-photo steps conflict with user's three-photo instruction. Total Trip KM/final fare gap is confirmed. |
| 7 | Focused vendor-driver UI, 3-km working geofence, current-trip evidence, total KM | Mobile fleet controls are partly hidden, but exact permission/data checks need tests. Code radius is 2 km and can pass without location. End input is odometer, not total KM. |
| 8 | 300/310-km Sedan worked fare, GST and commission assumptions | Useful acceptance fixture for old model only. v2 explicitly replaces normal-duty 10% commission; tax is still pending CA/business approval. |
| 9 | Same customer/driver invoice, confirmed receipts, balance, refunds, partner-collected UPI | Payment summary and collector fields exist; final invoice cannot be considered correct until total-KM repricing and payer/recipient reconciliation are verified. |
| 10 | Old 10%-commission settlement and partner ownership | Vendor-versus-driver ownership is represented. Commercial calculation is superseded by v2 fixed partner tariffs. |
| 11 | Proposed below-₹300 wallet routing and immutable ledger | Ledger architecture exists. D07 remains open and must not be auto-enabled from this example. |
| 12 | Logical account, vehicle, booking, offer, assignment, invoice, ledger and audit records | Several records exist. Quote/payout/tax/version snapshots need review against the new v2 model. |
| 13 | Server authorization, claim atomicity, state/payment/ledger idempotency, conflict, expiry, offline handling | Some controls exist. Schedule overlap, document expiry, phone release and final fare remain material gaps. |
| 14 | Access/trip acceptance A01-A14 | Existing automated checks are not evidence for every listed scenario, especially A06, A09-A10, A12-A14 and owner/vendor-driver parity. |
| 15 | Money acceptance M01-M14 | Numeric examples use the old 10% model; do not turn these into new-production expected payouts. Rework fixtures after v2 tariff/tax decisions. |
| 16 | D01-D10 register and references | Many choices remain open; v2 expands and supersedes them. Legal/tax references were not independently assessed in this review. |

## Page-by-page review: tariff and operations v2.0

| Page | Requirements reviewed | Code/document conclusion |
|---|---|---|
| 1 | New confirmed fixed-route marketplace and Indian-calendar-day round trips; rental distance unresolved | Treat as the highest-version tariff document; no claim of existing implementation. |
| 2 | Confirmed/proposed/pending hierarchy; NORMAL_RATE vs MARKETPLACE_ACCEPTED_AMOUNT; old commission superseded | Current source still uses percentage commission for ordinary bookings and default marketplace offers. Major mismatch. |
| 3 | One-way Sedan/SUV/Crysta customer and partner rates; 130-km floor; extra KM | New fixed rates/floor not found in authoritative server pricing. Partner floor is itself D03, so do not guess it. |
| 4 | Round-trip daily minimums and bata by Indian calendar day | Current server doubles route distance and uses duration-based allowance. Midnight case needs new implementation/test. Partner SUV/Crysta interpretation remains D03. |
| 5 | Rental hour/minute formula; higher of time and distance; unresolved 50/70/80 meaning | Current generic per-minute pricing is not this rental contract. Keep automatic distance component gated until D01/D02. |
| 6 | Local city drop 20-km package and extra rates; carrier/hills/pet/permit extras | Service-specific city-drop tariffs and add-on allocation not found. Charge units/partner shares remain D05. |
| 7 | State rate table and permits; same-day multi-city via-route/halt | No evidence of the complete state matrix or multi-city tariff. Missing entries cannot default to zero. D06/D07 open. |
| 8 | Direction-specific fixed routes bypass 130-km minimum and use accepted marketplace payout | Admin has fixed-route configuration, but authoritative booking/settlement integration is not demonstrated. Route matching must use place IDs/zones and direction. D08 open. |
| 9 | Hourly 5% offer rise to ceiling; explicit accept-vs-admin-bid mode; atomic stop | No offer increment scheduler/ceiling or per-post mode found. D09 open. |
| 10 | Partner entitlement minus actual partner collections; no old commission deduction; tax separate | Current ledger is a good base but its entitlement comes from the old commission-derived payout. New tariff and collection cases need parity tests. |
| 11 | Driver execution, 3-km working radius, trip KM, live evidence | Current three-photo/no-selfie path follows user instruction. Radius/location bypass and end-odometer mismatch need correction/decision. |
| 12 | Confirmed payment, overpayment, completed+4h payout, invoice | Payment records exist; four-hour payout due state not found. Tax and under-₹300 interplay unresolved. |
| 13 | Identity/vehicle/member separation; admin emergency single-trip temporary ID | Some onboarding exists. No scoped temporary-ID workflow was found. Selfie language conflicts with user's direct no-selfie instruction for trip evidence. |
| 14 | Explicit vehicle matrix, vendors see all categories, owner-driver matching, staged release | Vendor broad visibility largely aligns. Server assignment matrix/capacity absent; staged release absent and conflicts with user's immediate-visibility request. |
| 15 | Future assignment with end+travel+buffer, at-risk recheck, alert ladder | Current vendor blocker treats any Assigned/Ongoing trip as busy. Existing unassigned 3h/1h alerts differ from proposed 8/4/2/1 ladder, which needs sign-off. |
| 16 | Driver phone reveal only from T-8h; vendor always masked; audit/revocation | Confirmed P0 privacy gap in rules and vendor app. Needs data-model/API change, not styling. |
| 17 | Document expiry blocks, 20-day reminder, inactivity, accident holds | Basic approval/status checks exist. Expiry-aware future assignment, 20-day scheduler, and full accident handover were not found. Thresholds remain pending. |
| 18 | Executive suspension/reassignment, higher-authority unblock, conduct cases | Staff permissions and manual suspension exist in parts. Exact scoped delegation, fixed durations, evidence/review/appeal are not evidenced. |
| 19 | Proposed cancellation/partner penalties, refunds, legal applicability gate | Penalty system and refunds exist. Do not automatically charge ₹300/₹500/₹1,000 until time windows and legal applicability are approved; no-show needs evidence. |
| 20 | Same app/call booking engine, sequential public IDs, notices, consent, rating | App/admin booking callables exist, but booking code is timestamp+request-ID prefix, not a shared sequential `NTT-YYYY-NNNNNN`. Role-specific notices/rating need scenario tests. |
| 21 | Seasonal directional prices, reports, exact money, UTC/IST/versioning | No approved automatic surge; new seasonal precedence/report set not evidenced. Current pricing uses JS floating-point rupees and hard-coded GST, contrary to the stated paise/exact-decimal settlement requirement. |
| 22 | Acceptance cases | These are specifications, not passed software tests. Several cases fail static comparison (old tariff, T-8h phone, 3-km location, category matrix); tests must be added only after business decisions are fixed. |
| 23 | D01-D15 decision register | Preserve every unresolved decision as a release gate. Fixed-route payout and calendar-day round trips are stated resolved, but code still needs migration. |
| 24 | Policy research/source links | Not a legal approval. Do not copy competitor terms or enable contested charges without applicability review. This audit does not verify the external sources. |

## Page-by-page review: vehicle category/vendor duty addendum

| Page | Requirements reviewed | Code/document conclusion |
|---|---|---|
| 1 | 7 vehicle types × 5 duties = 35 explicit matrix cells; seat capacity separate; vendor sees all | Current aliases/string matching are not the explicit matrix. Vendor listing may be broad, but assignment needs server-side matrix plus seats. |
| 2 | Vendor may accept without a matching car, then assign only an approved compatible driver/vehicle; consented category change | Claim and assignment are separate in the code. Current dispatch rule lacks category/seat checks and admin-consented requirement versioning. |
| 3 | V01-V10 matrix/capacity/claim/reassignment acceptance checks | No evidence of all 35 cells and V01-V10 in tests. Build a table-driven server/rules test suite after agreeing the booking/category schema. |

## Recommended implementation order

1. **Contain customer-phone exposure** before more partner testing or release. Move raw contact out of broadly readable booking documents; provide server-authorized T-8h driver access and audit, while vendors receive masked values only.
2. **Resolve direct-user/document conflicts and pending commercial decisions**: no-selfie scope (trip vs onboarding), immediate vs staged duty visibility, final pickup radius/location policy, rental distance, tax, payout/cancellation rules.
3. **Implement v2 tariff/settlement with versioned quote snapshots** in the server first; migrate previews, admin configuration, invoice, wallet and tests together. Keep existing confirmed bookings on their stored agreement.
4. **Implement explicit category/seating matrix** at listing, claim and assignment. Add schedule-overlap checks that distinguish future reservations from current execution.
5. **Complete trip KM and final invoice/collection**, then four-hour payout due/hold/escalation. Do not financially finalize an unverified unchanged quote.
6. Add fixed-route marketplace mode/ceiling and appropriate timing only after D08/D09 and visibility conflict are settled. Add document expiry, phone audit, temporary IDs, staff delegation and exception workflows.
7. Run the new acceptance fixtures and end-to-end role tests. Reconcile every amount and state, and document what cannot be verified without live provider credentials or device checks.

## Review limits

- No application code, Firebase data, or PDFs were modified.
- Static searches prove the cited code paths exist or conflict; absence of a search hit is not proof that no alternative path exists. All recommended changes require an implementation review and runtime tests.
- The PDFs distinguish confirmed, proposed and pending policy. This report does not approve tax treatment, legal applicability, tariff gaps or disputed business choices.
