using {logichain.db as db} from '../db/schema';

service LogiChainService {
    @odata.draft.enabled
    @cds.redirection.target
    entity AdminShipments    as projection on db.Shipments;
    entity Users             as projection on db.Users;
    entity Fleet_Trucks      as projection on db.Trucks;
    entity Fleet_Drivers     as projection on db.Drivers;
    
    action calculatePrice(
        weight: Decimal(5,2), 
        distance: Decimal(10,2), 
        truckType: String, 
        priority: String
    ) returns {
        baseFreight: Decimal(15,2);
        gst: Decimal(15,2);
        totalFare: Decimal(15,2);
    };
    
    entity CustomerShipments as projection on db.Shipments
                                where
                                    customer.ID = $user;

    entity ActiveTrips       as projection on db.TripAssignments;
    entity TrackingHistory   as projection on db.TrackingLogs;

    function getDashboardMetrics(userEmail: String) returns {
        activeShipments : Integer;
        pendingDispatch : Integer;
        monthlySpend    : Decimal(15,2);
    };
    @cds.redirection.target
    entity Trucks as projection on db.Trucks;
    
    @cds.redirection.target
    entity Drivers as projection on db.Drivers;
    @readonly
    entity UnassignedOrders as projection on db.Shipments where status = 'Pending';

    @readonly
    entity AvailableTrucks as projection on db.Trucks where status = 'AVAILABLE';
    
    @readonly
    entity AvailableDrivers as projection on db.Drivers where status = 'AVAILABLE';

    // Dispatch process (Handshake) ka main action
    //
    action assignOrder (
        orderID  : UUID,
        truckID  : UUID,
        driverID : UUID
    ) returns String;

    // --- Dashboard Summary ---
    //
    function getDashboardStats() returns {
        totalRevenue: Decimal(15,2);
        totalCommission: Decimal(15,2);
        activeDrivers: Integer;
    };

    @readonly
    // Additional helper functions
    function getAvailableTrucks(loadWeight: Decimal(5,2)) returns array of Trucks;
    action confirmDelivery(tripID: UUID, enteredOTP: Integer) returns String;
}
