const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const Deposit = require('../models/Deposit');

// Helper verifikasi Telegram miniapp
function verifyTelegramInitData(initData) {
  if (process.env.DEBUG === 'true' && initData === 'mock-debug-init-data') return true;
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
  } catch { return false; }
}

// 1. POST /api/deposit/create - Dari MiniApp
router.post('/create', async (req, res) => {
  try {
    const { initData, telegramId, amount, paymentMethod } = req.body;
    
    if (!verifyTelegramInitData(initData)) {
      return res.status(403).json({ error: 'Invalid Telegram data' });
    }

    if (!amount || amount < 10) return res.status(400).json({ error: 'Minimal deposit 10 poin' });
    if (!paymentMethod) return res.status(400).json({ error: 'Metode pembayaran wajib dipilih' });

    const user = await User.findOne({ telegramId });
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

    // Buat Reference ID unik (Skeleton)
    const referenceId = `DEP-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    
    // MOCK: Generate Checkout URL (Nanti diganti dengan Tripay / Gateway Asli)
    const checkoutUrl = `https://mock-payment-gateway.com/checkout/${referenceId}?amount=${amount}&method=${paymentMethod}`;

    const deposit = await Deposit.create({
      userId: user._id,
      telegramId,
      amount,
      paymentMethod,
      referenceId,
      checkoutUrl,
      status: 'pending'
    });

    res.json({ message: 'Tagihan dibuat', data: deposit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET /api/deposit/history?telegramId=xxx - Histori Khusus Player (MiniApp)
router.get('/history', async (req, res) => {
  try {
    const { telegramId } = req.query;
    if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

    const deposits = await Deposit.find({ telegramId }).sort({ createdAt: -1 }).limit(20).lean();
    res.json({ deposits });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GET /api/deposit/all - Global Admin Histori (Dashboard Admin)
router.get('/all', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    
    let query = {};
    if (search) query.telegramId = { $regex: search, $options: 'i' };

    const deposits = await Deposit.find(query)
      .populate('userId', 'firstName username')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    
    const total = await Deposit.countDocuments(query);
    res.json({ deposits, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. POST /api/deposit/callback - Webhook dari Payment Gateway
router.post('/callback', async (req, res) => {
  try {
    // Skenario Tripay/Paydisini Callback
    const { referenceId, status } = req.body;
    
    const dep = await Deposit.findOne({ referenceId });
    if (!dep) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
    if (dep.status === 'success') return res.status(200).json({ message: 'Sudah sukses sebelumnya' });

    dep.status = status; // success, failed, expired
    dep.updatedAt = Date.now();
    await dep.save();

    if (status === 'success') {
      const nominal = dep.amount;
      await User.findByIdAndUpdate(
        dep.userId,
        {
          $inc: { balance: nominal, totalDeposit: nominal },
          $set: { turnover: 0, turnoverRequired: nominal * 2 }
        }
      );
    }
    
    res.json({ success: true, message: 'Callback diterima' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
