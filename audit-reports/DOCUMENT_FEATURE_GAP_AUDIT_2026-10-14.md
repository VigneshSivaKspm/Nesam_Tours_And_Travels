# NESAM document-to-project feature gap audit

Reviewed: 14 October 2026, Asia/Kolkata.

## Scope and reading rules

Read all 43 pages of the three PDFs in `E:/Legendary One/nesam documents/new`:

| Reference | Document | Pages |
|---|---|---:|
| FRS | Nesam_Developer_Functional_Specification_v1_0.pdf | 16 |
| V2 | Nesam_Developer_Tariff_and_Operations_v2_0.pdf | 24 |
| ADD | Nesam_Vehicle_Category_and_Vendor_Duty_Rules.pdf | 3 |

Compared their requirements with the current local working tree, including its existing uncommitted onboarding changes, across Admin, Customer web/app, Driver web/app, Vendor web/app, Cloud Functions and Firestore rules. The tariff and matching tables were also rendered and visually checked.

This is a source-code conformance review. No production settings, installed APKs, provider credentials or live payment transfers were verified in this pass. No application code was changed and no new test-pass claims are made. Older audit reports were used for navigation, then findings were checked against source code.

V2 explicitly supersedes the older flat percentage commission model for normal duties with fixed partner tariffs. It also confirms calendar-date round trips and marketplace payout for fixed routes. Do not implement the superseded FRS financial example as the new production policy. The addendum's category/capacity matrix remains applicable.

**Status meanings:** Missing = the required workflow was not found in the inspected implementation; Partial = related functionality exists but does not meet the documented contract; Policy-gated = implementation is incomplete and automatic enforcement also needs a decision expressly left open by the documents. Recommendations are identified as recommendations.

The list below contains **32 grouped conformance gaps**, plus one concrete mobile assignment mismatch. These are groups of requirements, not a claim that the project has exactly 32 individual missing controls. No completion percentage is inferred.

## Priorities

- First: customer phone protection, assignment compatibility, document validity and pickup-location enforcement.
- Next: customer/partner tariff separation, final-KM invoice calculation and safe financial reversals.
- Then: dispatch waves, scheduling, payout deadlines, operational controls and reporting.
- Obtain the documented commercial decisions before enabling affected automatic charges or restrictions.

## A. Pricing, products and marketplace

