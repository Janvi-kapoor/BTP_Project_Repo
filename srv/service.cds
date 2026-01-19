using { logichain.db as db } from '../db/schema';

service LogiChainService {

    // --- Admin Operations ---
    // Hum ise redirection target bana rahe hain taaki associations yahan point karein
    @odata.draft.enabled
    @cds.redirection.target
    entity AdminShipments as projection on db.Shipments;
    entity Users as projection on db.Users;
    entity Fleet_Trucks as projection on db.Trucks;
    entity Fleet_Drivers as projection on db.Drivers;
    
    // --- Smart Dispatch Logic ---
    function getAvailableTrucks(loadWeight: Decimal(5,2)) returns array of Fleet_Trucks;

    // --- Customer Portal ---
    // Isme hum sirf filter laga rahe hain, par ye redirection target nahi hoga
    entity CustomerShipments as projection on db.Shipments where customer.ID = $user;
    
    // --- Driver App ---
    // Ab ye 'shipment' association ke liye AdminShipments par redirect ho jayega
    entity ActiveTrips as projection on db.TripAssignments;
    
    @readonly
    entity TrackingHistory as projection on db.TrackingLogs;

    // Action to confirm delivery via OTP
    action confirmDelivery(tripID: UUID, enteredOTP: Integer) returns String;
}