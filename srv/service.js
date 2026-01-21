const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
    // Entities ko handler ke bahar define karein lekin impl ke andar
    const { Users, AdminShipments } = this.entities;

    this.on('READ', 'Users', async (req, next) => {
        // Agar request mein filter (email) aaya hai
        if (req.query.SELECT.where) {
            return next(); // CAP ko khud handle karne dein (Default filter)
        }

        // Agar koi filter nahi hai, toh secure rehne ke liye empty array bhein 
        // ya sirf wahi data bhein jo login user ka hai
        return next();
    });

    this.on('getDashboardMetrics', async (req) => {
        // 1. Frontend se 'userEmail' parameter nikalna
        const userEmail = req.data.userEmail || req._.req.query.userEmail;
        console.log(req);
        // 2. Debugging: Terminal mein check karein ki sahi email aa rahi hai
        console.log("Fetching metrics for:", userEmail);

        // 3. Email check (Agar undefined hai toh error return karein taaki server crash na ho)
        if (!userEmail) {
            return req.error(400, "User email is missing in the request");
        }
        const all = await SELECT.from(AdminShipments).where`customer.email = ${userEmail}`;
        console.log(all);
        const active = all.filter(s => s.status === 'In-Transit').length;
        const pending = all.filter(s => s.status === 'Pending' || s.status === 'Assigned').length;
        console.log(active + " " + pending);
        // Schema mein field 'totalFare' hai
        const totalSpend = all.reduce((sum, s) => sum + (Number(s.totalFare) || 0), 0);

        // 6. Response bhein jo .cds function definition se match kare
        return {
            activeShipments: active,
            pendingDispatch: pending,
            monthlySpend: totalSpend
        };
    });
    this.on('READ', 'AdminShipments', async (req, next) => {
        // Agar query mein filter aaya hai (like email)
        if (req.query.SELECT.where) {
            console.log("Filtering shipments for customer...");
        }
        return next(); // Default CAP logic ko execute hone dein
    });
});