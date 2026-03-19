const express = require('express');
const router = express.Router();
const axios = require('axios');
const Withdraw = require('../models/Withdraw');
const User = require('../models/User');
const auth = require('../middlewares/authMiddleware');

// GET /api/withdraw?status=pending&page=1
router.get('/', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;

    const total = await Withdraw.countDocuments(query);
    const requests = await Withdraw.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('userId', 'username firstName');

    res.json({ requests, total, page: Number(page) });
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

    wd.status = 'approved';
    wd.adminNote = req.body.adminNote || '';
    wd.processedAt = new Date();
    await wd.save();

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
    wd.adminNote = req.body.adminNote || '';
    wd.processedAt = new Date();
    await wd.save();

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
