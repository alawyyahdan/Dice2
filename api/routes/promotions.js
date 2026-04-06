const express = require('express');
const router = express.Router();
const Promotion = require('../models/Promotion');
const requireAdmin = require('../middlewares/authMiddleware');

// GET /api/promotions/active - Public route for MiniApp and DiceCS
router.get('/active', async (req, res) => {
  try {
    const now = new Date();
    // find where isActive is true, and current date is between startDate and endDate
    const promotions = await Promotion.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).sort({ createdAt: -1 });
    res.json({ promotions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/promotions - Admin route to get all
router.get('/', requireAdmin, async (req, res) => {
  try {
    const promotions = await Promotion.find().sort({ createdAt: -1 });
    res.json({ promotions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/promotions - Admin create
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { title, bannerUrl, description, startDate, endDate, isActive } = req.body;
    const newPromo = new Promotion({
      title,
      bannerUrl,
      description,
      startDate,
      endDate,
      isActive: isActive !== undefined ? isActive : true
    });
    const savedPromo = await newPromo.save();
    res.status(201).json({ message: 'Promotion created', promotion: savedPromo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/promotions/:id - Admin edit
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { title, bannerUrl, description, startDate, endDate, isActive } = req.body;
    const updatedPromo = await Promotion.findByIdAndUpdate(
      req.params.id,
      { title, bannerUrl, description, startDate, endDate, isActive, updatedAt: Date.now() },
      { new: true }
    );
    if (!updatedPromo) return res.status(404).json({ error: 'Promotion not found' });
    res.json({ message: 'Promotion updated', promotion: updatedPromo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/promotions/:id - Admin delete
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const deletedPromo = await Promotion.findByIdAndDelete(req.params.id);
    if (!deletedPromo) return res.status(404).json({ error: 'Promotion not found' });
    res.json({ message: 'Promotion deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/promotions/:id/broadcast - Broadcast promosi ke semua user/group
router.post('/:id/broadcast', requireAdmin, async (req, res) => {
  const axios = require('axios');
  const User = require('../models/User');
  const Group = require('../models/Group');
  const Broadcast = require('../models/Broadcast');
  const { getIo } = require('../socket');

  try {
    const promo = await Promotion.findById(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Promosi tidak ditemukan.' });

    const { type = 'users' } = req.body; // 'users' | 'groups' | 'both'
    const token = process.env.CS_BOT_TOKEN || process.env.BOT_TOKEN;

    const rawTargets = [];
    if (type === 'users' || type === 'both') {
      const users = await User.find({ telegramId: { $ne: null } }).select('telegramId username firstName').lean();
      users.forEach(u => rawTargets.push({ chatId: u.telegramId, name: u.username || u.firstName || u.telegramId, kind: 'user' }));
    }
    if (type === 'groups' || type === 'both') {
      const groups = await Group.find({ isActive: true }).select('chatId title').lean();
      groups.forEach(g => rawTargets.push({ chatId: g.chatId, name: g.title || g.chatId, kind: 'group' }));
    }

    // Deduplicate
    const targets = [];
    const seen = new Set();
    for (const t of rawTargets) {
      const id = String(t.chatId);
      if (!seen.has(id)) { seen.add(id); targets.push(t); }
    }

    if (targets.length === 0) return res.status(400).json({ error: 'Tidak ada target yang ditemukan.' });

    // Buat message teks dari detail promosi
    const promoText = `🎉 <b>${promo.title}</b>\n\n${promo.description.replace(/<[^>]*>/g, '')}\n\n⏰ Berlaku: ${new Date(promo.startDate).toLocaleDateString('id-ID')} - ${new Date(promo.endDate).toLocaleDateString('id-ID')}`;

    const broadcast = await Broadcast.create({
      type,
      message: `[PROMOSI] ${promo.title}`,
      targetCount: targets.length,
      imageFileId: promo.bannerUrl ? 'url' : null,
      status: 'sending'
    });

    // Langsung balas client
    res.json({ message: 'Broadcast promosi dimulai', broadcast });

    // Background process
    const delay = ms => new Promise(r => setTimeout(r, ms));
    let sentCount = 0, failedCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const { chatId } = targets[i];
      try {
        if (promo.bannerUrl) {
          await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, {
            chat_id: chatId,
            photo: promo.bannerUrl,
            caption: promoText,
            parse_mode: 'HTML'
          });
        } else {
          await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text: promoText,
            parse_mode: 'HTML'
          });
        }
        sentCount++;
      } catch (e) { failedCount++; }

      if (i % 20 === 0 && i !== 0) await delay(1000);
    }

    broadcast.status = 'done';
    broadcast.sentCount = sentCount;
    broadcast.failedCount = failedCount;
    broadcast.completedAt = new Date();
    await broadcast.save();

    try { getIo().to('admins').emit('broadcast_progress', { id: broadcast._id, status: 'done', sentCount, failedCount, targetCount: targets.length, failedDetails: [] }); } catch(e) {}

  } catch (err) {
    console.error('[PromoBroadcast]', err.message);
  }
});

// POST /api/promotions/:id/post-channel - Kirim ke Channel & Catat di ChannelPost
router.post('/:id/post-channel', requireAdmin, async (req, res) => {
  const axios = require('axios');
  const Setting = require('../models/Setting');
  const ChannelPost = require('../models/ChannelPost');

  try {
    const promo = await Promotion.findById(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Promosi tidak ditemukan.' });

    const token = process.env.CS_BOT_TOKEN;
    if (!token) return res.status(400).json({ error: 'CS_BOT_TOKEN belum diatur.' });

    const cfg = await Setting.findOne();
    let channelId = cfg?.forceSub?.channelUsername?.trim() || '';
    if (channelId && !channelId.startsWith('@') && !channelId.startsWith('-100') && isNaN(channelId)) channelId = '@' + channelId;
    if (!channelId) return res.status(400).json({ error: 'Target Channel belum diatur di Settings.' });

    const promoText = `🎉 <b>${promo.title}</b>\n\n${promo.description.replace(/<[^>]*>/g, '')}\n\n⏰ Berlaku: ${new Date(promo.startDate).toLocaleDateString('id-ID')} - ${new Date(promo.endDate).toLocaleDateString('id-ID')}`;

    let messageId = null;
    let finalFileId = null;

    if (promo.bannerUrl) {
      const resp = await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, {
        chat_id: channelId,
        photo: promo.bannerUrl,
        caption: promoText,
        parse_mode: 'HTML'
      });
      if (resp.data.ok) {
        messageId = resp.data.result.message_id;
        const photos = resp.data.result.photo;
        finalFileId = photos ? photos[photos.length - 1].file_id : null;
      } else throw new Error('Telegram API Error');
    } else {
      const resp = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: channelId,
        text: promoText,
        parse_mode: 'HTML'
      });
      if (resp.data.ok) messageId = resp.data.result.message_id;
      else throw new Error('Telegram API Error');
    }

    const post = await ChannelPost.create({
      channelId,
      messageId,
      content: `[PROMOSI] ${promo.title}\n\n${promoText}`,
      imageFileId: finalFileId
    });

    res.json({ message: 'Berhasil diposting ke channel!', post });

  } catch (err) {
    const rawErr = err?.response?.data?.description || err.message || '';
    res.status(500).json({ error: 'Error: ' + rawErr });
  }
});

module.exports = router;
