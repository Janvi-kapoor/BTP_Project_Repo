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
        // --- Core Master Entities ---

    @cds.redirection.target
    entity TripAssignments as projection on db.TripAssignments;

    // Driver authentication and earnings
    action authenticateDriver(email: String, password: String) returns {
        success: Boolean;
        driverID: UUID;
        driverName: String;
        message: String;
    };
    
    action calculateDriverEarnings(driverID: UUID) returns {
        totalEarnings: Decimal(15,2);
        completedTrips: Integer;
    };

    // DRIVER PORTAL API
    @readonly
    entity ActiveMission as projection on db.Shipments {
        key ID,
        pickupLocation,
        dropLocation,
        materialCategory,
        loadWeightTons,
        totalDistance,
        totalFare,
        status,
        null as truckNo : String,
        null as truckType : String,
        null as driverName : String,
        null as driverID : UUID
    } where status = 'Assigned' or status = 'In-Transit';
    
    // Driver Performance Entity
    @readonly
    entity DriverPerformance as projection on db.Shipments {
        key ID,
        totalFare,
        status,
        createdAt,
        null as driverID : UUID
    } where status = 'Delivered';

    // Get driver-specific active missions
    action getDriverMissions(driverID: UUID) returns array of {
        ID: String;
        pickupLocation: String;
        dropLocation: String;
        materialCategory: String;
        loadWeightTons: Decimal(5,2);
        status: String;
        truckNo: String;
        driverName: String;
    };

    // --- Live Navigation APIs ---
    function getNavigationData(tripID: UUID) returns {
        distanceRemaining: String;
        estimatedArrival: String;
        currentStatus: String;
        checkpoints: array of {
            location: String;
            time: String;
            status: String;
            latitude: Decimal(9,6);
            longitude: Decimal(9,6);
        };
    };

    action updateLocation(tripID: UUID, latitude: Decimal(9,6), longitude: Decimal(9,6)) returns String;
    action startMission(shipmentID: String) returns String;

    action getDriverPerformance(driverID: UUID) returns {
        totalDistance: Integer;
        truckType: String;
        totalFare: Decimal(15,2);
    };

    // Driver Stats Function
    function getDriverStats(driverID: UUID) returns {
        totalEarnings: Decimal(15,2);
        completedTrips: Integer;
        safetyRating: Decimal(3,1);
    };

    action confirmPickup(shipmentID: String) returns String;
    action updateDriverLocation(driverID: UUID, latitude: Decimal(9,6), longitude: Decimal(9,6)) returns String;

    // --- Secure Delivery Actions ---
    action sendOTP(phoneNumber: String) returns { success: Boolean; otp: String; message: String; };
    action completeDelivery(shipmentId: String, otpVerified: Boolean) returns { success: Boolean; message: String; shipmentId: String; };

    // --- Delay Reporting System ---
    @cds.redirection.target
    entity DelayLogs as projection on db.DelayLogs;
    
    action reportDelay(shipmentID: String, driverID: UUID, delayReason: String) returns { success: Boolean; message: String; };
    
    @readonly
    entity ActiveDelays as projection on db.DelayLogs {
        key ID,
        shipment.ID as shipmentID,
        driver.name as driverName,
        delayReason,
        reportedAt,
        shipment.customer.ID as customerID
    } where status = 'Active';
    
    function getNotificationCount(userID: UUID, userRole: String) returns Integer;
}