| ID | Status | Required feature and current gap | Document | Code evidence |
|---|---|---|---|---|
| G01 | Partial | **Separate normal partner tariff from customer fare.** Normal duties should use the specified partner per-KM/package/bata policy; marketplace duties should use the accepted amount. The booking and posting paths still require a percentage commission policy and derive offered payout from it. Configurable commissions exist, but the V2 normal-rate model does not. | V2 pp.2-4,10 | `functions/src/domain/finance.ts:84`; `functions/src/commerce.ts:70`; `functions/src/marketplace.ts:97` |
| G02 | Partial | **One-way tariff contract.** Add a service-specific 130-KM customer floor, separate customer/partner rates and bata, and a locked included-KM/extra-KM calculation. Existing minimum fare and driver allowance fields are useful components, but the engine uses a generic base + distance model rather than this contract. Crysta one-way customer bata must follow the newer Rs600 value when configured. Partner floor remains D03. | V2 p.3 | `functions/src/domain/pricing.ts:114`; `functions/src/domain/types.ts:55` |
| G03 | Missing | **Calendar-day round trips.** Use Indian pickup/end dates, daily minimum KM and daily customer/partner bata. Current calculation doubles route distance/time and derives allowance from each 12 hours of driving. It has no return-date input in its fare contract. | V2 p.4 | `functions/src/domain/pricing.ts:116`; `functions/src/commerce.ts:35` |
| G04 | Policy-gated | **Local rental engine.** The confirmed minimum-hour/time fare and per-minute overtime calculation are absent; there is no service-specific higher-of time/distance calculation. Final distance interpretation and partner settlement must remain gated by D01/D02. Generic per-minute pricing is not the specified rental calculation. | V2 p.5 | `functions/src/domain/pricing.ts:114`; `functions/src/commerce.ts:35`; `functions/src/adminBookings.ts:83` |
| G05 | Partial | **Local city drop product.** Add city-zone eligibility, a 20-KM customer and partner package, and separate extra-KM rates. The server currently classifies routes generically as Local/Outstation/Airport, without this package or city-boundary workflow. Boundary details need D15. | V2 p.6 | `functions/src/domain/pricing.ts:69`; `functions/src/domain/pricing.ts:114` |
| G06 | Partial / policy-gated | **Add-on and state-charge rules.** Carrier/permit/waiting display fields exist. Missing are the CNG-Sedan carrier exemption, hills and pet declaration/acceptance, the state/seating/effective-date table, permit-coverage checks, and expense/partner allocation. Charge units and missing state rates must not be invented. | V2 pp.6-7; D05/D06 | `functions/src/domain/types.ts:69`; `functions/src/domain/fareBreakup.ts:84` |
| G07 | Policy-gated | **Same-day multi-city.** Add waypoints, full via-route quote, planned destination halt, Rs150/hour halt configuration, overnight rejection/requote and customer-approved itinerary amendments. Current booking paths price pickup/drop and distinguish only One Way/Round Trip. Base/partner rates and partial-hour policy remain D07. | V2 p.7 | `functions/src/commerce.ts:33`; `functions/src/adminBookings.ts:83`; `functions/src/bookingBuild.ts:67` |
| G08 | Partial | **Executable fixed-route pricing.** Admin has a FIXED_ROUTE fare-rule interface, but the inspected Functions pricing/creation paths do not read `fare_rules`. Add direction/place-zone/time matching, explicit inclusions, exemption from the normal floor and marketplace fulfilment with accepted payout. A settings page alone does not connect those fares to bookings. | V2 p.8 | `admin/src/pages/Pricing.tsx`; `functions/src/commerce.ts:46`; `functions/src/adminBookings.ts:108`; `functions/src/marketplace.ts:58` |
| G09 | Missing | **Hourly marketplace offer escalation.** Add 5% of the current offer per unaccepted hour, paise rounding, ceiling, duplicate-event protection, stop conditions and an Admin ceiling alert. Existing scheduler only handles unassigned-pickup alerts. | V2 p.9 | `functions/src/scheduler.ts:53`; `functions/src/marketplace.ts:58` |
| G10 | Partial / policy-gated | **Explicit posting modes and owner-driver bidding.** Accept-current and vendor bid/Admin-award paths exist, but there is no per-post mode enforcing one assignment mechanism. Bid creation is restricted to Vendors; independent drivers have an accept path rather than the documented marketplace bidding capability. Mode/release policy is D09. | V2 p.9 | `functions/src/marketplace.ts:28`; `firestore.rules:676`; `driver/app/src/services/driverService.ts:442` |
| G11 | Missing / policy-gated | **Staged duty release.** Add top-rated independent drivers at time zero, remaining eligible independents at 120 seconds and Vendors at 180 seconds. Current approval opens the marketplace and immediately notifies both groups. Rating threshold/review count/new-driver treatment require D11; whether marketplace posts share the delay remains open. | FRS p.5; V2 p.14 | `functions/src/bookingOps.ts:34`; `functions/src/bookingOps.ts:81`; `firestore.rules:456` |
| G12 | Partial | **Vehicle matrix and passenger-capacity enforcement.** Add all 35 compatibility cells, distinct Innova/Crysta families and required passenger seats excluding the driver. Current matching is category alias equality; dispatch rules validate approval/ownership/number but not the specified matrix or seat requirement. Registry category suggestions do not implement assignment matching. | ADD pp.1-3; V2 p.14 | `functions/src/domain/pricing.ts:63`; `firestore.rules:474`; `firestore.rules:484`; `functions/src/domain/vehicleRegistry.ts:159` |
| G13 | Missing | **Customer-approved alternative vehicle workflow.** Before using a different requirement, record original/revised category and capacity, customer agreement, reason, operator, time and agreed price; increment/check booking version and rerun eligibility. Ordinary driver reassignment records exist, but this requirement-amendment workflow was not found. | ADD p.2; V2 p.14 | `functions/src/bookingOps.ts:310`; `functions/src/commerce.ts:104`; `functions/src/adminBookings.ts:165` |

## B. Trip operation, privacy and account behaviour

