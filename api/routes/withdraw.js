const express = require('express');
const router = express.Router();
const axios = require('axios');
const Withdraw = require('../models/Withdraw');
const User = require('../models/User');
const Setting = require('../models/Setting');
const paymentService = require('../services/paymentService');
const auth = require('../middlewares/authMiddleware');

// GET /api/withdraw
router.get('/', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search, dateFrom, dateTo } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (search) query.telegramId = { $regex: search, $options: 'i' };
    
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const d = new Date(dateTo);
        d.setHours(23, 59, 59, 999);
        query.createdAt.$lte = d;
      }
    }

    const total = await Withdraw.countDocuments(query);
    const requests = await Withdraw.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('userId', 'username firstName');

    const totalApproved = await Withdraw.countDocuments({ status: 'approved' });
    const totalPending = await Withdraw.countDocuments({ status: 'pending' });
    const totalRejected = await Withdraw.countDocuments({ status: 'rejected' });

    let config = await Setting.findOne();
    const providerType = config?.paymentGateway?.withdraw?.providerType || 'none';

    res.json({ 
      requests, 
      total, 
      page: Number(page),
      stats: { totalApproved, totalPending, totalRejected },
      providerType
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/withdraw/:id/approve
router.patch('/:id/approve', auth, async (req, res) => {
  try {
    const wd = await Withdraw.findById(req.params.id);
    if (!wd) return res.status(404).json({ error: 'Not found' });
    if (wd.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

    wd.adminNote = req.body.adminNote || '';

    // Trigger SiTranfer Payout if System uses SiTranfer explicitly
    let config = await Setting.findOne();
    const withdrawConfig = config?.paymentGateway?.withdraw || {};

    if (withdrawConfig.providerType === 'sitranfer') {
      try {
        const idrNominal = wd.amount * 1000;
        const userForWd = await User.findById(wd.userId);
        const usernameId = userForWd?.username || wd.telegramId;
        
        const resp = await paymentService.processPayout(
           usernameId, 
           wd.accountName, 
           wd.accountNumber, 
           wd.bankName, 
           idrNominal
        );
        wd.adminNote = wd.adminNote ? (wd.adminNote + ` | [Auto-WD] TRX: ${resp.transaction_id || 'OK'}`) : `[Auto-WD] TRX: ${resp.transaction_id || 'OK'}`;
      } catch (pgError) {
        return res.status(400).json({ error: 'Gateway Gagal: ' + pgError.message + ' (Transaksi ini tetap Pending dan saldo belum dipotong. Silakan coba lagi.)' });
      }
    }

    // Success -> Mutasi ke DB
    wd.status = 'approved';
    wd.processedAt = new Date();
    await wd.save();

    // SINKRONISASI TELEGRAM NOTIFIKASI
    if (wd.notifyMessageId) {
      const config = await Setting.findOne();
      if (config.admin && config.admin.notificationTelegramId && process.env.NOTIFY_BOT_TOKEN) {
        try {
          const axios = require('axios');
          await axios.post(`https://api.telegram.org/bot${process.env.NOTIFY_BOT_TOKEN}/editMessageText`, {
            chat_id: config.admin.notificationTelegramId,
            message_id: wd.notifyMessageId,
            text: `🔔 *INFO WITHDRAW MANUAL*\n\n👤 User: @${wd.telegramId}\n💰 Jumlah: *${wd.amount} pt*\n\n✅ *STATUS: DITERIMA*\nAlasan: Diproses via Admin Dashboard`,
            parse_mode: 'Markdown'
          });
        } catch(e) { console.error('Gagal sync notif admin wd:', e.message); }
      }
    }

    // Kurangi saldo user
    await User.findOneAndUpdate(
      { telegramId: wd.telegramId },
      { $inc: { balance: -wd.amount } }
    );

    // Kirim notif ke user via Telegram Bot API
    await notifyUser(wd.telegramId, `✅ Permintaan withdraw ${wd.amount} poin kamu telah *DISETUJUI*!\n\nBank: ${wd.bankName}\nRekening: ${wd.accountNumber}\nAtas Nama: ${wd.accountName}`);

    res.json({ message: 'Approved', withdraw: wd });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/withdraw/:id/reject
router.patch('/:id/reject', auth, async (req, res) => {
  try {
    const wd = await Withdraw.findById(req.params.id);
    if (!wd) return res.status(404).json({ error: 'Not found' });
    if (wd.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

    wd.status = 'rejected';
    wd.adminNote = req.body.adminNote || 'Ditolak via Dashboard';
    wd.processedAt = new Date();
    await wd.save();

    // SINKRONISASI TELEGRAM NOTIFIKASI
    if (wd.notifyMessageId) {
      const config = await Setting.findOne();
      if (config.admin && config.admin.notificationTelegramId && process.env.NOTIFY_BOT_TOKEN) {
        try {
          const axios = require('axios');
          await axios.post(`https://api.telegram.org/bot${process.env.NOTIFY_BOT_TOKEN}/editMessageText`, {
            chat_id: config.admin.notificationTelegramId,
            message_id: wd.notifyMessageId,
            text: `🔔 *INFO WITHDRAW MANUAL*\n\n👤 User: @${wd.telegramId}\n💰 Jumlah: *${wd.amount} pt*\n\n❌ *STATUS: DITOLAK*\nAlasan: ${wd.adminNote}`,
            parse_mode: 'Markdown'
          });
        } catch(e) { console.error('Gagal sync notif admin wd reject:', e.message); }
      }
    }

    // Kembalikan saldo user
    await User.findOneAndUpdate(
      { telegramId: wd.telegramId },
      { $inc: { balance: wd.amount } }
    );

    // Kirim notif ke user via Telegram Bot API
    await notifyUser(wd.telegramId, `❌ Permintaan withdraw ${wd.amount} poin kamu *DITOLAK*.\n\nAlasan: ${wd.adminNote}\n\nSaldo kamu telah dikembalikan.`);

    res.json({ message: 'Rejected', withdraw: wd });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function notifyUser(telegramId, text) {
  try {
    await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
      chat_id: telegramId,
      text,
      parse_mode: 'Markdown'
    });
  } catch (e) {
    console.error('Failed to notify user:', e.message);
  }
}

module.exports = router;
