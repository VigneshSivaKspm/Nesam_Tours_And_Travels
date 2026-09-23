# Cloud Functions — Phase 1 (Security & Identity Foundation)

This is the first Cloud Functions codebase for the platform. It exists to move
security-critical logic (role assignment, boarding OTP verification, payment
order/signature verification, commission + wallet math) off the client, where
none of it can be trusted, and onto a server that Firestore rules can defer to.

## Functions in this codebase

- **`registerUser`** — callable. Called once by a client right after a brand-new
  Firebase Auth user completes phone verification (or, for admin-created
  accounts, right after admin creates them). Writes the initial Firestore
  profile doc (`customers/{uid}`, `vendors/{uid}`, or `drivers/{uid}`) and sets
  initial custom claims (`role`, `status`). Customers are auto-`Approved`;
  vendors/drivers start `Pending` until an admin approves them.
- **`setUserRole`** — callable, admin-only. Lets an admin directly assign/change
  a user's role and claims (used for provisioning admin accounts and manual
  overrides).
- **`onVendorApproved` / `onDriverApproved`** — Firestore triggers on
  `vendors/{uid}` / `drivers/{uid}`. When an admin flips `status` to
  `Approved`, upgrades that user's custom claims to match.
- **`generateBoardingOtp`** — callable. The *customer* calls this from their own
  app right before boarding; it generates a 4-digit code, stores only its hash
  on the booking doc, and returns the plaintext code to the customer's own
  screen (the same pattern Uber/Ola use — the rider reads the code aloud, the
  driver types it in). No SMS dispatch yet — that's wired up in the
  Notifications phase.
- **`verifyBoardingOtp`** — callable. The *driver* calls this with what the
  customer told them; verified server-side against the stored hash, never a
  client-side string compare.
- **`createRazorpayOrder` / `verifyRazorpayPayment`** — callable, gated on the
  `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` secrets. Until real keys are
  configured, both throw a `failed-precondition` error with message
  `PAYMENT_NOT_CONFIGURED` — they never fabricate a fake order or mark a
  booking "Paid" without a verified signature.
- **`onTripCompleted`** — Firestore trigger on `bookings/{id}`. When a booking's
  `status` transitions to `Completed`, looks up the assigned vendor's actual
  `commissionRate` field (falls back to 15% if unset), writes an audit entry to
  `wallet_ledger`, and atomically credits the vendor's and/or driver's
  `walletBalance` via `FieldValue.increment` — replacing the old client-only
  "local state" wallet math.

## Important: refreshing custom claims client-side

Custom claims only take effect on a user's **next** ID token. After calling
`registerUser`, `setUserRole`, or after an admin approves a vendor/driver, the
affected client must call:

```ts
await auth.currentUser?.getIdToken(true); // force refresh
```

before it will see the new `role`/`status`/`vendorId`/`driverId` in
`request.auth.token` on subsequent calls, and before Firestore rules that key
off those claims will behave as expected for that session.

## Local development

```bash
cd functions
npm install
npm run build
firebase emulators:start --only functions,firestore,auth,storage
```

Point each web app's Firebase SDK at the emulators during local testing
(`connectAuthEmulator`, `connectFirestoreEmulator`, `connectFunctionsEmulator`,
`connectStorageEmulator`) rather than the live project.

## Deploying (manual step — requires your Firebase CLI login)

```bash
firebase deploy --only firestore:rules,storage:rules,functions
```

If you haven't set the Razorpay secrets yet, deployment still succeeds —
payments simply stay in the "not configured" state until you run
`firebase functions:secrets:set RAZORPAY_KEY_ID` and
`firebase functions:secrets:set RAZORPAY_KEY_SECRET`.
