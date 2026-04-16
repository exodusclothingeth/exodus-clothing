// ========== EMAIL VERIFICATION LOGIN SYSTEM ==========
// Store verification codes temporarily
const verificationCodes = {};

// Generate random 6-digit code
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send verification code to your email
app.post('/api/send-verification', async (req, res) => {
    try {
        const { email } = req.body;
        const YOUR_EMAIL = 'exodusclothingeth@gmail.com';
        
        // Only allow your email address
        if (email !== YOUR_EMAIL) {
            return res.json({ success: false, error: 'Unauthorized email address' });
        }
        
        const code = generateCode();
        
        // Store code with 5 minute expiration
        verificationCodes[email] = {
            code: code,
            expires: Date.now() + 5 * 60 * 1000
        };
        
        console.log(`📧 Verification code for ${email}: ${code}`);
        
        // Send email with code
        if (transporter) {
            await transporter.sendMail({
                from: `"EXODUS CLOTHING" <${YOUR_EMAIL}>`,
                to: email,
                subject: '🔐 EXODUS - Admin Login Verification Code',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>EXODUS Login Code</title>
                    </head>
                    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
                        <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                            <div style="text-align: center; margin-bottom: 30px;">
                                <h1 style="color: #000000; font-size: 28px; margin: 0;">EXODUS</h1>
                                <p style="color: #888888; margin: 5px 0 0;">CLOTHING</p>
                            </div>
                            
                            <h2 style="color: #333; font-size: 20px; margin-bottom: 20px;">Admin Login Verification</h2>
                            
                            <p style="color: #555; font-size: 16px; margin-bottom: 25px;">Your verification code is:</p>
                            
                            <div style="background: #f0f0f0; padding: 20px; text-align: center; border-radius: 12px; margin-bottom: 25px;">
                                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #000;">${code}</span>
                            </div>
                            
                            <p style="color: #555; font-size: 14px;">This code will expire in <strong>5 minutes</strong>.</p>
                            <p style="color: #555; font-size: 14px;">If you didn't request this, please ignore this email.</p>
                            
                            <hr style="margin: 30px 0 20px; border: none; border-top: 1px solid #eee;">
                            
                            <p style="color: #999; font-size: 12px; text-align: center;">EXODUS CLOTHING - Ethiopian Streetwear<br>📞 +251968621548</p>
                        </div>
                    </body>
                    </html>
                `
            });
            
            console.log(`✅ Verification email sent to ${email}`);
            res.json({ success: true, message: 'Verification code sent to your email' });
        } else {
            // Fallback when email not configured (for testing)
            console.log(`⚠️ Email not configured. Your verification code is: ${code}`);
            res.json({ success: true, code: code, message: 'Email not configured. Use this code: ' + code });
        }
    } catch (error) {
        console.error('Error sending verification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Verify the code
app.post('/api/verify-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        const YOUR_EMAIL = 'exodusclothingeth@gmail.com';
        
        if (email !== YOUR_EMAIL) {
            return res.json({ success: false, error: 'Unauthorized email address' });
        }
        
        const stored = verificationCodes[email];
        
        if (!stored) {
            return res.json({ success: false, error: 'No verification code found. Request a new one.' });
        }
        
        if (Date.now() > stored.expires) {
            delete verificationCodes[email];
            return res.json({ success: false, error: 'Verification code has expired. Request a new one.' });
        }
        
        if (stored.code !== code) {
            return res.json({ success: false, error: 'Invalid verification code. Please try again.' });
        }
        
        // Code is valid - clear it and allow login
        delete verificationCodes[email];
        res.json({ success: true, message: 'Verification successful' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});