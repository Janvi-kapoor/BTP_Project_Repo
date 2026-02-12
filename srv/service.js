const cds = require("@sap/cds");
const EmailOTPService = require('./email-otp-service');
module.exports = cds.service.impl(async function () {
  const { Users, AdminShipments } = this.entities;

  this.on("READ", "Users", async (req, next) => {
    if (req.query.SELECT.where) {
      return next();
    }
    return next();
  });

  this.on("getDashboardMetrics", async (req) => {
    const userEmail = req.data.userEmail || req._.req.query.userEmail;
    console.log("Fetching metrics for:", userEmail);

    if (!userEmail) {
      return req.error(400, "User email is missing in the request");
    }
    
    const all = await SELECT.from(AdminShipments)
      .where`customer.email = ${userEmail}`;
    
    const active = all.filter((s) => s.status === "In-Transit"|| s.status === "ConfirmPickup").length;
    const pending = all.filter(
      (s) => s.status === "Pending" || s.status === "Assigned",
    ).length;
    
    const totalSpend = all.reduce(
      (sum, s) => sum + (Number(s.totalFare) || 0),
      0,
    );

    return {
      activeShipments: active,
      pendingDispatch: pending,
      monthlySpend: totalSpend,
    };
  });

  this.on("READ", "AdminShipments", async (req, next) => {
    if (req.query.SELECT.where) {
      console.log("Filtering shipments for customer...");
    }
    return next();
  });

  this.on("calculatePrice", async (req) => {
    const { weight, distance, truckType, priority } = req.data;
    
    console.log("=== CALCULATE PRICE DEBUG ===");
    console.log("Weight:", weight);
    console.log("Distance:", distance);
    console.log("TruckType:", truckType);
    console.log("Priority:", priority);

    let rate = 8.5;

    if (truckType === "truckReefer") rate *= 1.4;
    else if (truckType === "truckContainer") rate *= 1.1;

    if (priority === "exp") rate *= 1.2;
    else if (priority === "urg") rate *= 1.5;
    
    console.log("Final rate:", rate);

    const baseFreight = Math.round(weight * distance * rate);
    const gst = Math.round(baseFreight * 0.18);
    const total = baseFreight + gst;
    
    console.log("BaseFreight:", baseFreight, "GST:", gst, "Total:", total);

    return {
      baseFreight,
      gst,
      totalFare: total,
    };
  });

  this.before("CREATE", "AdminShipments", async (req) => {
    console.log("Saving shipment to database...");
  });

    //smart dispatcher ka code

    // Smart Dispatcher: Order Assign karne ka logic
    this.on('assignOrder', async (req) => {
        const { orderID, truckID, driverID } = req.data;
        const { Shipments, Trucks, Drivers, TripAssignments } = cds.entities('logichain.db');

        console.log(`===> Dispatching Order: ${orderID} with Truck: ${truckID} and Driver: ${driverID}`);

        try {
            // Transaction start: Taki agar ek bhi update fail ho, toh kuch bhi save na ho (Data Integrity)
            await cds.tx(async (tx) => {
                
                // 1. Shipment ka status 'Assigned' karo
                await tx.update(Shipments).set({ status: 'Assigned' }).where({ ID: orderID });

                // 2. Truck ka status 'ON_TRIP' karo
                await tx.update(Trucks).set({ status: 'ON_TRIP' }).where({ ID: truckID });

                // 3. Driver ka status 'BUSY' karo
                await tx.update(Drivers).set({ status: 'BUSY' }).where({ ID: driverID });

                // 4. Check if TripAssignment already exists (ETA wala record)
                const existingAssignment = await tx.run(
                    SELECT.one.from(TripAssignments).where({ shipment_ID: orderID })
                );

                if (existingAssignment) {
                    // Update existing record with truck and driver IDs
                    console.log(`Updating existing assignment for shipment: ${orderID}`);
                    await tx.update(TripAssignments).set({
                        truck_ID: truckID,
                        driver_ID: driverID,
                        status: 'Active'
                    }).where({ shipment_ID: orderID });
                } else {
                    // Create new TripAssignment entry
                    console.log(`Creating new assignment for shipment: ${orderID}`);
                    await tx.create(TripAssignments).entries({
                        shipment_ID: orderID,
                        truck_ID: truckID,
                        driver_ID: driverID,
                        status: 'Active'
                    });
                }
            });

            return "Order successfully dispatched and resource status updated!";

        } catch (error) {
            console.error("Dispatch Error:", error.message);
            return req.error(500, "Database update failed: " + error.message);
        }
    });
     const { Shipments, Drivers, Trucks, TripAssignments } = cds.entities('logichain.db');
    const emailService = new EmailOTPService();

    // 1. --- Dashboard Stats --- (Wahi purana logic)
    this.on('getDashboardStats', async (req) => {
        try {
            const revResult = await SELECT.one.from(Shipments).columns('sum(totalFare) as total').where({ status: 'Delivered' });
            const driversResult = await SELECT.from(Drivers).where({ status: 'AVAILABLE' });
            const totalRev = revResult && revResult.total ? Number(revResult.total) : 0;
            return {
                totalRevenue: totalRev,
                totalCommission: totalRev * 0.15,
                activeDrivers: driversResult ? driversResult.length : 0
            };
        } catch (error) {
            return req.error(500, "Stats failed: " + error.message);
        }
    });

    // 2. --- Smart Dispatcher: assignOrder --- (Updated to handle existing ETA records)
    this.on('assignOrder', async (req) => {
        const { orderID, truckID, driverID } = req.data;
        try {
            await cds.tx(async (tx) => {
                await tx.update(Shipments).set({ status: 'Assigned' }).where({ ID: orderID });
                await tx.update(Trucks).set({ status: 'ON_TRIP' }).where({ ID: truckID });
                await tx.update(Drivers).set({ status: 'BUSY' }).where({ ID: driverID });
                
                // Check if assignment already exists
                const existingAssignment = await tx.run(
                    SELECT.one.from(TripAssignments).where({ shipment_ID: orderID })
                );

                if (existingAssignment) {
                    // Update existing record
                    await tx.update(TripAssignments).set({
                        truck_ID: truckID,
                        driver_ID: driverID,
                        status: 'Active'
                    }).where({ shipment_ID: orderID });
                } else {
                    // Create new record
                    await tx.create(TripAssignments).entries({
                        shipment_ID: orderID, truck_ID: truckID, driver_ID: driverID, status: 'Active'
                    });
                }
            });
            return "Order successfully dispatched!";
        } catch (error) {
            return req.error(500, "Dispatch failed: " + error.message);
        }
    });


    // 5. --- Update Mission Status (Pickup Confirmation) ---
    this.on('updateMissionStatus', async (req) => {
        const { shipmentID, newStatus } = req.data;
        console.log(`===> Updating mission ${shipmentID} to status: ${newStatus}`);
        
        try {
            await UPDATE(Shipments).set({ status: newStatus }).where({ ID: shipmentID });
            return { success: true, message: `Status updated to ${newStatus}` };
        } catch (error) {
            console.error("Status Update Error:", error.message);
            return req.error(500, "Status update failed: " + error.message);
        }
    });

    // 6. --- Driver Authentication ---
    this.on('authenticateDriver', async (req) => {
        const { email, password } = req.data;
        try {
            const driver = await SELECT.one.from(Drivers).where({ email, password });
            if (driver) return { success: true, driverID: driver.ID, driverName: driver.name, message: "OK" };
            return { success: false, message: "Invalid credentials" };
        } catch (error) {
            return req.error(500, "Auth failed");
        }
    });
  this.on('READ', 'ActiveMission', async (req) => {
    try {
        let targetDriverID = null;

        // 1. Filter parsing (Driver ID nikalna)
        if (req.query.SELECT.where) {
            req.query.SELECT.where.forEach((item, index) => {
                if (item.ref && (item.ref[0] === 'driverID' || item.ref[0] === 'assignment_driver_ID')) {
                    if (req.query.SELECT.where[index + 2] && req.query.SELECT.where[index + 2].val) {
                        targetDriverID = req.query.SELECT.where[index + 2].val;
                    }
                }
            });
        }

        console.log('====> ActiveMission Query - Driver ID:', targetDriverID);
        if (!targetDriverID) return [];

        // 2. TripAssignments fetch karo
        const assignments = await SELECT.from(TripAssignments)
            .columns('shipment_ID', 'driver_ID', 'truck_ID') 
            .where({ driver_ID: targetDriverID });
        
        console.log('====> Assignments found:', assignments.length);
        const shipmentIDs = assignments.map(a => a.shipment_ID);
        if (shipmentIDs.length === 0) return [];

        // 3. First check all shipments regardless of status
        const allShipments = await SELECT.from(Shipments)
            .columns('ID', 'status')
            .where({ ID: { in: shipmentIDs } });
        console.log('====> All shipments with status:', allShipments);

        // 4. Shipments fetch karo with active status
        const activeMissions = await SELECT.from(Shipments)
            .columns('ID', 'pickupLocation', 'dropLocation', 'status', 'loadWeightTons', 'materialCategory', 'totalDistance', 'totalFare', 'receiverCompany')
            .where({
                ID: { in: shipmentIDs },
                status: { in: ['Assigned', 'In-Transit', 'ConfirmPickup'] }
            });
        
        console.log('====> Active missions found:', activeMissions.length);
        console.log('====> Mission data:', activeMissions);

        // 4. Complete Enrichment with all required data
        const result = await Promise.all(activeMissions.map(async (mission) => {
            const assignment = assignments.find(a => a.shipment_ID === mission.ID);
            
            // Truck details fetch karo
            const truck = await SELECT.one.from(Trucks)
                .columns('truckNo', 'vehicleType')
                .where({ ID: assignment.truck_ID });
            
            // Driver details fetch karo
            const driver = await SELECT.one.from(Drivers)
                .columns('name')
                .where({ ID: assignment.driver_ID });

            // Get TripAssignment for ETA
            const tripAssignment = await SELECT.one.from(TripAssignments)
                .columns('eta')
                .where({ shipment_ID: mission.ID });

            const enrichedMission = {
                ID: mission.ID,
                pickupLocation: mission.pickupLocation,
                dropLocation: mission.dropLocation,
                loadWeightTons: mission.loadWeightTons,
                materialCategory: mission.materialCategory,
                totalDistance: Math.round(mission.totalDistance || 0),
                totalFare: mission.totalFare,
                receiverCompany: mission.receiverCompany,
                truckNo: truck?.truckNo || 'N/A',
                truckType: truck?.vehicleType || 'N/A',
                driverName: driver?.name || 'N/A',
                status: mission.status,
                driverID: assignment.driver_ID,
                eta: tripAssignment?.eta || '2-3 hours'
            };
            
            console.log('====> Enriched mission:', enrichedMission);
            return enrichedMission;
        }));
        
        console.log('====> Final result:', result);
        return result;

    } catch (error) {
        console.error("ActiveMission Error:", error.message);
        return [];
    }
});

    // 8. --- Start Mission Action ---
    this.on('startMission', async (req) => {
        const { shipmentID } = req.data;
        try {
            await UPDATE(Shipments).set({ status: 'In-Transit' }).where({ ID: shipmentID });
            await UPDATE(TripAssignments).set({ startTime: new Date().toISOString() }).where({ shipment_ID: shipmentID });
            return `Mission ${shipmentID} started!`;
        } catch (error) {
            return req.error(500, "Start failed: " + error.message);
        }
    });

    // 9. --- Calculate Earnings ---
    this.on('calculateDriverEarnings', async (req) => {
        const { driverID } = req.data;
        try {
            const completedTrips = await SELECT.from(TripAssignments)
                .join(Shipments).on(TripAssignments.shipment_ID.eq(Shipments.ID))
                .where({ 'TripAssignments.driver_ID': driverID, 'Shipments.status': 'Delivered' })
                .columns('Shipments.totalFare');
            const total = completedTrips.reduce((sum, trip) => sum + (trip.totalFare || 0), 0);
            await UPDATE(Drivers).set({ totalEarning: total.toString() }).where({ ID: driverID });
            return { totalEarnings: total, completedTrips: completedTrips.length };
        } catch (error) {
            return req.error(500, "Earnings failed: " + error.message);
        }
    });

    // 10. --- Driver Stats Function ---
    this.on('getDriverStats', async (req) => {
        const { driverID } = req.data;
        console.log(`====> Getting stats for driver: ${driverID}`);
        
        try {
            // Debug: Check if driver exists
            const driver = await SELECT.one.from(Drivers).where({ ID: driverID });
            console.log('Driver found:', driver ? 'Yes' : 'No');
            
            // Get all trip assignments for this driver
            const allAssignments = await SELECT.from(TripAssignments)
                .columns('shipment_ID', 'driver_ID')
                .where({ driver_ID: driverID });
            console.log(`Total assignments for driver: ${allAssignments.length}`);
            
            if (allAssignments.length === 0) {
                console.log('No assignments found for this driver');
                return {
                    totalEarnings: 0,
                    completedTrips: 0,
                    safetyRating: driver?.rating || 4.8
                };
            }
            
            // Get shipment IDs
            const shipmentIDs = allAssignments.map(a => a.shipment_ID);
            console.log('Checking shipments:', shipmentIDs);
            
            // Get delivered shipments
            const deliveredShipments = await SELECT.from(Shipments)
                .columns('ID', 'totalFare', 'status')
                .where({
                    ID: { in: shipmentIDs },
                    status: 'Delivered'
                });
            
            console.log(`Delivered shipments found: ${deliveredShipments.length}`);
            console.log('Delivered shipments details:', deliveredShipments);

            const totalEarnings = deliveredShipments.reduce((sum, shipment) => {
                const fare = Number(shipment.totalFare) || 0;
                console.log(`Adding fare: ${fare} from shipment ${shipment.ID}`);
                return sum + fare;
            }, 0);

            console.log(`Final calculated earnings: ${totalEarnings}`);

            const result = {
                totalEarnings: totalEarnings,
                completedTrips: deliveredShipments.length,
                safetyRating: driver?.rating || 4.8
            };

            console.log('Final result being returned:', result);
            return result;

        } catch (error) {
            console.error("Driver Stats Error:", error.message);
            console.error("Stack trace:", error.stack);
            return {
                totalEarnings: 0,
                completedTrips: 0,
                safetyRating: 4.8
            };
        }
    });

    // service.js ke module.exports ke andar ye add karo
this.on('getDriverPerformance', async (req) => {
    const { driverID } = req.data;
    const { TripAssignments, Shipments, Trucks } = cds.entities('logichain.db');

    try {
        console.log("Backend: Fetching performance for driver:", driverID);

        // 1. Latest assignment uthao
        const assignment = await SELECT.one.from(TripAssignments)
            .where({ driver_ID: driverID });

        if (!assignment) {
            console.log("Backend: No assignment found for this driver.");
            return { totalDistance: 0, truckType: "N/A" };
        }

        // 2. Shipment se distance (String "980 KM" se number nikalo)
        const shipment = await SELECT.one.from(Shipments)
            .columns('totalDistance', 'totalFare')
            .where({ ID: assignment.shipment_ID });

        // 3. Truck se type nikalo
        const truck = await SELECT.one.from(Trucks)
            .columns('vehicleType')
            .where({ ID: assignment.truck_ID });

        // Parse distance properly - extract decimal number from string like "800.00 KM"
        let finalDistance = 0;
        if (shipment?.totalDistance) {
            const distanceStr = String(shipment.totalDistance);
            const match = distanceStr.match(/([0-9]+\.?[0-9]*)/); // Extract decimal number
            finalDistance = match ? parseFloat(match[1]) : 0;
        }

        console.log("Backend: Sending data:", { totalDistance: finalDistance, truckType: truck?.vehicleType });

        return {
            totalDistance: Math.round(finalDistance),
            truckType: truck?.vehicleType || "Standard",
            totalFare: shipment?.totalFare || 0
        };
    } catch (error) {
        console.error("Backend Action Error:", error.message);
        return req.error(400, "Query Failed: " + error.message);
    }
});

// Store pickup OTPs temporarily
const pickupOTPs = new Map();

// Send Pickup OTP (matches sendOTP pattern)
this.on('sendPickupOTP', async (req) => {
    const { shipmentID } = req.data;
    console.log(`====> Sending pickup OTP for shipment: ${shipmentID}`);
   
    try {
        const shipment = await SELECT.one.from(Shipments)
            .columns('ID', 'customer_ID', 'status')
            .where({ ID: shipmentID });
       
        if (!shipment) {
            return { success: false, message: "Shipment not found" };
        }
        
        if (shipment.status !== 'In-Transit') {
            return { success: false, message: "Pickup OTP only available for In-Transit shipments" };
        }
        
        // Get customer email (company email)
        const customer = await SELECT.one.from(Users)
            .columns('email', 'companyName')
            .where({ ID: shipment.customer_ID });
       
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        
        // Store OTP
        pickupOTPs.set(shipmentID, {
            otp: otp,
            timestamp: Date.now(),
            expiry: Date.now() + (10 * 60 * 1000)
        });
        
        if (!customer || !customer.email) {
            console.log(`\n📧 PICKUP OTP for shipment ${shipmentID}: ${otp}\n`);
            return {
                success: false,
                message: "Customer email not found. Please contact support."
            };
        }
        
        console.log(`\n📧 PICKUP OTP for ${customer.email}: ${otp}`);
        console.log(`📼 Company: ${customer.companyName}`);
        console.log(`📦 Shipment: ${shipmentID}\n`);
        
        try {
            const result = await emailService.sendPickupOTP(customer.email, otp, customer.companyName);
           
            if (result.success) {
                return {
                    success: true,
                    otp: otp,
                    message: `Pickup OTP sent to ${customer.email}`
                };
            }
        } catch (emailError) {
            console.error('Email service error:', emailError.message);
        }
        
        return {
            success: true,
            otp: otp,
            message: "Pickup OTP ready (check console)"
        };
       
    } catch (error) {
        console.error("Pickup OTP error:", error.message);
        return { success: false, message: "Failed to generate pickup OTP" };
    }
});

// Verify Pickup OTP
this.on('verifyPickupOTP', async (req) => {
    const { shipmentID, enteredOTP } = req.data;
    console.log(`====> Verifying pickup OTP for shipment: ${shipmentID}`);
    
    try {
        const storedData = pickupOTPs.get(shipmentID);
        
        if (!storedData) {
            return { success: false, message: "No OTP found. Please request OTP first." };
        }
        
        if (Date.now() > storedData.expiry) {
            pickupOTPs.delete(shipmentID);
            return { success: false, message: "OTP expired. Please request new OTP." };
        }
        
        if (storedData.otp !== enteredOTP) {
            return { success: false, message: "Invalid OTP. Please try again." };
        }
        
        // Update status to ConfirmPickup
        await UPDATE(Shipments).set({ status: 'ConfirmPickup' }).where({ ID: shipmentID });
        
        pickupOTPs.delete(shipmentID);
        
        console.log(`✅ Pickup confirmed for shipment: ${shipmentID}`);
        
        return {
            success: true,
            message: "Pickup confirmed successfully!"
        };
        
    } catch (error) {
        console.error("Pickup OTP verification error:", error.message);
        return { success: false, message: "Verification failed" };
    }
});

// Update Driver Location Action
this.on('updateDriverLocation', async (req) => {
    const { driverID, latitude, longitude } = req.data;
    console.log(`====> Updating location for driver ${driverID}: lat=${latitude}, lng=${longitude}`);
    
    try {
        // Fix Decimal(9,6) validation by ensuring proper formatting
        const lat = parseFloat(parseFloat(latitude).toFixed(6));
        const lng = parseFloat(parseFloat(longitude).toFixed(6));
        
        console.log(`====> Formatted coordinates: lat=${lat}, lng=${lng}`);
        
        await UPDATE(Drivers).set({ 
            currentLat: lat, 
            currentLong: lng 
        }).where({ ID: driverID });
        
        console.log(`====> Location updated successfully for driver ${driverID}`);
        return `Location updated for driver ${driverID}`;
    } catch (error) {
        console.error(`====> Location update failed for driver ${driverID}:`, error.message);
        return req.error(500, "Location update failed: " + error.message);
    }
});

// --- Secure Delivery Actions ---
this.on('sendOTP', async (req) => {
    const { phoneNumber } = req.data;
    console.log(`====> Sending OTP request received`);
   
    try {
        const activeShipment = await SELECT.one.from(Shipments)
            .columns('ID', 'receiverEmail', 'receiverCompany', 'status')
            .where({ status: { in: ['Assigned', 'In-Transit', 'ConfirmPickup'] } })
            .orderBy('createdAt desc');
       
        if (!activeShipment || !activeShipment.receiverEmail) {
            console.log('No active shipment or receiver email found, using default');
            const email = 'riddhima12506@gmail.com';
            const otp = Math.floor(1000 + Math.random() * 9000).toString();
           
            console.log(`\n📧 FALLBACK OTP for ${email}: ${otp}\n`);
            return {
                success: true,
                otp: otp,
                message: "OTP ready (fallback mode)"
            };
        }
       
        const receiverEmail = activeShipment.receiverEmail;
        console.log(`====> Sending OTP to receiver email: ${receiverEmail}`);
        console.log(`====> For shipment: ${activeShipment.ID} (${activeShipment.receiverCompany})`);
       
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const result = await emailService.sendOTP(receiverEmail, otp);
       
        if (result.success) {
            return {
                success: true,
                otp: otp,
                message: `OTP sent to ${receiverEmail} successfully`
            };
        } else {
            console.log(`\n📧 EMAIL OTP for ${receiverEmail}: ${otp}`);
            console.log('💻 Use this OTP to complete delivery\n');
           
            return {
                success: true,
                otp: otp,
                message: "OTP ready (check console)"
            };
        }
    } catch (error) {
        console.error("Email OTP Service Error:", error.message);
       
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const email = 'riddhima12506@gmail.com';
        console.log(`\n📧 FALLBACK OTP for ${email}: ${otp}\n`);
       
        return {
            success: true,
            otp: otp,
            message: "OTP ready (fallback mode)"
        };
    }
});

this.on('completeDelivery', async (req) => {
    const { shipmentId, otpVerified } = req.data;
    console.log(`====> Completing delivery for shipment: ${shipmentId}`);

    try {
        const result = await cds.tx(async (tx) => {
            // Get trip assignment using correct column names
            const tripAssignment = await tx.run(
                SELECT.one.from(TripAssignments)
                .where({ shipment_ID: shipmentId })
                .columns('truck_ID', 'driver_ID')
            );

            if (!tripAssignment) {
                throw new Error('Trip assignment not found');
            }

            console.log(`Found assignment - Truck: ${tripAssignment.truck_ID}, Driver: ${tripAssignment.driver_ID}`);

            // Update shipment status to Delivered
            await tx.update(Shipments).set({
                status: 'Delivered'
            }).where({ ID: shipmentId });

            // Mark truck as AVAILABLE
            await tx.update(Trucks).set({
                status: 'AVAILABLE'
            }).where({ ID: tripAssignment.truck_ID });

            // Mark driver as AVAILABLE
            await tx.update(Drivers).set({
                status: 'AVAILABLE'
            }).where({ ID: tripAssignment.driver_ID });

            // Update delivery time
            await tx.update(TripAssignments).set({
                actualDeliveryTime: new Date().toISOString()
            }).where({ shipment_ID: shipmentId });
            
            console.log(`✅ Driver ${tripAssignment.driver_ID} and Truck ${tripAssignment.truck_ID} marked as AVAILABLE`);
            
            return {
                truckID: tripAssignment.truck_ID,
                driverID: tripAssignment.driver_ID
            };
        });
        
        return {
            success: true,
            message: "Delivery completed successfully. Driver and truck are now available.",
            shipmentId: shipmentId,
            updatedResources: result
        };

    } catch (error) {
        console.error("Delivery completion error:", error.message);
        return req.error(500, "Failed to complete delivery: " + error.message);
    }
});

// --- Delay Reporting System ---
const { DelayLogs } = cds.entities('logichain.db');

this.on('reportDelay', async (req) => {
    const { shipmentID, driverID, delayReason } = req.data;
    console.log(`====> Reporting delay for shipment: ${shipmentID}`);

    try {
        await INSERT.into(DelayLogs).entries({
            shipment_ID: shipmentID,
            driver_ID: driverID,
            delayReason: delayReason,
            status: 'Active'
        });

        return {
            success: true,
            message: "Delay reported successfully"
        };
    } catch (error) {
        console.error("Delay reporting error:", error.message);
        return req.error(500, "Failed to report delay: " + error.message);
    }
});

this.on('getNotificationCount', async (req) => {
    const { userID, userRole } = req.data;
    
    try {
        let whereClause = { status: 'Active' };
        
        // Customer sees only their shipments' delays
        if (userRole === 'CUSTOMER') {
            const customerShipments = await SELECT.from(Shipments)
                .columns('ID')
                .where({ customer_ID: userID });
            const shipmentIDs = customerShipments.map(s => s.ID);
            whereClause.shipment_ID = { in: shipmentIDs };
        }
        // Admin sees all delays (no additional filter)
        
        const delays = await SELECT.from(DelayLogs).where(whereClause);
        return delays.length;
    } catch (error) {
        console.error("Notification count error:", error.message);
        return 0;
    }
});

// Availability Notification Handler using DelayLogs table
this.on('notifyCustomerUnavailability', async (req) => {
    const { shipmentID, notificationType, message } = req.data;
    console.log(`====> Creating availability notification for shipment: ${shipmentID}`);

    try {
        // Get customer ID from shipment
        const shipment = await SELECT.one.from(Shipments)
            .columns('customer_ID')
            .where({ ID: shipmentID });

        if (!shipment) {
            return req.error(404, "Shipment not found");
        }

        // Map notification type to proper delay reason
        let delayReason = 'DriverNotAvailable'; // Default
        
        if (notificationType === 'NoDriver') {
            delayReason = 'DriverNotAvailable';
        } else if (notificationType === 'NoTruck') {
            delayReason = 'TruckNotAvailable';
        } else if (notificationType === 'NoBoth') {
            delayReason = 'DriverNotAvailable'; // Use driver as primary reason
        }

        // Use DelayLogs table with proper reason for availability issues
        await INSERT.into(DelayLogs).entries({
            shipment_ID: shipmentID,
            driver_ID: null, // No specific driver for availability issues
            delayReason: delayReason,
            status: 'Active'
        });

        return {
            success: true,
            message: "Customer notified about unavailability"
        };
    } catch (error) {
        console.error("Availability notification error:", error.message);
        return req.error(500, "Failed to notify customer: " + error.message);
    }
});
});