| ID | Status | Required feature and current gap | Document | Code evidence |
|---|---|---|---|---|
| G14 | Partial | **Time-aware driver AND vehicle scheduling.** Calculate expected end + repositioning + configurable buffer, allow compatible future duties and reject conflicts for either resource at assignment/start. Admin checks driver conflicts using a fixed time window/current Ongoing status, while Vendor mobile rejects any other Assigned/Ongoing driver booking. DriverData treats the first Assigned trip as active and suppresses new offers. These are not the required interval calculation; no corresponding vehicle interval check was found. | FRS p.4; V2 p.15 | `functions/src/bookingOps.ts:360`; `vendor/app/src/services/vendorService.ts:296`; `driver/app/src/context/DriverData.tsx:119` |
| G15 | Partial / conflict | **Start for Pickup and en-route stage.** Add explicit start eligibility, pre-departure checks, evidence acceptance and navigation before Reached Pickup. Current server workflow is Not Started -> Reached Pickup -> Trip Started -> Trip Ended; photo submission is required for passenger Trip Started. The PDFs also require a fresh trip selfie; current trip capture intentionally has no selfie, matching an earlier user instruction. Resolve that conflict before changing it; onboarding already collects a selfie. | FRS pp.6-7; V2 p.11 | `functions/src/trips.ts:1`; `functions/src/vehicleVerification.ts:65`; `driver/app/src/screens/PreTripScreen.tsx:1` |
| G16 | Partial | **Total Trip KM -> final customer invoice.** Driver should enter total billable KM; server should derive extra KM from the locked quote, recalculate approved fare/tax and update collection balance. Current flow requires start/end odometer readings and End Trip stores the end reading/tolls without recalculating fare from final driven KM. Payment summaries exist, but cannot fix an invoice that was never repriced. | FRS pp.6,8-9; V2 pp.3,11-12 | `functions/src/trips.ts:122`; `driver/app/src/screens/TripScreen.tsx:135`; `functions/src/bookingPayments.ts:43` |
| G17 | Partial | **Strict pickup geofence with fresh location.** Current radius is 2 KM rather than the PDF's provisional 3 KM. More importantly, absence of a usable position/pickup coordinates sets `location_unavailable` and still accepts Reached Pickup. Add mandatory usable/fresh/accuracy-checked evidence and a separate audited exception. Final radius/tolerances require D11. | FRS p.7; V2 p.11 | `functions/src/trips.ts:23`; `functions/src/trips.ts:98` |
| G18 | Missing - high priority | **Customer phone privacy and reveal audit.** Vendors must always receive masked data; only the currently assigned driver may reveal from T-8 hours, with access checked again after schedule/assignment/status changes. Bookings currently contain raw phone data and assigned Vendors/drivers can read the whole document. Vendor mobile even offers Call Customer. No timed reveal endpoint or reveal/denial audit with viewer counts was found. This requires server/data changes, not merely removing an icon. | V2 p.16 | `firestore.rules:572`; `vendor/app/src/services/vendorService.ts:228`; `vendor/app/src/screens/TripsScreen.tsx:99`; `driver/app/src/services/driverService.ts:519` |
| G19 | Partial | **Restricted Vendor employee Driver experience.** Marketplace exclusion is present. However mobile Earnings/Wallet tabs and wallet/ledger subscriptions are mounted for all approved drivers; assigned trip records also expose financial fields. Rules allow any driver to read their own driver-wallet path. Add explicit employee trip/invoice-only UI and data permissions without Vendor entitlement/margin. This is not evidence that an employee can read the Vendor's wallet directly. | FRS pp.2,7; V2 pp.11,14 | `driver/app/src/navigation/MainNavigator.tsx:38`; `driver/app/src/context/DriverData.tsx:94`; `firestore.rules:721` |
| G20 | Partial | **Operational document expiry enforcement.** Onboarding validates dates and registry lookup reports expired documents. Missing are periodic driver/vehicle expiry processing, assignment validity through the future trip period, start/claim gates, separate expiry dashboards, mandatory T-20-day reminders and optional T-7/3/1 reminders. An approved record can age past expiry without a status change. | V2 p.17 | `functions/src/domain/vehicleRegistry.ts:263`; `functions/src/scheduler.ts`; `functions/src/trips.ts:40`; `firestore.rules:474` |
| G21 | Partial / policy-gated | **Accident holds and inactivity operations.** Generic vehicle Inactive/Maintenance states exist. Missing are an accident case/hold with affected-booking discovery, safe passenger handover, verification-based restoration, 30/90-day activity reporting and warning/grace/approved-leave handling before inactivity restrictions. Thresholds remain D12. | V2 pp.17-18 | `admin/src/pages/Vehicles.tsx`; `functions/src/scheduler.ts`; `functions/src/marketplace.ts:15` |
| G22 | Missing | **Admin emergency single-trip identity.** Add verified identity/vehicle evidence, exactly one booking, no marketplace/wallet-management privilege, completion/cancellation/expiry revocation, denial of later temporary access, retained records and traceable settlement. No dedicated creation, scoped authorisation or session-revocation path was found. | V2 p.13 | `functions/src/index.ts`; `functions/src/auth.ts`; `functions/src/trips.ts`; `firestore.rules:99` |
| G23 | Missing / policy-gated | **Four-hour payout lifecycle.** Add completed_at + 4-hour due time, Due/Processing/Paid/Failed/On Hold states, owner/deadline for holds, beneficiary review, transfer confirmation and due/overdue escalation. Existing partner-requested wallet payouts reserve funds and record requests, but no per-trip four-hour lifecycle/job exists. Under-Rs300 interaction remains D14. | V2 p.12 | `functions/src/ledger.ts:159`; `functions/src/domain/finance.ts` (`payoutLedgerStatus`); `functions/src/scheduler.ts:53` |
| G24 | Partial | **Staff action hierarchy and delegated suspensions.** General module permissions exist. Missing are distinct suspend versus higher-authority unblock permissions, scoped/expiring TL delegation, timed conduct cases and case/appeal-driven restoration. Driver and Vendor review paths use the same broad people permission for suspension and reinstatement. Vendor app/web can also toggle an employee's fleetStatus directly; reconcile that operational toggle with the document's staff-only suspend/unblock policy. | V2 pp.13,18; D12/D13 | `functions/src/permissions.ts:13`; `admin/src/pages/Drivers.tsx:257`; `admin/src/services/vendorReviewService.ts:21`; `vendor/app/src/services/vendorService.ts:462`; `firestore.rules:355` |
| G25 | Partial / policy-gated | **Event-based cancellation policy.** Manual penalties, cancellation and refund handling exist. Missing are policy/version-based actual-arrival compensation, accepted-duration and last-minute rules, no stacking, liability assignment, no-show evidence/grace and consistent refund/exception timers. The PDF records Rs300/Rs500/Rs1,000 proposals but explicitly leaves applicability and timing as release gates; do not switch these on as unconditional fees. | V2 p.19; D10 | `functions/src/penalties.ts:26`; `functions/src/bookingOps.ts`; `firestore.rules:438` |
| G26 | Missing | **Appeal/reversal after a deducted penalty.** Deducted and Paid penalties are terminal in the transition map. The implemented deduction writes a debit; no linked compensating-credit reversal for an upheld post-deduction dispute was found. Waiving a pending penalty does not satisfy refunding an existing deduction. Add idempotent reversal while retaining original debit and decision history. | FRS pp.11,13; V2 pp.10,19,22 | `functions/src/domain/bookingFlow.ts:258`; `functions/src/penalties.ts:125` |

