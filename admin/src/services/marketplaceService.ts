import { db } from './firebase';
import { createMarketplaceService } from './marketplaceOperations';
export const { resolveBookingId, awardBid, rejectBid, postBooking, assignIndependentDriver } = createMarketplaceService(db);
