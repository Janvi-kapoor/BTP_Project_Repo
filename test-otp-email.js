require('dotenv').config();
const EmailOTPService = require('./srv/email-otp-service');

async function testOTPEmail() {
    console.log('\n🧪 Testing OTP Email Service...\n');
    
    const emailService = new EmailOTPService();
    
    // Test Pickup OTP
    console.log('📧 Testing Pickup OTP...');
    const pickupResult = await emailService.sendPickupOTP(
        'riddhima12506@gmail.com',
        '1234',
        'Test Company'
    );
    console.log('Pickup Result:', pickupResult);
    
    // Test Delivery OTP
    console.log('\n📧 Testing Delivery OTP...');
    const deliveryResult = await emailService.sendOTP(
        'riddhima12506@gmail.com',
        '5678'
    );
    console.log('Delivery Result:', deliveryResult);
    
    console.log('\n✅ Test completed!\n');
}

testOTPEmail().catch(console.error);