## C. Admin, agreements and reporting

| ID | Status | Required feature and current gap | Document | Code evidence |
|---|---|---|---|---|
| G27 | Partial | **Direction/route/category seasonal pricing.** Global percentage adjustment with start/end dates exists. Add route direction, category/seating, pickup date/time window, margin floor, review, fixed-route precedence and non-stacking. The current global adjustment is selected from creation-time `now`, not a route-specific future pickup rule. | V2 p.21 | `functions/src/fareConfig.ts:16`; `functions/src/fareConfig.ts:46`; `functions/src/commerce.ts:75` |
| G28 | Partial | **Full booking agreement data.** Admin already supports map pins, contact details, optional email, advance and common pricing. Missing in the active creation contract are the documented passenger/required-seat fields, waypoints, return/end time, full product-specific agreement and explicit booking-linked quote/terms/inclusion versions and amendment consent. A global legal acceptance gate exists; that is not the complete booking agreement snapshot. | FRS p.12; V2 pp.2,20 | `functions/src/adminBookings.ts:76`; `functions/src/adminBookings.ts:165`; `functions/src/commerce.ts:104`; `functions/src/legal.ts` |
| G29 | Missing recommendation | **Human-readable annual booking sequence.** The recommended shared `NTT-2026-000001` public ID sequence is absent. Current creation uses a timestamp/request-ID suffix. Existing internal IDs should remain immutable; old bookings must not be renumbered when adding the recommended sequence. | V2 p.20 | `functions/src/commerce.ts:104`; `functions/src/adminBookings.ts` (`bookingCode`) |
| G30 | Partial / policy-gated | **Paise-level fare arithmetic and approved tax configuration.** Several fare, discount, GST and payout calculations round to whole rupees and use JS floating-point arithmetic; `GST_RATE` is hardcoded at 5%. Add a defined paise/decimal policy and a versioned, approved tax treatment instead of rounding fractional-money examples away. The actual tax policy remains D04; this report makes no legal determination. | FRS p.8; V2 pp.2,21,23 | `functions/src/domain/pricing.ts:3`; `functions/src/domain/pricing.ts:126`; `functions/src/domain/pricing.ts:158`; `functions/src/domain/finance.ts:84` |
| G31 | Partial | **Driver identity uniqueness and controlled membership changes.** OTP ties an account to its mobile and vehicle lookup checks duplicate registrations. No comparable transaction-backed unique driving-licence reservation, formal Vendor-transfer request/approval/effective-date history or explicit protection against promotion on unlinking was found. Current Owner/employee distinction is mostly inferred from vendorId. Retain settlement owner and historical identity through approved changes. | FRS p.4; V2 p.13 | `driver/app/src/services/driverService.ts:343`; `functions/src/domain/vehicleRegistry.ts`; `driver/app/src/context/DriverData.tsx:123`; `firestore.rules:335` |
| G32 | Partial | **Operational reporting and owned exception escalation.** Booking/revenue/Vendor/cancellation/GST reports and configurable unassigned warnings exist. Missing are search-to-quote-to-booking conversion, eligible supply/empty-return reports, acceptance-delay/ceiling events, driver expiry/activity and payout ageing, plus a dispatch issue's acknowledgement/owner/next escalation/resolution record. The proposed T-8/4/2/1-hour ladder is not implemented; timings need D11 approval. Notifications for absent expiry/ceiling/payout events are consequently incomplete. | V2 pp.15,17,20-21 | `admin/src/pages/ReportsAnalytics.tsx:74`; `functions/src/scheduler.ts:13`; `functions/src/domain/bookingFlow.ts:284` |

