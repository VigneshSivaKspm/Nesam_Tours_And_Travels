# Mobile sync notes (web-first phase)

The web apps are the reference implementation for this phase. The React
Native apps (`user/app`, `driver/app`, `vendor/app`) have **not** been changed.
This file lists every backend, rules and data-contract change that the mobile
apps must adopt before they are released against the new backend. It is
updated at the end of each phase.

Nothing here is deployed yet. Functions, `firestore.rules` and `storage.rules`
must be deployed together with the web apps.

---

## Pricing & booking (Stage 13)

| Change | Mobile impact | Action for mobile |
|---|---|---|
| Server no longer prices rides from built-in `DEFAULT_RIDE_CATEGORIES`; `createBooking` fails with "no active vehicle category has fares configured" when none is priceable | `user/app` still shows its own default categories when the collection is empty/unreadable | Remove the fallback list; show a "not available" state (see `user/web/src/services/pricingService.ts` `subscribeToRideCategories` status) |
| Night charge uses India time (Asia/Kolkata) on the server | `user/app` uses the phone clock (`getHours`) | Use the same Intl-based check as `user/web` `isNightTime` |
| Category/coupon numbers are read strictly (a value stored as text is treated as missing) | `user/app` may parse text values | Mirror `user/web` pricingService `num`/`str` |
| Coupon validity dates use India calendar dates | `user/app` uses local date | Mirror `user/web` `todayIso` |
| Bookings: `allow create: if false` for every client; fare fields (`fare`, `fareBreakdown`, `fareOverride`) cannot be written by any client | Only affects apps that wrote bookings directly (none should now) | Book only through `createBooking` |
| `fareBreakdown.adminAdjustment` may be present (admin-authorised fare) | Receipts that list components will not add up without it | Show an "Agreed fare adjustment" line when non-zero |

## Phase A — security foundation

