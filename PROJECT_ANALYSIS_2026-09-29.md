# NESAM project analysis — 29 September 2026

The project has substantial implemented functionality, but the current workspace is not ready for an unrestricted production release. The strongest part is the mobile implementation and its existing automated checks. The largest risks are Firestore trust boundaries, web/mobile integration differences, misleading admin data, and the disconnected legacy Functions implementation.

This is an analysis, not a correction release. No application source, rules, dependencies, or deployment configuration were changed. Existing user changes were preserved. Web build outputs were regenerated locally. No production data was accessed or modified.

## Scope and architecture

| Area | Implementation and responsibilities |
|---|---|
| `admin/` | React 19, TypeScript, Vite 8, Tailwind; booking operations, partner approvals, fleet, marketplace, pricing, content, finance, staff, support |
| `user/web/` | React/Vite customer portal: phone authentication, booking, fares, offers, trip tracking/history, profile, support |
| `driver/web/` | React/Vite 6 driver portal: registration/KYC, marketplace, pre-trip checks, trip execution, earnings/payouts |
| `vendor/web/` | React/Vite 6 vendor portal: onboarding, fleet/drivers, bidding, dispatch, wallet |
| `user/app/`, `driver/app/`, `vendor/app/` | Expo 57 / React Native 0.86 Android applications with navigation, Firebase services, validation and unit tests |
| Firebase | Auth, Firestore and Storage; client applications directly write business documents subject to rules |
| `functions/` | Separate legacy callable functions and triggers for registration/claims, boarding OTP, Razorpay and settlement |
| `tests/firestore-rules/` | Local Firestore emulator integration tests |
| `scripts/`, `release-output/` | Operational/build scripts and previously generated Android artifacts |

The intended operational path is customer booking → marketplace claim or vendor bid → dispatch → driver pre-trip checks → boarding OTP → trip completion → earnings/payout review. Mobile services implement much of this path. Web and backend implementations do not consistently share the same schema and transitions.

## Fresh verification results

| Check run during this review | Result |
|---|---|
| Customer mobile `npm run validate -- --runInBand` | TypeScript + ESLint pass; 37/37 tests |
| Driver mobile same command | TypeScript + ESLint pass; 20/20 tests |
| Vendor mobile same command | TypeScript + ESLint pass; 17/17 tests |
| Existing Firestore emulator suite `npm test` | 22/22 pass |
| Admin web production build + separate `tsc --noEmit` | Pass |
| Customer web production build | Pass |
| Customer web separate `tsc --noEmit` | FAIL: `src/screens/ProfileScreen.tsx:134`, nullable email incompatible with profile update type |
| Driver/Vendor web ordinary build | Initial failure: sandbox directory access in esbuild config loader |
| Driver/Vendor `npm run build -- --configLoader runner` | Both pass; separate TypeScript checks also pass |
| Functions `npm run build` | Could not validate: local `tsc` unavailable; dependencies not installed in that package |

The config-loader workaround required no repository edits. Its initial failure is an environment limitation, not evidence of broken application source. A Vite build succeeding does not establish that TypeScript checks pass; the customer web result demonstrates this distinction.

Nine additional temporary emulator probes confirmed that the current rules accept: zero-fare bookings, arbitrary driver profile wallet/KYC changes, arbitrary driver claim payouts, dispatch to a pending fleet driver, marketplace reads by a pending driver, oversized payout requests, negative toll charges, privileged writes by an inactive admin, and new bookings by a suspended customer. These probes intentionally asserted acceptance to demonstrate security gaps; their passing results are NOT safety passes. Temporary probe files were removed after review.

## Findings, ordered by priority

### 1. High — booking and payout amounts are client-controlled

Evidence: `firestore.rules:312` (`validNewCustomerBooking`), `:341` (`vendorClaimOk`), `:370` (`driverClaimOk`), `:386` (`driverProgressOk`), `:530` (`payout_requests`).

Customers can create bookings with any nonnegative fare. A claimant can choose `driverPayout` or `vendorPayout` without equality to an authoritative quote. Drivers may set toll charges without numeric bounds. Payout requests only require a positive amount and the correct owner/status; they do not reserve or check an earned balance.

Emulator-confirmed examples: a zero-fare ride, a driver claim with payout 999999, a payout request of 999999999 and toll charges of -10000 were accepted. This does not prove money is automatically transferred: payout requests still require admin handling. It proves the records and displayed earnings cannot be trusted as a settlement authority.

Correction: calculate and lock fares/payouts on a trusted backend; validate toll evidence/amounts; atomically reserve balances; make settlement and payout requests idempotent.

### 2. High — driver profile updates lack a field allow-list

Evidence: `firestore.rules:252`. The owner update branch protects a handful of fields but permits all others. A driver can change `walletBalance`, license information and vehicle fields while keeping approval and document-review fields unchanged. An emulator probe confirmed this write succeeds.

Correction: explicit allowed profile fields, separate privileged financial fields, and a required return to document review for KYC changes. Storage policy should also prevent replacing approved evidence without review.