## D. Concrete implementation mismatch found during review

**B01 - Vendor mobile assignment payload does not satisfy the rules.**

- Active screen: `vendor/app/src/screens/TripsScreen.tsx:133` calls `dispatchDriver`.
- `vendor/app/src/services/vendorService.ts:281` builds an assignment with the vehicle registration number, but no `assignedVehicleId`.
- `firestore.rules:493` requires a non-empty `assignedVehicleId`, then validates the referenced vehicle.
- A newly accepted Vendor booking without a pre-existing vehicle ID therefore cannot satisfy that rule through this payload. This is a source-level mismatch; it was not reproduced on a device in this review.
- Vendor web already includes the vehicle ID (`vendor/web/src/services/vendorFirestoreService.ts:200`). Correct the mobile payload/selector and validate the same resource on the server rather than relaxing the rule.

## E. Existing implementations: do not list these as wholly missing

| Feature present in source | Evidence / limit |
|---|---|
| OTP authentication and account review states | Auth services and app entry gates exist. This does not establish that live domain/rules configuration is healthy. |
| Driver onboarding with licence/selfie and separate employee/owner vehicle step | Current uncommitted Driver registration/validation changes. Trip selfie remains a separate conflict. |
| Vendor request -> mobile-bound, expiring, single-use invitation -> onboarding | `functions/src/vendorOnboarding.ts:115`; Vendor app/web RegistrationGate. |
| Vehicle registration lookup adapter, cache/quota, duplicate checks, staff register comparison | `functions/src/vehicleLookup.ts`; `functions/src/domain/vehicleRegistry.ts`; `admin/src/components/VehicleRegisterCheck.tsx`. Live provider setup is not verified. |
| Admin manual booking map pin, optional email, validated WhatsApp and automatically calculated quote | `functions/src/adminBookings.ts:76`; `functions/src/bookingBuild.ts:67`. The tariff model still needs G01-G08. |
| Pending/Approved/Confirmed/Ongoing/Completed booking tabs | `functions/src/domain/bookingFlow.ts:20`. |
| Approval before offers; Vendor access across categories; employee marketplace exclusion | `functions/src/bookingOps.ts:64`; `firestore.rules:456`; `driver/app/src/services/driverService.ts:443`. Timing/matrix remain gaps. |
| Atomic claim writes and Admin bid award/reassignment history | Partner transactions, `functions/src/marketplace.ts:28`, `functions/src/bookingOps.ts:310`. These do not add scheduling/capacity checks automatically. |
| Server boarding OTP with attempt limits; ordered core trip transitions | `functions/src/trips.ts`. |
| Camera-only vehicle front/rear/interior capture, sessions and replay risk checks | `functions/src/vehicleVerification.ts`; native PreTripScreen. This does not prove detection of every photographed screen. |
| Payment transactions with amount/method/collector, advances, refunds/voids and derived balance | `functions/src/bookingPayments.ts`. |
| Partner-owned ledger/wallet with event IDs; Vendor settlement ownership | `functions/src/ledger.ts`; `functions/src/domain/finance.ts:153`. This does not complete all financial reversal paths. |
| Penalty notice, acknowledgement checkbox, pending dispute and deduction | `functions/src/penalties.ts`; post-deduction reversal remains G26. |
| Generic staff roles, legal document publication/acceptance, notifications and reviews | Existing `staff.ts`, `legal.ts`, `notify.ts` and review paths. Detailed V2 permissions/agreements/reporting remain partial. |

