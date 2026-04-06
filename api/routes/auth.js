const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const Setting = require('../models/Setting');
const axios = require('axios');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password, token: twoFactorToken } = req.body;

    let config = await Setting.findOne();
    if (!config) config = new Setting();

    const expectedUser = config.admin?.username || process.env.ADMIN_USERNAME;
    const expectedPass = config.admin?.password || process.env.ADMIN_PASSWORD;

    if (username !== expectedUser || password !== expectedPass) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    if (config.admin?.is2FAEnabled && config.admin?.twoFactorSecret) {
      if (!twoFactorToken) {
         return res.json({ requires2FA: true, message: '2FA Token Required' });
      }
      
      const verified = speakeasy.totp.verify({
        secret: config.admin.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorToken,
        window: 1
      });
      
      if (!verified) {
        return res.status(401).json({ error: 'Kode 2FA tidak valid' });
      }
    }

    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/track — Silent security monitor (dipanggil client saat buka halaman login)
router.post('/track', async (req, res) => {
  // Selalu balas 200 agar tidak terdeteksi
  res.json({ ok: true });

  // Proses di background, tidak memblokir response
  setImmediate(async () => {
    try {
      const secToken = process.env.SECURITY_BOT_TOKEN;
      const secChat = process.env.SECURITY_CHAT_ID;
      if (!secToken || !secChat) return;

      // Ambil IP asli (support proxy/Cloudflare/Nginx)
      const rawIp =
        req.headers['cf-connecting-ip'] ||
        req.headers['x-real-ip'] ||
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket.remoteAddress ||
        'Unknown';

      // Normalize IPv6 loopback
      const ip = rawIp === '::1' ? '127.0.0.1' : rawIp;
      const { ua, ref } = req.body || {};
      const time = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

      // Cek apakah IP private/lokal
      const isPrivate = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|localhost)/i.test(ip);

      let geo = {};
      if (!isPrivate) {
        try {
          const geoRes = await axios.get(
            `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp,org,lat,lon,timezone`,
            { timeout: 5000 }
          );
          if (geoRes.data?.status === 'success') geo = geoRes.data;
        } catch (e) {}
      }

      const mapsLink = geo.lat ? `https://maps.google.com/?q=${geo.lat},${geo.lon}` : null;

      const locationLine = isPrivate
        ? `📍 <b>Lokasi:</b> 🏠 Local / Private Network`
        : `📍 <b>Lokasi:</b> ${[geo.city, geo.regionName, geo.country].filter(Boolean).join(', ') || 'Tidak diketahui'}`;

      const msg = [
        `🔐 <b>ADMIN LOGIN PAGE VISITED</b>`,
        ``,
        `🕐 <b>Waktu:</b> ${time} WIB`,
        `🌐 <b>IP:</b> <code>${ip}</code>`,
        locationLine,
        !isPrivate && geo.isp ? `📡 <b>ISP:</b> ${geo.isp}` : null,
        !isPrivate && geo.org  ? `🏢 <b>Org:</b> ${geo.org}` : null,
        !isPrivate && geo.timezone ? `🕰️ <b>Timezone:</b> ${geo.timezone}` : null,
        `📱 <b>UA:</b> <code>${(ua || 'Unknown').slice(0, 150)}</code>`,
        ref ? `🔗 <b>Referer:</b> ${ref}` : null,
        mapsLink ? `\n🗺️ <a href="${mapsLink}">Lihat di Google Maps</a>` : null,
      ].filter(v => v !== null).join('\n');

      await axios.post(`https://api.telegram.org/bot${secToken}/sendMessage`, {
        chat_id: secChat,
        text: msg,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
    } catch (e) {
      // Silent — tidak pernah di-log
    }
  });
});

module.exports = router;
