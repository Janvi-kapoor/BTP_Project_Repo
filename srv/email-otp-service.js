const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailOTPService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.GMAIL_USER || 'your_gmail@gmail.com',
                pass: process.env.GMAIL_APP_PASSWORD || 'your_16_digit_app_password'
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        console.log('Email OTP Service initialized');
    }

    async sendPickupOTP(email, otp, companyName = 'Customer') {
        try {
            const mailOptions = {
                from: process.env.GMAIL_USER || 'LogiChain <noreply@logichain.com>',
                to: email,
                subject: 'LogiChain Pickup Confirmation OTP',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; text-align: center;">
                            <h1 style="color: white; margin: 0;">LogiChain NEXUS</h1>
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
                                • Share this OTP only with the LogiChain driver<br>
                                • Pickup will be confirmed once OTP is verified
                            </p>
                        </div>
                       
                        <div style="background: #1e293b; padding: 20px; text-align: center;">
                            <p style="color: #94a3b8; margin: 0; font-size: 12px;">
                                © 2024 LogiChain NEXUS. All rights reserved.
                            </p>
                        </div>
                    </div>
                `
            };

            const result = await this.transporter.sendMail(mailOptions);
           
            console.log('✅ Pickup OTP email sent successfully');
            console.log('📧 Email ID:', email);
            console.log('🔐 Pickup OTP:', otp);
            console.log('📬 Message ID:', result.messageId);
           
            return {
                success: true,
                message: 'Pickup OTP sent to email successfully'
            };

        } catch (error) {
            console.error('❌ Pickup OTP email sending error:', error.message);
            return {
                success: false,
                message: 'Failed to send pickup OTP email'
            };
        }
    }

    async sendOTP(email, otp) {
        try {
            const mailOptions = {
                from: process.env.GMAIL_USER || 'LogiChain <noreply@logichain.com>',
                to: email,
                subject: 'LogiChain Delivery OTP Verification',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 20px; text-align: center;">
                            <h1 style="color: white; margin: 0;">LogiChain NEXUS</h1>
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
                                    <strong>Security Notice:</strong> LogiChain will never ask for your OTP over phone or email.
                                </p>
                            </div>
                        </div>
                       
                        <div style="background: #1e293b; padding: 20px; text-align: center;">
                            <p style="color: #94a3b8; margin: 0; font-size: 12px;">
                                © 2024 LogiChain NEXUS. All rights reserved.
                            </p>
                        </div>
                    </div>
                `
            };

            const result = await this.transporter.sendMail(mailOptions);
           
            console.log('✅ Email OTP sent successfully');
            console.log('📧 Email ID:', email);
            console.log('🔐 OTP:', otp);
            console.log('📬 Message ID:', result.messageId);
           
            return {
                success: true,
                message: 'OTP sent to email successfully'
            };

        } catch (error) {
            console.error('❌ Email sending error:', error.message);
            return {
                success: false,
                message: 'Failed to send email OTP'
            };
        }
    }
}
module.exports = EmailOTPService;