require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
    console.log('\n🧪 Testing Email Configuration...\n');
    console.log('Gmail User:', process.env.GMAIL_USER);
    console.log('Gmail Password:', process.env.GMAIL_APP_PASSWORD ? '✓ Set' : '✗ Not Set');
    
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });

    try {
        const info = await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: process.env.GMAIL_USER,
            subject: 'Test Email - LogiChain',
            text: 'This is a test email from LogiChain Route Optimizer'
        });
        
        console.log('\n✅ Email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('\n✓ Email service is working correctly\n');
    } catch (error) {
        console.error('\n❌ Email sending failed!');
        console.error('Error:', error.message);
        if (error.code === 'EAUTH') {
            console.error('\n⚠️  Authentication failed. Please check:');
            console.error('1. Gmail App Password is correct (no spaces)');
            console.error('2. 2-Step Verification is enabled in Google Account');
            console.error('3. App Password is generated for "Mail" app\n');
        }
    }
}

testEmail();
