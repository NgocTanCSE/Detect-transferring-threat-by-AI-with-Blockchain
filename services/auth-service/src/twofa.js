/**
 * 2FA/TOTP Authentication Module
 */

const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

// Generate TOTP secret and QR code URL
function generateSecret(userId, email) {
    const secret = speakeasy.generateSecret({
        name: `Blockchain AI Sentinel (${email})`,
        issuer: 'Sentinel',
        length: 32
    });
    return { secret: secret.base32, otpauth_url: secret.otpauth_url };
}

// Verify TOTP token
function verifyToken(secret, token) {
    return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 1
    });
}

// Generate QR code for authenticator app
async function generateQRCode(otpauth_url) {
    try {
        return await qrcode.toDataURL(otpauth_url);
    } catch (e) {
        return null;
    }
}

module.exports = {
    generateSecret,
    verifyToken,
    generateQRCode
};