### 3. High — admin marketplace cannot complete real vendor counter-bids correctly

Evidence: `admin/src/pages/Marketplace.tsx:424`, `:431`, `:442`, `:469`, `:480`; bid create contract at `firestore.rules:515`.

Real bids use `Pending Review` and `vendorCounterRate`; admin action buttons expect `Pending`/`Counter` and display `bid.amount`. Award writes target `trip.bookingId` (the human-facing booking code) instead of the actual booking document ID. Marketplace and booking updates are separate, unawaited operations, with no atomic bid resolution.

Impact: valid vendor bids lack working award controls; partial/inconsistent award updates are possible even if button visibility alone is fixed.

Correction: one transaction using the real booking ID, canonical bid fields, current availability checks, winning payout, and resolution of competing bids.

### 4. High — vendor web instant acceptance shows success before a valid claim

Evidence: `vendor/web/src/App.tsx:355`; `vendor/web/src/services/vendorFirestoreService.ts:278`.

The handler creates a local trip with fallback customer/driver/vehicle details, removes the offer and changes tabs. It calls the dispatch operation directly, without first claiming the booking for the vendor. The dispatch rule requires an already-held booking. The service catches failure and returns false, which the caller ignores.

Impact: UI can show an accepted/assigned trip while the backend rejected it. Mobile `vendorService.ts` contains a separate transactional accept implementation and does not share this exact defect.

### 5. High — Functions implement a different contract from the active clients

Evidence: `functions/src/payments.ts`, `functions/src/otp.ts`, `functions/src/auth.ts`, `functions/src/trips.ts`, `firebase.json`.

Clients use `fare`, `payment`, `Ongoing`, document-based roles and vendor status `APPROVED`. Functions expect/write `totalFare`, `paymentStatus`, `Trip Started`, custom claims and `Approved`/`Pending` vendor states. Client service searches found no callable integration. Root Firebase configuration has no Functions deployment block.

The settlement trigger also allocates a fresh ledger ID on every invocation and increments balances without a processed-booking guard. Duplicate invocation can duplicate credits; vendorless trips are skipped. Registration spreads arbitrary `profile` fields into an Admin SDK write, allowing unvalidated privileged fields if the callable is made reachable.

These are deployment/integration hazards; this review did not establish that these functions are deployed. Do not treat their presence as proof of a working online-payment or settlement system. Choose one backend contract and reconcile/test it before activating this package.

### 6. High — admin finance screens substitute fictitious records for missing data

Evidence: `admin/src/pages/Payments.tsx:53`, `DriverEarnings.tsx:80`, `VendorFinance.tsx:63`, `Penalties.tsx:74`, `StaffRoles.tsx:38`.

Empty datasets fall back to mock payments, earnings, tax records, penalties and staff. The generic subscriber also converts listener failures to empty arrays (`adminFirestoreService.ts:80`), so an access/network error can lead to plausible fictitious financial data. Several screens can seed those fixtures into Firestore.

Correction: production empty/error states, explicit demo mode, and removal or isolation of sample-data seeding from real operations.

### 7. High — account status is not consistently enforced by rules

Evidence: `firestore.rules:40` and `:48`; `admin/src/App.tsx:323`.

The admin UI requires both role `admin` and status `active`, while the rules' admin helper checks only the role. Changing an admin's status alone does not revoke backend privileges. Likewise, `isCustomer()` checks document existence without approval/suspension status, and new-booking rules rely on it. Separate emulator probes confirmed an inactive admin can write settings and a suspended customer can create a booking.

Correction: define one status/role authorization model enforced in every relevant Firestore/Storage operation; test suspended and inactive users directly against rules rather than only through UI gates.

### 8. Medium — fleet dispatch and marketplace access omit approval checks

Evidence: `firestore.rules:357` and `:476`.

Vendor dispatch checks fleet ownership but not the chosen driver's approval, fleet suspension, vehicle approval, or competing assignments. Pending drivers can read marketplace data because read access uses `isDriver()` rather than `isApprovedDriver()`.

Both pending-driver dispatch and marketplace access were emulator-confirmed. The mobile UI has stricter selection checks, but a direct SDK request bypasses them. An unapproved dispatched driver then cannot progress the trip because progress rules require approval.

### 9. Medium — sensitive driver identity and bank data share the vendor-readable document

Evidence: `driver/app/src/services/driverService.ts:254`, especially `:268` and `:275`; `firestore.rules:250`.

Driver Aadhaar/PAN, bank account and other registration data are stored on `drivers/{uid}`. The owning vendor can read the whole document. Masking fields on a screen does not restrict that read access.

Correction: separate private identity/bank information into a restricted document, and retain only operational fields in the vendor-readable driver profile.

### 10. Medium — customer web live tracking uses an unsupported collection

Evidence: `user/web/src/services/rideService.ts:268` and `:281`; no `driver_presence` rule or writer found. Driver mobile writes `bookings/{id}.driverLocation` through `useTripLocationSharing.ts`.

