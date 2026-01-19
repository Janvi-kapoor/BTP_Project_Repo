namespace logichain.db;

using { managed, cuid } from '@sap/cds/common';

// 1. Corporate Customers & Admin (Extending standard managed for CreatedAt/By)
entity Users : managed {
    key ID          : UUID;
    companyName     : String(100);
    email           : String(100);
    role            : String(20) enum { Customer = 'CUSTOMER'; Admin = 'ADMIN'; };
    creditLine      : Decimal(15, 2);
    shipments       : Composition of many Shipments on shipments.customer = $self;
}

// 2. Fleet: Trucks
entity Trucks : managed {
    key ID              : UUID;
    truckNo             : String(20);
    maxCapacityTons     : Decimal(5, 2);
    vehicleType         : String(30) enum { OpenBed = 'Open Bed'; Container = 'Container'; Refrigerated = 'Refrigerated'; };
    status              : String(20) enum { Available = 'AVAILABLE'; OnTrip = 'ON_TRIP'; Maintenance = 'MAINTENANCE'; } default 'AVAILABLE';
    odometerKM          : Decimal(10, 2);
}

// 3. Fleet: Drivers
entity Drivers : managed {
    key ID              : UUID;
    name                : String(100);
    licenseNo           : String(50);
    phone               : String(15);
    status              : String(20) enum { Available = 'AVAILABLE'; Busy = 'BUSY'; OffDuty = 'OFF_DUTY'; } default 'AVAILABLE';
    currentLat          : Decimal(9, 6);
    currentLong         : Decimal(9, 6);
    rating              : Decimal(2, 1);
}

// 4. Shipments (The Core Business Object)
entity Shipments : managed {
    key ID              : String(20); // e.g., LOG-2026-001
    customer            : Association to Users;
    materialCategory    : String(50);
    loadWeightTons      : Decimal(5, 2);
    pickupLocation      : String(255);
    dropLocation        : String(255);
    priority            : String(20) enum { Standard = 'Standard'; Express = 'Express'; Urgent = 'Urgent'; };
    manifestURL         : String(255);
    status              : String(20) enum { 
                            Pending = 'Pending'; 
                            Assigned = 'Assigned'; 
                            InTransit = 'In-Transit'; 
                            Delivered = 'Delivered'; 
                            Cancelled = 'Cancelled'; 
                          } default 'Pending';
    totalFare           : Decimal(15, 2);
    
    // Links to Assignment
    assignment          : Composition of one TripAssignments on assignment.shipment = $self;
}

// 5. Trip Assignments (Linking Order + Truck + Driver)
entity TripAssignments : cuid, managed {
    shipment            : Association to Shipments;
    driver              : Association to Drivers;
    truck               : Association to Trucks;
    otpCode             : Integer;
    startTime           : DateTime;
    actualDeliveryTime  : DateTime;
    specialInstructions : String(500);
}

// 6. Tracking Logs (For GeoMap History)
entity TrackingLogs : cuid {
    trip                : Association to TripAssignments;
    lat                 : Decimal(9, 6);
    long                : Decimal(9, 6);
    timestamp           : DateTime @cds.on.insert: $now;
}