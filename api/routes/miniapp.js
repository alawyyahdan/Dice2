const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const Withdraw = require('../models/Withdraw');
const Bet = require('../models/Bet');

// Verifikasi Telegram initData menggunakan HMAC-SHA256
function verifyTelegramInitData(initData) {

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

// GET /api/miniapp/user-info?telegramId=xxx&initData=xxx
router.get('/user-info', async (req, res) => {
  try {
    const { telegramId, initData, photoUrl } = req.query;
    if (!verifyTelegramInitData(initData)) return res.status(403).json({ error: 'Auth failed' });
    if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

    let update = {};
    if (photoUrl && photoUrl !== 'undefined') update.photoUrl = photoUrl;

    const user = await User.findOneAndUpdate(
       { telegramId },
       Object.keys(update).length > 0 ? { $set: update } : {},
       { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    const config = require('../services/settingsService').getSettings();
    const withdrawConfig = config?.paymentGateway?.withdraw || {};
    const activeBanks = (withdrawConfig.banks || []).filter(b => b.isActive != false);

    res.json({
      balance: user.balance || 0,
      turnover: user.turnover,
      turnoverRequired: Math.max(0, Math.floor(user.turnoverRequired || 0)),
      turnoverMet: (user.turnoverRequired || 0) <= 0,
      turnoverRemaining: Math.max(0, Math.floor(user.turnoverRequired || 0)),
      banks: user.banks || [],
      activeBanks: activeBanks,
      csContactLink: config?.strings?.cs_contact_link || '',
      isLeaderboardActive: config?.isLeaderboardActive !== false,
      withdrawRule: withdrawConfig.rule || 'free'
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

// GET /api/miniapp/bets?telegramId=xxx&initData=xxx
router.get('/bets', async (req, res) => {
  try {
    const { telegramId, initData } = req.query;
    if (!verifyTelegramInitData(initData)) return res.status(403).json({ error: 'Auth failed' });
    if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

    // Ambil 10 taruhan terakhir
    const bets = await Bet.find({ telegramId })
      .sort({ createdAt: -1 })
      .limit(10)
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

    const Setting = require('../models/Setting');
    const paymentService = require('../services/paymentService');
    const config = await Setting.findOne();
    const withdrawConfig = config?.paymentGateway?.withdraw || {};

    const minWd = withdrawConfig.minWithdraw || 20;
    const maxWd = withdrawConfig.maxWithdraw || 10000;
    
    if (withdrawConfig.rule === 'all') {
      if (nominal !== Math.floor(user.balance)) {
         return res.status(400).json({ error: `Aturan Admin: Wajib menarik / withdraw SELURUH SALDO secara sekaligus!` });
      }
    } else {
      if (nominal < minWd) return res.status(400).json({ error: `Minimal withdraw ${minWd} pt` });
      if (nominal > maxWd) return res.status(400).json({ error: `Maksimal withdraw ${maxWd} pt` });
    }

    if (withdrawConfig.providerType === 'none') {
      return res.status(400).json({ error: 'Sistem penarikan saat ini dinonaktifkan oleh administrator.' });
    }

    const activeBanks = withdrawConfig.banks?.filter(b => b.isActive) || [];
    const isValidBank = activeBanks.find(b => b.code === bankName || b.name === bankName);
    
    // Fallback allowing any if exact bank list is empty/disabled, otherwise strict check
    if (activeBanks.length > 0 && !isValidBank) {
      return res.status(400).json({ error: 'Bank tujuan tidak mendukung auto-withdraw atau sedang tidak aktif.' });
    }

    // Kurangi saldo
    user.balance -= nominal;
    await user.save();

    let wdStatus = 'pending';
    let wdNotes = '';

    // BUGFIX: Jika provider_type sitranfer, dan rule = 'all', auto-WD menyala berapapun nominalnya untuk menghabiskan poin.
    // Jika rule = 'free', auto-WD hanya berjalan jika nominal <= autoWdLimit.
    let isAutoPgo = false;
    if (withdrawConfig.providerType === 'sitranfer') {
      if (withdrawConfig.rule === 'all') {
        isAutoPgo = true;
      } else {
        isAutoPgo = nominal <= (withdrawConfig.autoWdLimit || 50);
      }
    }

    if (isAutoPgo) {
      try {
        const idrNominal = nominal * 1000;
        const bankTargetCode = isValidBank ? isValidBank.code : bankName;
        const resp = await paymentService.processPayout(user.username || telegramId, accountName, accountNumber, bankTargetCode, idrNominal);
        wdStatus = 'approved';
        wdNotes = `[Auto-WD Sukses] TRX ID: ${resp.transaction_id || 'N/A'}`;
      } catch (e) {
        user.balance += nominal;
        await user.save();
        return res.status(400).json({ error: 'Auto-Withdraw PGO Gagal: ' + e.message });
      }
    }

    const wd = await Withdraw.create({
      userId: user._id,
      telegramId,
      amount: nominal,
      bankName: isValidBank ? isValidBank.code : bankName,
      accountNumber,
      accountName,
      status: wdStatus,
      adminNote: wdNotes,
      processedAt: wdStatus === 'approved' ? new Date() : null
    });

    // NOTIFIKASI TELEGRAM ADMIN JIKA STATUS PENDING (MANUAL)
    console.log('[NOTIFY DEBUG] wdStatus:', wdStatus, '| notifyId:', config.admin?.notificationTelegramId, '| token set:', !!process.env.NOTIFY_BOT_TOKEN);
    if (wdStatus === 'pending' && config.admin?.notificationTelegramId && process.env.NOTIFY_BOT_TOKEN) {
      try {
        const axios = require('axios');
        const message = `🔔 *INFO WITHDRAW MANUAL MUNCUL!*\n\n👤 User: @${user.username || telegramId}\n💰 Jumlah: *${nominal} pt*\n🏦 Bank Tujuan: ${isValidBank ? isValidBank.code : bankName}\n💳 Rekening: ${accountNumber} A/N ${accountName}\n\nSilakan proses di Dashboard Admin!`;
        
        const reply_markup = {
          inline_keyboard: [
            [
              { text: "✅ Terima", callback_data: `wd_approve_${wd._id}` },
              { text: "❌ Tolak", callback_data: `wd_reject_${wd._id}` }
            ]
          ]
        };

        console.log('[NOTIFY DEBUG] Sending to chat_id:', config.admin.notificationTelegramId);
        const response = await axios.post(`https://api.telegram.org/bot${process.env.NOTIFY_BOT_TOKEN}/sendMessage`, { 
          chat_id: config.admin.notificationTelegramId, 
          text: message, 
          parse_mode: 'Markdown',
          reply_markup
        });
        console.log('[NOTIFY DEBUG] Telegram response ok:', response.data.ok);

        wd.notifyMessageId = response.data.result.message_id;
        await wd.save();
      } catch(e) { console.error('[NOTIFY ERROR] Gagal kirim notif admin wd:', e.response?.data || e.message); }
    }

    let msg = 'Permintaan withdraw dikirim dan masuk antrean manual.';
    if (wdStatus === 'approved') msg = 'Pencairan Otomatis (Auto-WD) berhasil dan dana sedang masuk ke rekening Anda!';

    res.json({ message: msg, withdraw: wd });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/miniapp/withdraw-history
router.get('/withdraw-history', async (req, res) => {
  try {
    const { telegramId, initData } = req.query;
    if (!verifyTelegramInitData(initData)) return res.status(403).json({ error: 'Auth failed' });
    if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
    const withdraws = await Withdraw.find({ telegramId }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ withdraws });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