Customer web tracking/nearby-driver subscriptions therefore do not consume the implemented mobile tracking source and encounter default-deny rules. Use one location contract across web/mobile. Mobile location updates are foreground-only; background trip tracking was not implemented in the inspected hook.

### 11. Medium — staff roles are records/UI state, not enforced RBAC

Evidence: `admin/src/pages/StaffRoles.tsx:82` and `:108`; `admin/src/App.tsx:323`; `firestore.rules:643`.

Adding a staff member writes a `STAFF-*` record; it does not provision an authenticated admin identity or enforce per-module permissions. New roles are local component state and disappear on reload. Rules give admin-role users broad access without consulting those staff permission lists.

### 12. Medium — customer web has a reproducible TypeScript failure

Evidence: `user/web/src/screens/ProfileScreen.tsx:134`.

The profile form passes `email: string | null` into an update API that expects `string | undefined`. Reconcile the form/model normalization. Add a separate typecheck to the web build/CI path so bundling success cannot hide type errors.

### 13. Medium — customer web offers query uses a different schema

Evidence: `user/web/src/screens/OffersScreen.tsx:11`; `admin/src/pages/Offers.tsx:383`.

Customer web queries `active == true`, while the admin master writes `status: 'Active'`. Offers created through that admin path can be missing in the customer offer screen.

### 14. Release gate — Android artifacts require signing and device verification

APK/AAB files exist under `release-output/`. `user/app/plugins/withReleaseSigning.js` and corresponding driver/vendor plugins intentionally fall back to a debug key when upload signing configuration is absent. The existing mobile audit explicitly identifies these artifacts as debug-signed QA builds.

This review did not rebuild Android or independently inspect artifact certificates. Treat those files as QA artifacts until signing is independently verified. Physical-device checks remain necessary for SMS/reCAPTCHA, camera, permissions, GPS, interrupted trips, PDF sharing and release startup.

### 15. Medium — performance and operational error handling need work

The admin collection subscriber loads whole collections without pagination. Its errors become empty data rather than a visible failure. Web page imports are eager and production entry JavaScript is large:

| Portal | Minified entry JS | Gzip |
|---|---:|---:|
| Admin | 1,843 kB | 480 kB |
| Customer | 1,145 kB | 341 kB |
| Driver | 1,471 kB | 387 kB |
| Vendor | 1,109 kB | 285 kB |

Introduce route-level lazy loading, paginated operational lists, bounded real-time listeners and explicit error states. These are measured bundle sizes and static query observations, not browser performance measurements.

### 16. Lower priority — duplicated contracts and inconsistent support details

Fare/status/auth/validation implementations are duplicated across seven frontends and the Functions package. Existing mismatches show the maintenance cost. Support contact values in customer web `SafetyCenterModal.tsx:81` and driver web `VerificationStatusScreen.tsx:5` differ from mobile configuration. Confirm the correct business contact and centralize it.

The repository has no root package script orchestrating all checks, and no CI workflow was found in the tracked/configuration file scan. Admin has both npm and pnpm lockfiles. Establish one reproducible install/check process and shared schema definitions, especially for money and status transitions.

## What is working well

- All three mobile packages independently pass TypeScript, lint and their existing unit suites.
- Existing emulator tests cover booking batches, OTP ownership, concurrent claims, cancellation, bid isolation, payouts' ownership/status, and unauthorized access.
- Vendor mobile claim operations use transactions and handle concurrent marketplace claims.
- Boarding secrets are separated from ordinary booking reads; assigned drivers cannot directly read those secret documents in existing tests.
- Mobile code includes defensive mapping, validation, upload limits, network handling and subscription cleanup.
- All four web portals can produce bundles in this environment, with the stated config-loader workaround.

## Recommended implementation order

1. Close money, identity, account-status and dispatch authorization gaps; add negative regression tests for each demonstrated bypass.
2. Reconcile backend/client schemas and define authoritative pricing, settlement, payout and payment ownership. Add idempotent server operations.
3. Repair admin bid awards and vendor web acceptance as complete atomic workflows.
4. Remove production mock fallbacks; implement meaningful staff access control and accurate financial state.
5. Fix customer web typecheck, tracking and offers; align shared contracts across clients.
6. Verify deployed rules/configuration, production signing and real-device end-to-end QA.
7. Add CI, pagination, code splitting and monitoring after correctness gates are satisfied.

## Limits of this review

This review examined repository architecture, critical frontend/service paths, rules, backend code, build configuration and existing audit claims, and ran the checks above. It is not a claim that every screen or requirement has been exercised. No browser visual/accessibility audit, live Firebase deployment audit, real payment transaction, SMS flow, physical-device session, dependency vulnerability database scan, or Android rebuild was performed. Requirement screenshots were not used for a full page-by-page specification comparison. Functions remain build-unverified because dependencies are absent. Previously documented deployment/signing claims were distinguished from fresh local verification.

Readiness: suitable for continued development and controlled QA; not yet approved by this analysis for production financial/dispatch operations.
