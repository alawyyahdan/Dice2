const crypto = require('crypto');

/**
 * Verifikasi Telegram Mini App initData menggunakan HMAC-SHA256
 * @param {string} initData - Raw initData string dari Telegram WebApp
 * @returns {boolean}
 */
function verifyTelegramInitData(initData) {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    return hash === expectedHash;
  } catch {
    return false;
  }
}

module.exports = { verifyTelegramInitData };