| Change | Mobile impact | Action for mobile |
|---|---|---|
| **Marketplace reads are scoped**: vendors read trips with status `Open`/`Bidding` or assigned to themselves; independent drivers read `Open` trips or their own; **fleet drivers cannot read the marketplace** | Unfiltered marketplace queries are refused. A vendor whose accept transaction loses the race now gets `permission-denied` (it can no longer read the other vendor's trip) instead of its own "taken" guard | Always query with `where('status','in',['Open','Bidding'])` (vendor) / `where('status','==','Open')` (driver). Treat `permission-denied` on accept as "this trip is no longer available". Hide the marketplace for fleet drivers |
| **Fleet drivers cannot claim marketplace trips** (`driverClaimOk` requires an independent driver) | `driver/app` fleet drivers currently see and may try to accept trips | Only independent drivers (no `vendorId`) see and accept offers |
| **Vehicles are readable only by staff, the owning vendor and the paired driver** | Any query not scoped to `vendorId == uid` (vendor) or `assignedDriverId == uid` (driver) is refused | Scope every vehicle query |
| **Vehicle re-review**: a vendor may change only `status`, `assignedDriverId`, `assignedDriverName`, `updatedAt` on its own vehicle without review; any other change must set `docStatus: 'Pending'`. Vendors can never set `reviewedAt`/`reviewedBy`/`approvedAt` | `vendor/app` already sets `docStatus: 'Pending'` on edits | Keep doing so |
| **Vehicle delete guard**: vendors may delete only their own vehicles that are not `Approved` and not paired with a driver | `vendor/app` offers delete on any vehicle | Offer "deactivate" (status `Inactive`) for approved/paired vehicles; delete only pending/rejected unpaired ones |
| **Write-once trip evidence (Firestore)**: `preTrip` and `startOdometer` on a booking can be written once by the driver | `driver/app` must not rewrite the pre-trip record | Submit pre-trip once; show it read-only afterwards |
| **Write-once evidence (Storage)**: drivers may only *create new objects* under `drivers/{uid}/kyc/**`, `drivers/{uid}/vehicle/**` and `drivers/{uid}/trips/{bookingId}/**`; no overwrite or delete. Trip uploads are accepted only while the booking is assigned to that driver and `Assigned`/`Ongoing`. Other folders under `drivers/{uid}/` are not writable | `driver/app` already uploads to timestamped names in `kyc`, `vehicle` and `trips/{id}` | Keep unique names; never re-upload to an existing path; upload trip photos before completing the trip |
| Vendors can now read their fleet drivers' documents (`drivers/{driverId}/…` when `drivers/{driverId}.vendorId == vendor`) and the trip evidence of trips they hold | New capability | Optional: show fleet driver documents in `vendor/app` |
| **Customer status vocabulary**: active = `Approved` (legacy `Active` still accepted); anything else (e.g. `Blocked`) is blocked. A customer with no status is blocked | `user/app` may treat unknown/missing status as active | Treat only `Approved`/`Active` as active |
| Staff roles (`admins/{uid}.staffRole` + `permissions`, `staff_roles`, `admin_audit`) and the staff callables (`approveAdminRequest`, `rejectAdminRequest`, `updateAdminAccess`, `saveStaffRole`, `deleteStaffRole`) | Admin-only; no mobile app is affected | None |
| `booking_secrets` are never written by clients; only staff with operations permission (and the booking's customer) can read them | Customer OTP reads unchanged | None |

## Phase B — one source of truth for partner money

The server now owns every partner-money number. Reference implementations:
`vendor/web/src/services/vendorMappers.ts` + `vendorFirestoreService.ts`,
`driver/web/src/services/driverEarnings.ts` + `driverFirestoreService.ts`.

| Change | Mobile impact | Action for mobile |
|---|---|---|
| **Commission policy** `business_config/commission` (finance-managed, versioned, audited). `createBooking` / `createAdminBooking` refuse to book when no rule applies ("the platform commission policy is not configured"). Bookings store `commission {rate, base, source, policyVersion}`; the marketplace offer is computed from it | `user/app` `rideService` still computes `offeredPayout = fare × PARTNER_PAYOUT_SHARE (0.85)` in a legacy client path (`user/app/src/config/constants.ts`) | Remove `PARTNER_PAYOUT_SHARE` and any client-computed offer; book only through `createBooking`; show the server's "not configured" message |
| **Finance snapshot** `bookings/{id}.finance` (schema 1) is written once by the server when a completed trip's fare is verified; it fixes partner, agreed payout, commission and platform revenue | Read-only for apps | Show payouts from `finance.partnerPayout` (or the agreed `driverPayout` / `vendorPayout` before finalization); never recompute |
| **Ledger + wallets**: `wallet_ledger` (schema 2, ids `trip_`/`toll_`/`cash_`/`payout_{id}`) and `wallets/{driver|vendor}_{uid}` are written only by the server. Wallet fields: `available` (can be **negative** when cash collected exceeds earnings), `pending`, `reserved`, `paidOut`, `cashCollected`, `tripEarnings`, `tollReimbursements`. Partners read their own ledger with `where('driverId'|'vendorId','==',uid)` and their wallet by id (a missing wallet doc = empty wallet, not an error) | `driver/app` computes the withdrawable balance from bookings (`withdrawableAmount`) and payouts; `vendor/app` `utils/wallet.ts` computes it from `vendorPayout`s | Replace both with a listener on `wallets/{role}_{uid}` and the ledger query; delete the client balance maths |
| **Cash trips debit the partner**: a paid cash trip adds a `cash_collected` debit of the full fare; toll reimbursements are credited only for **non-cash** trips with `tollsApproved` | Balances shown by the apps today overstate cash-heavy partners | Show the server wallet only; explain a negative balance |
| **No payout fallback**: a trip without a recorded `driverPayout`/`vendorPayout` has no earning (flagged for finance). Fleet trips pay the **vendor**; the fleet driver has no NESAM wallet | `driver/app` shows `fare × DEFAULT_DRIVER_SHARE (0.85)` when `driverPayout` is missing (`driverService.ts` line ~480) and credits fleet drivers | Show "Not recorded" when missing; for fleet drivers show "Paid by your fleet" |
| **Payout requests** (`requestPartnerPayout`, now in `functions/src/ledger.ts`) reserve the amount in the ledger in the same transaction; the destination comes from `driver_private.bank` / `vendor_kyc.payout`; client-sent account text is ignored. Rejecting releases the reservation; marking Paid completes it | Unchanged call signature | Stop sending/typing destination details; show the saved account; show `utr` / `adminNote` |
| **Vendor dispatch by vehicle id** (`vendorDispatchOk`): the booking update must include `assignedVehicleId` of a vehicle the vendor owns, `docStatus: 'Approved'`, not `Inactive`/`Maintenance`, and `assignedVehicleNumber` equal to that vehicle's `vehicleNumber` | **Breaking**: `vendor/app` dispatch (`vendorService.ts` ~line 268) sends only `assignedVehicleNumber` → `permission-denied` | Send `assignedVehicleId` + the vehicle's exact `vehicleNumber`; list only approved, in-service vehicles and approved, non-suspended drivers; use the driver doc's `phone` for `driverPhone` |
| **Independent driver claim** (`driverClaimOk`): `assignedVehicleId` must equal `drivers/{uid}.assignedVehicleId`; when set, the vehicle must be approved, paired with the driver (`assignedDriverId == uid`) and the number must match. Drivers without a paired vehicle record send no `assignedVehicleId` | **Breaking for paired drivers**: `driver/app` claim (`driverService.ts` ~line 416) sends no `assignedVehicleId` | Read the paired vehicle doc and send its id and exact number |
| **Server-only booking money fields** for every client and staff role: `fare`, `fareBreakdown`, `fareOverride`, `fareVerified`, `commission`, `finance`, `vendorPayout`, `driverPayout`, `payoutSource` (partners set their payout only inside their own claim, equal to the offer). Staff can no longer write partner assignment (`assigned*`, `driver`, `driverPhone`) directly — admins use `assignIndependentDriver` / `awardMarketplaceBid` | None of the apps should write these after claiming | Remove any such writes |
| **Admin marketplace actions are callables**: `awardMarketplaceBid`, `postBookingToMarketplace`, `assignIndependentDriver`; client creation of `marketplace_trips` is refused and staff cannot change `offeredPayout` | Admin-only | None |
| **Driver rating**: a stored `rating` is shown only when backed by `ratingCount > 0`; web signup no longer writes the placeholder `rating: 5, totalTrips: 0` (the rules still accept those values from older app versions) | `driver/app` signup writes `rating: 5, totalTrips: 0` (`driverService.ts` ~line 318) and shows it as a real rating | Stop writing them; show "No ratings yet" until ratings exist |
| **Wallet read rule keyed on document id** (`wallets/{type}_{uid}`) | None | None |
