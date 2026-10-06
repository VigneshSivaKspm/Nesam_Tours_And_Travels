// Profile onboarding uses the document-based rules contract. Bookings, money,
// trip stages, penalties, verification and legal acceptance are written only by
// these functions (see firestore.rules).
export { createBooking } from './commerce';
export { createAdminBooking, overrideBookingFare } from './adminBookings';
export { approveBooking, rejectBooking, cancelBooking, updateRefund, assignDriver, acknowledgeUnassignedAlert, migrateMarketplaceVisibility, onBookingCancelled } from './bookingOps';
export { recordPayment, voidPayment, onBookingMoneyChange } from './bookingPayments';
export { saveFareAdjustment } from './fareConfig';
export { issuePenalty, transitionPenalty, acknowledgePenalty, disputePenalty } from './penalties';
export { advanceTrip, verifyBoarding } from './trips';
export { createCaptureSession, getSlotChallenge, submitCapturePhoto, finalizeVehicleVerification } from './vehicleVerification';
export { reportSecurityEvent, getIntegrityNonce, verifyDeviceIntegrity } from './security';
export { sendVerificationCode, verifyCustomerCode, whatsappWebhook } from './customerVerification';
export { getLegalStatus, acceptLegalDocuments, publishLegalDocument, seedLegalDocuments } from './legal';
export { unassignedBookingAlerts } from './scheduler';
export { approveAdminRequest, rejectAdminRequest, updateAdminAccess, saveStaffRole, deleteStaffRole } from './staff';
export { saveCommissionPolicy } from './commission';
export { awardMarketplaceBid, postBookingToMarketplace, assignIndependentDriver } from './marketplace';
export { requestPartnerPayout, rebuildPartnerLedger, onBookingFinanceChange, onPayoutRequestWritten } from './ledger';
export { sendNotification } from './broadcast';
