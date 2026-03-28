const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailOTPService {
    constructor() {
        const gmailUser = process.env.GMAIL_USER;
        const gmailPass = process.env.GMAIL_APP_PASSWORD;
        
        if (!gmailUser || !gmailPass || gmailUser === 'your_gmail@gmail.com') {
            console.warn('⚠️  Gmail credentials not configured properly in .env file');
            this.configured = false;
            return;
        }
        
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: gmailUser,
                pass: gmailPass
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        this.configured = true;
        console.log('✅ Email OTP Service initialized with:', gmailUser);
    }

    async sendPickupOTP(email, otp, companyName = 'Customer') {
        if (!this.configured) {
            console.error('❌ Email service not configured');
            return { success: false, message: 'Email service not configured' };
        }
        
        try {
            const mailOptions = {
                from: `Cargo Connect <${process.env.GMAIL_USER}>`,
                to: email,
                subject: 'Cargo Connect Pickup Confirmation OTP',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; text-align: center;">
                            <h1 style="color: white; margin: 0;">Cargo Connect</h1>
                            <p style="color: white; margin: 5px 0;">Pickup Confirmation</p>
                        </div>
                       
                        <div style="padding: 30px; background: #f8fafc;">
                            <h2 style="color: #1e293b; margin-bottom: 20px;">Pickup Confirmation Required</h2>
                           
                            <p style="color: #64748b; font-size: 16px; line-height: 1.5;">
                                Dear ${companyName},<br><br>
                                Your shipment is ready for pickup. Please provide this OTP to the driver:
                            </p>
                           
                            <div style="background: white; border: 2px solid #10b981; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
                                <h1 style="color: #059669; font-size: 36px; margin: 0; letter-spacing: 8px;">${otp}</h1>
                            </div>
                           
                            <p style="color: #64748b; font-size: 14px;">
                                • This OTP is valid for 10 minutes<br>
                                • Share this OTP only with the Cargo Connect driver<br>
                                • Pickup will be confirmed once OTP is verified
                            </p>
                        </div>
                       
                        <div style="background: #1e293b; padding: 20px; text-align: center;">
                            <p style="color: #94a3b8; margin: 0; font-size: 12px;">
                                © 2024 Cargo Connect. All rights reserved.
                            </p>
                        </div>
                    </div>
                `
            };

            const result = await this.transporter.sendMail(mailOptions);
           
            console.log('✅ Pickup OTP email sent successfully');
            console.log('📧 To:', email);
            console.log('🔐 OTP:', otp);
            console.log('📬 Message ID:', result.messageId);
           
            return {
                success: true,
                message: `Pickup OTP sent to ${email}`
            };

        } catch (error) {
            console.error('❌ Pickup OTP email error:', error.message);
            if (error.code === 'EAUTH') {
                console.error('⚠️  Gmail authentication failed. Check GMAIL_APP_PASSWORD in .env');
            }
            return {
                success: false,
                message: 'Failed to send pickup OTP: ' + error.message
            };
        }
    }

    async sendOTP(email, otp) {
        if (!this.configured) {
            console.error('❌ Email service not configured');
            return { success: false, message: 'Email service not configured' };
        }
        
        try {
            const mailOptions = {
                from: `Cargo Connect <${process.env.GMAIL_USER}>`,
                to: email,
                subject: 'Cargo Connect Delivery OTP Verification',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 20px; text-align: center;">
                            <h1 style="color: white; margin: 0;">Cargo Connect</h1>
                            <p style="color: white; margin: 5px 0;">Delivery Verification</p>
                        </div>
                       
                        <div style="padding: 30px; background: #f8fafc;">
                            <h2 style="color: #1e293b; margin-bottom: 20px;">Delivery OTP Verification</h2>
                           
                            <p style="color: #64748b; font-size: 16px; line-height: 1.5;">
                                Your delivery verification OTP is:
                            </p>
                           
                            <div style="background: white; border: 2px solid #8b5cf6; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
                                <h1 style="color: #6366f1; font-size: 36px; margin: 0; letter-spacing: 8px;">${otp}</h1>
                            </div>
                           
                            <p style="color: #64748b; font-size: 14px;">
                                • This OTP is valid for 10 minutes<br>
                                • Do not share this OTP with anyone<br>
                                • Use this OTP to complete your delivery verification
                            </p>
                           
                            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                                <p style="color: #92400e; margin: 0; font-size: 14px;">
                                    <strong>Security Notice:</strong> Cargo Connect will never ask for your OTP over phone or email.
                                </p>
                            </div>
                        </div>
                       
                        <div style="background: #1e293b; padding: 20px; text-align: center;">
                            <p style="color: #94a3b8; margin: 0; font-size: 12px;">
                                © 2024 Cargo Connect. All rights reserved.
                            </p>
                        </div>
                    </div>
                `
            };

            const result = await this.transporter.sendMail(mailOptions);
           
            console.log('✅ Delivery OTP email sent successfully');
            console.log('📧 To:', email);
            console.log('🔐 OTP:', otp);
            console.log('📬 Message ID:', result.messageId);
           
            return {
                success: true,
                message: `Delivery OTP sent to ${email}`
            };

        } catch (error) {
            console.error('❌ Delivery OTP email error:', error.message);
            if (error.code === 'EAUTH') {
                console.error('⚠️  Gmail authentication failed. Check GMAIL_APP_PASSWORD in .env');
            }
            return {
                success: false,
                message: 'Failed to send delivery OTP: ' + error.message
            };
        }
    }
}
module.exports = EmailOTPService;