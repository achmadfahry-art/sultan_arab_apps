/**
 * SULTAN ARAB APP — Modul Integrasi WhatsApp (Q011)
 * Menyediakan pengiriman langsung via URL WhatsApp Click-to-Chat
 * serta opsi integrasi gateway otomatis (misal: Fonnte / Wablas / Generic API).
 */

function formatIndonesianPhoneNumber(phone) {
  if (!phone) return '';
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (!clean.startsWith('62')) {
    clean = '62' + clean;
  }
  return clean;
}

function generateWhatsAppLink(phoneNumber, message) {
  const formattedPhone = formatIndonesianPhoneNumber(phoneNumber);
  const encodedText = encodeURIComponent(message);
  return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;
}

async function sendWhatsAppNotification({ phone, message }) {
  const formattedPhone = formatIndonesianPhoneNumber(phone);
  const gatewayUrl = process.env.WA_GATEWAY_URL;
  const apiKey = process.env.WA_API_KEY;

  const directLink = generateWhatsAppLink(formattedPhone, message);

  // Jika ada Gateway API terkonfigurasi di .env
  if (gatewayUrl && apiKey) {
    try {
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey
        },
        body: JSON.stringify({
          target: formattedPhone,
          message: message
        })
      });
      const data = await response.json();
      return { success: true, via: 'gateway', data, directLink };
    } catch (err) {
      console.warn('[WA Gateway Error, fallback to direct link]', err.message);
      return { success: false, via: 'direct_link_fallback', directLink, error: err.message };
    }
  }

  // Default: Direct Click-to-Chat link
  return {
    success: true,
    via: 'direct_link',
    directLink,
    message: 'Tautan WhatsApp langsung siap dibuka.'
  };
}

module.exports = {
  formatIndonesianPhoneNumber,
  generateWhatsAppLink,
  sendWhatsAppNotification
};
