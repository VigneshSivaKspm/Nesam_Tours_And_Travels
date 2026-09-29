# Code corrections — 29 September 2026

Scope: complete the outstanding code corrections from the mobile audit, including the shared admin/backend paths. The owner explicitly deferred Android signing. Previous local changes and existing release artifacts were preserved.

## Corrections implemented

1. Admin Marketplace now uses the actual booking document ID, `Pending Review` bid status and `vendorCounterRate`. Awarding a bid atomically confirms the booking, assigns the marketplace offer and resolves competing bids. Concurrent awards produce one winner; rejecting a bid leaves the offer available. Manual posting validates the reviewed fare and payout.
2. The functions entry point now exports only the compatible booking, payout and completion handlers. The incompatible legacy role, payment and OTP callables are not exported. Completion produces an idempotent audit entry, without double crediting vendor and fleet driver.
3. Booking fares are server-calculated from a server-fetched road route, category pricing and validated coupons. Direct client booking creation is denied. Mobile and web clients call the backend, show changed quotes for review and retain request IDs for retries. Unsupported card/wallet checkout is disabled.
4. Partner payouts are server-authorized against verified, completed, paid non-cash bookings and outstanding reservations. Fleet revenue belongs to its vendor. Concurrent requests cannot spend the same balance twice. Saved private payout destinations are validated; tolls require approval. Admin payment reconciliation records actual received UPI money once and rejects incorrect totals. It does not initiate payments or transfers.
5. Driver bank and identity writes now use `driver_private`; owner/admin clients read the private document. Public driver profiles reject these fields. A dry-run-first migration script is provided for existing records. Existing production records remain unchanged until that migration runs.
6. Firestore/Storage rules enforce active admins, approved partners, bounded claims and tolls, private KYC access and server-only payout creation. Customer cancellation includes the quoted cancellation fee. Existing SOS and customer-photo rule corrections are retained.

Related fixes: web profile null handling, active coupon filtering, booking-based live driver location, support telephone placeholders, vendor acceptance and payout error handling, settled wallet displays, and removal of mock fallbacks/seeding buttons from selected admin finance/staff pages. Idle nearby-driver broadcasting and full granular admin RBAC are not implemented by this patch.

## Verification

- Customer mobile: strict TypeScript and lint pass; 37 unit tests pass.
- Driver mobile: strict TypeScript and lint pass; 21 unit tests pass.
- Vendor mobile: strict TypeScript and lint pass; 18 unit tests pass.
- Admin and all three web clients: TypeScript and production builds pass. Large-bundle advisory warnings remain.
- All three mobile Android Metro/Hermes exports pass.
- Functions TypeScript build passes.
- Firestore rules, backend handler and admin transaction regression: 39/39 pass. Results: see `tests/firestore-rules/latest-results.log` (local ignored log). Tests cover pricing tampering, double claims/payouts, private data, disabled roles, and duplicate payment/ledger events.

The backend tests use a local emulator and mocked route HTTP responses. They do not establish deployed callable connectivity, real routing availability, Storage emulator behavior or on-device Firebase login/camera/GPS/PDF behavior.

## Rollout still required

Follow `functions/DEPLOYMENT.md` for coordinated functions/rules/client deployment, backup and private-data migration. No live Firebase deployment or production migration was performed. Old deployed callables, if any, must be inventoried and retired. Old mobile clients and APKs cannot be assumed compatible with the new rules.

No phone is connected. No on-device testing was possible. Android upload signing was deliberately deferred. Existing `release-output` APK/AAB files were not rebuilt and do not contain these corrections; only updated source and Android bundles were verified in this pass.

Firebase SHA registration follows the eventual release key. Google Maps credentials and push/FCM sending infrastructure remain optional integrations. Production rollout must verify routing availability and payment reconciliation operations. This report records code and local checks, not Play Store readiness.

