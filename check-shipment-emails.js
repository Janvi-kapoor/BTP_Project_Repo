const cds = require('@sap/cds');

async function checkEmails() {
    try {
        await cds.connect.to('db');
        const { Shipments, Users } = cds.entities('logichain.db');
        
        console.log('\n📦 Checking Shipments...\n');
        
        const shipments = await SELECT.from(Shipments)
            .columns('ID', 'customer_ID', 'receiverEmail', 'receiverCompany', 'status')
            .limit(5);
        
        for (const shipment of shipments) {
            console.log(`Shipment: ${shipment.ID}`);
            console.log(`  Status: ${shipment.status}`);
            console.log(`  Customer ID: ${shipment.customer_ID}`);
            console.log(`  Receiver Email: ${shipment.receiverEmail || 'NOT SET'}`);
            console.log(`  Receiver Company: ${shipment.receiverCompany || 'NOT SET'}`);
            
            if (shipment.customer_ID) {
                const customer = await SELECT.one.from(Users)
                    .columns('email', 'companyName')
                    .where({ ID: shipment.customer_ID });
                console.log(`  Customer Email: ${customer?.email || 'NOT FOUND'}`);
                console.log(`  Customer Company: ${customer?.companyName || 'NOT FOUND'}`);
            }
            console.log('');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkEmails();
