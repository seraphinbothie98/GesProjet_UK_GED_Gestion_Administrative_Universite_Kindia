const QRCode = require('qrcode');

/**
 * Generates a QR Code Data URL or Buffer for public verification
 */
async function generateQRCodeDataUrl(verificationUrl) {
  try {
    const dataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 1,
      color: {
        dark: '#002B49',
        light: '#FFFFFF'
      }
    });
    return dataUrl;
  } catch (err) {
    console.error('Error generating QR code:', err);
    throw err;
  }
}

async function generateQRCodeBuffer(verificationUrl) {
  try {
    const buffer = await QRCode.toBuffer(verificationUrl, {
      errorCorrectionLevel: 'H',
      type: 'png',
      margin: 1,
      color: {
        dark: '#002B49',
        light: '#FFFFFF'
      }
    });
    return buffer;
  } catch (err) {
    console.error('Error generating QR code buffer:', err);
    throw err;
  }
}

module.exports = { 
  generateQRCodeDataUrl, 
  generateQRCodeDataURL: generateQRCodeDataUrl, 
  generateQRCodeBuffer 
};
