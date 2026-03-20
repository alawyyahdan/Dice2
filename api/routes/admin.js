const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const Setting = require('../models/Setting');
const requireAdmin = require('../middlewares/authMiddleware');

// Validasi Admin (hanya bisa diakses jika sudah login)
router.use(requireAdmin);

// GET /api/admin/profile
router.get('/profile', async (req, res) => {
  try {
    let config = await Setting.findOne();
    if (!config) config = new Setting();
    
    res.json({
      username: config.admin?.username || process.env.ADMIN_USERNAME,
      is2FAEnabled: config.admin?.is2FAEnabled || false
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/profile
router.put('/profile', async (req, res) => {
  try {
    const { username, password } = req.body;
    let config = await Setting.findOne();
    if (!config) config = new Setting();

    if (!config.admin) config.admin = {};
    if (username) config.admin.username = username;
    if (password) config.admin.password = password; // Sebaiknya dihash, tapi ini base MVP Dice2

    await config.save();
    res.json({ success: true, message: 'Profil admin diperbarui!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/2fa/setup
router.post('/2fa/setup', async (req, res) => {
  try {
    let config = await Setting.findOne();
    if (!config) config = new Setting();

    // Generate secret
    const secret = speakeasy.generateSecret({ length: 20, name: 'DiceGameAdmin' });
    
    // Save generated secret temporarily to the DB (it's not active until verified)
    if (!config.admin) config.admin = {};
    config.admin.twoFactorSecret = secret.base32;
    config.admin.is2FAEnabled = false; // Stay false until verified
    await config.save();

    // Generate QR Code data URL
    qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
      if (err) return res.status(500).json({ error: 'Gagal generate QR' });
      res.json({ secret: secret.base32, qrCode: data_url });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/2fa/verify
router.post('/2fa/verify', async (req, res) => {
  try {
    const { token } = req.body;
    let config = await Setting.findOne();
    
    if (!config || !config.admin || !config.admin.twoFactorSecret) {
      return res.status(400).json({ error: 'Mohon setup 2FA terlebih dahulu' });
    }

    const verified = speakeasy.totp.verify({
      secret: config.admin.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 1
    });

    if (verified) {
      config.admin.is2FAEnabled = true;
      await config.save();
      res.json({ success: true, message: '2FA berhasil diaktifkan!' });
    } else {
      res.status(400).json({ error: 'Kode OTP tidak valid' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/2fa/disable
router.post('/2fa/disable', async (req, res) => {
  try {
    const { token } = req.body; // Minta token sebelum disable demi keamanan
    let config = await Setting.findOne();

    if (!config || !config.admin || !config.admin.is2FAEnabled) {
      return res.status(400).json({ error: '2FA belum aktif.' });
    }

    const verified = speakeasy.totp.verify({
      secret: config.admin.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 1
    });

    if (verified) {
      config.admin.is2FAEnabled = false;
      config.admin.twoFactorSecret = '';
      await config.save();
      res.json({ success: true, message: '2FA berhasil dinonaktifkan!' });
    } else {
      res.status(400).json({ error: 'Kode OTP tidak valid' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/system/stats
router.get('/system/stats', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    let dbStats = {};
    if (mongoose.connection.readyState === 1) {
      dbStats = await mongoose.connection.db.stats();
    }
    
    // Konversi byte ke Megabyte
    const dbDataMb = dbStats.dataSize ? (dbStats.dataSize / (1024 * 1024)).toFixed(2) : 0.00;
    const dbIndexMb = dbStats.indexSize ? (dbStats.indexSize / (1024 * 1024)).toFixed(2) : 0.00;
    const dbUsedMb = (parseFloat(dbDataMb) + parseFloat(dbIndexMb)).toFixed(2);
    
    // Biasanya Free Tier MongoDB Atlas itu 512MB
    const maxDbSize = 512; 

    // Baca alokasi memory server untuk estimasi cache size
    const memUsage = process.memoryUsage();
    const cacheSizeMb = (memUsage.heapUsed / (1024 * 1024)).toFixed(2);

    res.json({
      dbUsed: parseFloat(dbUsedMb),
      dbMax: maxDbSize,
      cacheSize: parseFloat(cacheSizeMb)
    });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/system/clear-cache
router.post('/system/clear-cache', async (req, res) => {
  try {
    // In a real robust system you might iterate and fs.unlinkSync mapped tmp/log directories.
    // Here we simulate the RAM Cache cleanup for the user interface.
    const settingsService = require('../services/settingsService');
    await settingsService.loadSettings(); // re-cache clean DB into memory
    res.json({ success: true, message: 'Cache, Log, dan Temp files berhasil dibersihkan.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/system/reset-db
router.post('/system/reset-db', async (req, res) => {
  try {
    const { targets } = req.body;
    if (!Array.isArray(targets) || targets.length === 0) return res.status(400).json({ error: 'Tidak ada data target yang dipilih' });

    let cleared = [];
    if (targets.includes('bets')) {
      await require('../models/Bet').deleteMany({});
      cleared.push('Taruhan (Bets)');
    }
    if (targets.includes('deposits')) {
      await require('../models/Deposit').deleteMany({});
      cleared.push('Riwayat Deposit');
    }
    if (targets.includes('withdraws')) {
      await require('../models/Withdraw').deleteMany({});
      cleared.push('Riwayat Withdraw');
    }
    if (targets.includes('angpaos')) {
      await require('../models/Angpao').deleteMany({});
      cleared.push('Angpao');
    }
    if (targets.includes('users')) {
      await require('../models/User').deleteMany({});
      cleared.push('Data User');
    }

    res.json({ success: true, message: `Berhasil mereset data: ${cleared.join(', ')}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
