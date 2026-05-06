const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const Setting = require('../models/Setting');

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

module.exports = router;
