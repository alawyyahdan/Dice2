const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const Withdraw = require('../models/Withdraw');
const Bet = require('../models/Bet');

// Verifikasi Telegram initData menggunakan HMAC-SHA256
function verifyTelegramInitData(initData) {
  console.log('--- VERIFY INIT DATA ---');
  console.log('DEBUG ENV:', process.env.DEBUG);
  console.log('initData:', initData);

  if (String(process.env.DEBUG).trim() === 'true' && initData === 'mock-debug-init-data') return true; // BYPASS HANYA JIKA DEBUG=TRUE

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN)
      .digest();

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return hash === expectedHash;
  } catch {
    return false;
  }
}

// GET /api/miniapp/user-info?telegramId=xxx
router.get('/user-info', async (req, res) => {
  try {
    const { telegramId } = req.query;
    if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

    const user = await User.findOne({ telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      balance: user.balance || 0,
      turnover: user.turnover,
      turnoverRequired: Math.max(0, Math.floor(user.turnoverRequired || 0)),
      turnoverMet: (user.turnoverRequired || 0) <= 0,
      turnoverRemaining: Math.max(0, Math.floor(user.turnoverRequired || 0)),
      banks: user.banks || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/miniapp/add-bank
router.post('/add-bank', async (req, res) => {
  try {
    const { initData, telegramId, bankName, accountNumber, accountName } = req.body;
    
    if (!verifyTelegramInitData(initData)) {
      return res.status(403).json({ error: 'Invalid Telegram data' });
    }

    if (!bankName || !accountNumber || !accountName) {
      return res.status(400).json({ error: 'Semua data bank wajib diisi' });
    }

    const user = await User.findOne({ telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Cek duplikasi di akun sendiri
    const exists = user.banks?.find(b => b.accountNumber === accountNumber);
    if (exists) {
      return res.status(400).json({ error: 'Rekening ini sudah ditautkan!' });
    }

    // Cek duplikasi di database global (akun lain)
    const globalExists = await User.findOne({ 'banks.accountNumber': accountNumber });
    if (globalExists) {
      return res.status(400).json({ error: 'Nomor Rekening ini sudah TERDAFTAR di akun lain! Gunakan rekening pribadi.' });
    }

    // Limit maximum linked banks (contoh maks 3)
    if (user.banks && user.banks.length >= 3) {
      return res.status(400).json({ error: 'Maksimal 3 rekening bank yang bisa ditautkan.' });
    }

    user.banks = user.banks || [];
    user.banks.push({
      bankName: bankName.toUpperCase(),
      accountNumber,
      accountName: accountName.toUpperCase()
    });
    
    await user.save();
    res.json({ message: 'Rekening berhasil ditautkan!', banks: user.banks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/miniapp/bets?telegramId=xxx
router.get('/bets', async (req, res) => {
  try {
    const { telegramId } = req.query;
    if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

    // Ambil 20 taruhan terakhir
    const bets = await Bet.find({ telegramId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({ bets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/miniapp/withdraw
router.post('/withdraw', async (req, res) => {
  try {
    const { initData, telegramId, amount, bankName, accountNumber, accountName } = req.body;

    // Verifikasi initData dari Telegram
    if (!verifyTelegramInitData(initData)) {
      return res.status(403).json({ error: 'Invalid Telegram data' });
    }

    const nominal = Number(req.body.amount);
    if (!nominal || nominal < 20) return res.status(400).json({ error: 'Minimal withdraw 20 pt' });

    const user = await User.findOne({ telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.balance < nominal) {
      return res.status(400).json({ error: 'Saldo tidak mencukupi' });
    }

    if (user.turnoverRequired > 0) {
      const remaining = Math.max(0, user.turnoverRequired);
      return res.status(400).json({ error: `Syarat Turnover belum terpenuhi, Mainkan ${remaining} pt lagi.` });
    }

    if (!bankName || !accountNumber || !accountName) {
      return res.status(400).json({ error: 'Data rekening tujuan tidak lengkap' });
    }

    const wd = await Withdraw.create({
      userId: user._id,
      telegramId,
      amount: nominal,
      bankName,
      accountNumber,
      accountName
    });

    res.json({ message: 'Permintaan withdraw berhasil dikirim', withdraw: wd });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