## F. Decisions the documents explicitly leave open

These are business configuration decisions, not proof of developer omission. Build the configurable structure, but do not silently choose contractual amounts, permissions or thresholds.

| V2 decision | Required clarification |
|---|---|
| D01 | Rental 50/70/80 wording: first-KM amount versus included KM. |
| D02 | Rental partner minimum/overtime/extra-KM rules and clock events. |
| D03 | Normal partner minimum/quoted-KM floor and the stated round-trip SUV/Crysta partner rate interpretation. |
| D04 | Tax rate/base/inclusion, invoice responsibility and tax allocation. |
| D05 | Add-on unit, partner share and waiting/reimbursement allocation. |
| D06 | Missing state/Crysta rates, permit validity and Puducherry seat applicability. |
| D07 | Multi-city base/partner rates and partial-hour halts. |
| D08 | Fixed-route map zones, inclusions and marketplace cut-off. |
| D09 | Per-post assignment mode and marketplace release timing. |
| D10 | Cancellation applicability, windows, no-show grace, refunds and exceptions. |
| D11 | Rating threshold/review count/unrated handling, final pickup radius, buffers and alert timings. |
| D12 | Inactivity/grace and emergency delegation limits. |
| D13 | One calendar month versus 30 days, and conduct appeal process. |
| D14 | Under-Rs300 wallet routing versus four-hour payout, negative-wallet and hold policy. |
| D15 | City boundaries, minute/KM rounding and override authority. |

Additional conversation conflict: earlier direct user instructions removed the trip selfie and required three vehicle images. The PDFs subsequently describe selfie + vehicle-front capture. Record an explicit resolution before replacing the present trip capture flow.

## G. Configuration and deployment: status not established by this source review

- A vehicle-provider adapter is present. Whether a licensed provider is configured and returns the expected real response is not established here.
- WhatsApp/SMS/email/push integrations exist in source. Credentials, sender/template approvals, device registration and actual delivery need a separate live check.
- Firebase rules/functions/index deployment, authorized domains, App Check and the exact installed APK version need live verification. The previously observed login failures are not resolved by this report.
- The local working tree contains substantial pre-existing edits. Findings apply to those files as inspected, not automatically to the current hosted build.

## H. Acceptance evidence to require when implementing

1. V2 p.22 examples for one-way/round-trip/local drop/rental time, with open partner floors/tax decisions supplied explicitly.
2. ADD V01-V10, including every compatibility cell, capacity, Vendor broad visibility, consent amendment and stale booking/vehicle rejection.
3. Dispatch boundary checks at 119/120/179/180 seconds and repeated timer delivery.
4. Assigned-driver contact access at T-8h; Vendor raw-phone denial across APIs/PDFs/exports; reassignment and changed pickup time.
5. Missing/stale GPS rejection; total Trip KM invoice calculation without a duplicate base charge.
6. Driver and vehicle interval conflicts, future bookings, expiring documents and affected-trip escalation.
7. Company advance plus partner collection, fully company-paid cases, four-hour payout holds and duplicate transfer events.
8. Approved post-deduction penalty reversal delivered twice: exactly one linked credit.
9. Temporary identity expiry/session revocation while preserving trip and unsettled money records.

These are required future verification cases, not tests reported as executed in this audit.
