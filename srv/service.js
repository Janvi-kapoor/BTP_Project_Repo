const cds = require("@sap/cds");

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
  const { Shipments, Drivers } = cds.entities('logichain.db'); 

    this.on('getDashboardStats', async (req) => {
        console.log("===> Dashboard API Hit!");

        try {
            // 1. Total Revenue calculation
            // Note: DB level par entity ka naam use hoga
            const revResult = await SELECT.one.from(Shipments)
                .columns('sum(totalFare) as total')
                .where({ status: 'Delivered' });

            // 2. Active Drivers calculation
           const driversResult = await SELECT.from(Drivers)
    .where({ status: 'AVAILABLE' });

            const totalRev = revResult && revResult.total ? Number(revResult.total) : 0;
            
            const responseData = {
                totalRevenue: totalRev,
                totalCommission: totalRev * 0.15,
                activeDrivers: driversResult ? driversResult.length : 0
            };

            console.log("Data fetched from HANA successfully:", responseData);
            return responseData;

        } catch (error) {
            console.error("HANA Query Error:", error.message);
            return req.error(500, "Database lookup failed: " + error.message);
        }
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
                
                // 1. Shipment ka status 'In Transit' karo
                await tx.update(Shipments).set({ status: 'In Transit' }).where({ ID: orderID });

                // 2. Truck ka status 'ON_TRIP' karo
                await tx.update(Trucks).set({ status: 'ON_TRIP' }).where({ ID: truckID });

                // 3. Driver ka status 'BUSY' karo
                await tx.update(Drivers).set({ status: 'BUSY' }).where({ ID: driverID });

                // 4. TripAssignments table mein entry dalo (History ke liye)
                await tx.create(TripAssignments).entries({
                    shipment_ID: orderID,
                    truck_ID: truckID,
                    driver_ID: driverID,
                    status: 'Active'
                });
            });

            return "Order successfully dispatched and resource status updated!";

        } catch (error) {
            console.error("Dispatch Error:", error.message);
            return req.error(500, "Database update failed: " + error.message);
        }
    });
});
