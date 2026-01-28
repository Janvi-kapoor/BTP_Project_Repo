namespace logichain.db;

using {
    managed,
    cuid
} from '@sap/cds/common';

entity Users : managed {
    key ID          : UUID;
        companyName : String(100);
        email       : String(100);
        password    : String(128); 
        role        : String(20) enum {
            Customer = 'CUSTOMER';
            Admin = 'ADMIN';
        };
        creditLine  : Decimal(15, 2);
        shipments   : Composition of many Shipments on shipments.customer = $self;
}

// 2. Fleet: Trucks
entity Trucks : managed {
    key ID              : UUID;
        truckNo         : String(20);
        maxCapacityTons : Decimal(5, 2);
        vehicleType     : String(30) enum {
            OpenBed = 'Open Bed';
            Container = 'Container';
            Refrigerated = 'Refrigerated';
        };
        status          : String(20) enum {
            Available = 'AVAILABLE';
            OnTrip = 'ON_TRIP';
            Maintenance = 'MAINTENANCE';
        } default 'AVAILABLE';
        odometerKM      : Decimal(10, 2);
}

// 3. Fleet: Drivers
entity Drivers : managed {
    key ID           : UUID;
        name         : String(100);
        email        : String(100);
        password     : String(128);
        licenseNo    : String(50);
        phone        : String(15);
        totalEarning : Decimal(15, 2); // Added from Schema 1 (Decimal is better than String)
        status       : String(20) enum {
            Available = 'AVAILABLE';
            Busy = 'BUSY';
            OffDuty = 'OFF_DUTY';
        } default 'AVAILABLE';
        currentLat   : Decimal(9, 6);
        currentLong  : Decimal(9, 6);
        rating       : Decimal(2, 1);
}

// 4. Shipments (Merged with Receiver Details + Vehicle Requirements)
entity Shipments : managed {
    key ID                  : String(20); 
        customer            : Association to Users;
        materialCategory    : String(50);
        loadWeightTons      : Decimal(5, 2);
        pickupLocation      : String(255);
        dropLocation        : String(255);
        // From Schema 2
        receiverCompany     : String(255);
        receiverPhone       : String(15);
        receiverEmail       : String(100);
        // From Schema 1
        requiredVehicleType : String(30);
        totalDistance       : Decimal(10, 2); // Changed to Decimal for calculations
        priority            : String(20) enum {
            Standard = 'Standard';
            Express = 'Express';
            Urgent = 'Urgent';
        };
        manifestURL         : String(255);
        status              : String(20) enum {
            Pending = 'Pending';
            Assigned = 'Assigned';
            InTransit = 'In-Transit';
            Delivered = 'Delivered';
            Cancelled = 'Cancelled';
            ConfirmPickup='ConfirmPickup';
        } default 'Pending';
        totalFare           : Decimal(15, 2);
        assignment          : Composition of one TripAssignments on assignment.shipment = $self;
}

// 5. Trip Assignments
entity TripAssignments : cuid, managed {
    shipment            : Association to Shipments;
    driver              : Association to Drivers;
    truck               : Association to Trucks;
    otpCode             : Integer;
    startTime           : DateTime;
    actualDeliveryTime  : DateTime;
    eta                 : String(20); 
    specialInstructions : String(500);
}

// 6. Tracking Logs
entity TrackingLogs : cuid {
    trip      : Association to TripAssignments;
    lat       : Decimal(9, 6);
    long      : Decimal(9, 6);
    timestamp : DateTime @cds.on.insert: $now;
}
