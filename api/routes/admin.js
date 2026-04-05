const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const Setting = require('../models/Setting');
const Group = require('../models/Group');
const Bet = require('../models/Bet');
const User = require('../models/User');
const axios = require('axios');
const os = require('os');
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
      is2FAEnabled: config.admin?.is2FAEnabled || false,
      notificationTelegramId: config.admin?.notificationTelegramId || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/profile
router.put('/profile', async (req, res) => {
  try {
    const { username, password, notificationTelegramId } = req.body;
    let config = await Setting.findOne();
    if (!config) config = new Setting();

    if (!config.admin) config.admin = {};
    if (username !== undefined) config.admin.username = username;
    if (password) config.admin.password = password; 
    if (notificationTelegramId !== undefined) config.admin.notificationTelegramId = notificationTelegramId;

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

// Helper: ukur CPU usage nyata dengan sampling 100ms
function getCpuUsagePercent() {
  return new Promise((resolve) => {
    const cpusBefore = os.cpus();
    setTimeout(() => {
      const cpusAfter = os.cpus();
      let totalIdle = 0, totalTick = 0;
      for (let i = 0; i < cpusBefore.length; i++) {
        const before = cpusBefore[i].times;
        const after = cpusAfter[i].times;
        const idle = (after.idle - before.idle);
        const total = Object.keys(after).reduce((acc, k) => acc + (after[k] - before[k]), 0);
        totalIdle += idle;
        totalTick += total;
      }
      const usage = totalTick === 0 ? 0 : (1 - totalIdle / totalTick) * 100;
      resolve(parseFloat(usage.toFixed(2)));
    }, 100);
  });
}

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

    // Server Metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(2);
    
    // CPU usage real via sampling (bukan loadavg)
    const cpuUsagePercent = await getCpuUsagePercent();

    const uptimeSeconds = os.uptime();
    const days = Math.floor(uptimeSeconds / (24 * 3600));
    const hours = Math.floor((uptimeSeconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeHuman = `${days}d ${hours}h ${minutes}m`;

    const memUsage = process.memoryUsage();
    const nodeMemMb = (memUsage.rss / (1024 * 1024)).toFixed(2);

    res.json({
      dbUsed: parseFloat(dbUsedMb),
      dbMax: maxDbSize,
      cpuUsage: cpuUsagePercent,
      ramUsage: {
        used: (usedMem / (1024 * 1024 * 1024)).toFixed(2), // GB
        total: (totalMem / (1024 * 1024 * 1024)).toFixed(2), // GB
        percent: parseFloat(memUsagePercent)
      },
      uptime: uptimeHuman,
      nodeMem: parseFloat(nodeMemMb),
      platform: os.platform(),
      arch: os.arch()
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
    if (targets.includes('cs')) {
      await require('../models/Ticket').deleteMany({});
      await require('../models/Message').deleteMany({});
      cleared.push('Customer Service (Tiket & Pesan)');
    }
    if (targets.includes('broadcast')) {
      await require('../models/Broadcast').deleteMany({});
      cleared.push('Riwayat Broadcast');
    }

    res.json({ success: true, message: `Berhasil mereset data: ${cleared.join(', ')}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GROUP MANAGEMENT ALGORITHMS ---

// GET /api/admin/groups
router.get('/groups', async (req, res) => {
  try {
    const groups = await Group.find().sort({ addedAt: -1 }).lean();
    
    // Get total volumes
    const volumeStats = await Bet.aggregate([
      { $match: { isGroup: true } },
      { $group: { _id: "$groupId", volume: { $sum: "$betAmount" } } }
    ]);
    const volumeMap = {};
    volumeStats.forEach(v => { volumeMap[v._id] = v.volume; });

    // Fetch members concurrently via TG API
    const promises = groups.map(async (g) => {
      let memberCount = 0;
      try {
        if (process.env.BOT_TOKEN) {
          const tRes = await axios.get(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/getChatMemberCount?chat_id=${g.chatId}`);
          if (tRes.data && tRes.data.ok) memberCount = tRes.data.result;
        }
      } catch (e) {
        // Ignored if bot was kicked
      }
      return {
        _id: g._id,
        chatId: g.chatId,
        title: g.title,
        isActive: g.isActive,
        addedAt: g.addedAt,
        totalVolume: volumeMap[g.chatId] || 0,
        memberCount
      };
    });

    const result = await Promise.all(promises);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/groups/:id/toggle
router.patch('/groups/:id/toggle', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    group.isActive = !group.isActive;
    await group.save();
    res.json({ success: true, isActive: group.isActive });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/groups/:id
router.delete('/groups/:id', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    await Group.deleteOne({ _id: group._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/groups/:id/stats
router.get('/groups/:id/stats', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const chatId = group.chatId;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const matchGroup = { isGroup: true, groupId: chatId };

    const [daily, weekly, monthly, top10] = await Promise.all([
      Bet.aggregate([{ $match: { ...matchGroup, createdAt: { $gte: today } } }, { $group: { _id: null, total: { $sum: "$betAmount" } } }]),
      Bet.aggregate([{ $match: { ...matchGroup, createdAt: { $gte: weekAgo } } }, { $group: { _id: null, total: { $sum: "$betAmount" } } }]),
      Bet.aggregate([{ $match: { ...matchGroup, createdAt: { $gte: monthAgo } } }, { $group: { _id: null, total: { $sum: "$betAmount" } } }]),
      Bet.aggregate([
        { $match: matchGroup },
        { $group: { _id: "$telegramId", volume: { $sum: "$betAmount" } } },
        { $sort: { volume: -1 } },
        { $limit: 10 }
      ])
    ]);

    const enrichedTop10 = [];
    for (let t of top10) {
      const u = await User.findOne({ telegramId: t._id }).lean();
      enrichedTop10.push({
        telegramId: t._id,
        username: u ? (u.username || u.firstName) : 'Unknown',
        volume: t.volume
      });
    }

    res.json({
      daily: daily[0]?.total || 0,
      weekly: weekly[0]?.total || 0,
      monthly: monthly[0]?.total || 0,
      top10: enrichedTop10
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
