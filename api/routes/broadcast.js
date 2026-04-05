const express = require('express');
const router = express.Router();
const Broadcast = require('../models/Broadcast');
const User = require('../models/User');
const Group = require('../models/Group');
const upload = require('../middlewares/upload');
const auth = require('../middlewares/authMiddleware');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { getIo } = require('../socket');

const toHtml = (t) => {
  if (!t) return '';
  return t
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/~~(.*?)~~/g, '<s>$1</s>')
    .replace(/_(.*?)_/g, '<i>$1</i>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
};

router.get('/', auth, async (req, res) => {
  try {
    const broadcasts = await Broadcast.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json(broadcasts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/send', [auth, upload.single('image')], async (req, res) => {
  try {
    const { type, message } = req.body;
    
    const rawTargets = []; // [{ chatId, name, kind }]
    
    if (type === 'users' || type === 'both') {
      const users = await User.find({ telegramId: { $ne: null } }).select('telegramId username firstName').lean();
      users.forEach(u => rawTargets.push({
        chatId: u.telegramId,
        name: u.username ? `@${u.username}` : (u.firstName || `UID:${u.telegramId}`),
        kind: 'user'
      }));
    }
    if (type === 'groups' || type === 'both') {
      const groups = await Group.find({ isActive: true }).select('chatId title').lean();
      groups.forEach(g => rawTargets.push({
        chatId: g.chatId,
        name: g.title || `GID:${g.chatId}`,
        kind: 'group'
      }));
    }

    // Deduplicate targets by chatId
    const targets = [];
    const seenChats = new Set();
    for (const t of rawTargets) {
      const id = String(t.chatId);
      if (!seenChats.has(id)) {
        seenChats.add(id);
        targets.push(t);
      }
    }

    if (targets.length === 0) {
      if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(400).json({ error: 'Tidak ada target user/group yang ditemukan.' });
    }

    const broadcast = await Broadcast.create({
      type,
      message,
      targetCount: targets.length,
      imageFileId: req.file ? 'pending' : null,
      status: 'sending'
    });

    // Langsung balas client, proses lanjut di background
    res.json({ message: 'Broadcast dimulai', broadcast });

    // ===== BACKGROUND PROCESS =====
    const token = process.env.CS_BOT_TOKEN || process.env.BOT_TOKEN;
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    
    let sentCount = 0;
    let failedCount = 0;
    const failedDetails = []; // [{ chatId, name, reason }]
    let finalFileId = null;

    // Translate Telegram error ke bahasa manusia
    function cleanReason(errMsg) {
      if (!errMsg) return 'Unknown error';
      if (errMsg.includes('bot was blocked by the user')) return 'Bot diblokir oleh user';
      if (errMsg.includes('bot was kicked')) return 'Bot ditendang dari grup';
      if (errMsg.includes('chat not found')) return 'Chat tidak ditemukan';
      if (errMsg.includes('user is deactivated')) return 'Akun user dihapus/banned Telegram';
      if (errMsg.includes('Forbidden')) return 'Akses ditolak (Forbidden)';
      if (errMsg.includes('Too Many Requests')) return 'Rate limit Telegram';
      if (errMsg.includes('PEER_ID_INVALID')) return 'ID chat tidak valid';
      return errMsg.slice(0, 100);
    }

    for (let i = 0; i < targets.length; i++) {
      const { chatId, name } = targets[i];
      
      try {
        if (req.file && !finalFileId) {
          // First send via FormData → dapat file_id untuk dipakai ulang
          const formData = new FormData();
          formData.append('chat_id', chatId);
          if (message) formData.append('caption', toHtml(message));
          formData.append('parse_mode', 'HTML');
          formData.append('photo', fs.createReadStream(req.file.path));

          const resp = await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, formData, { headers: formData.getHeaders() });
          finalFileId = resp.data.result.photo[resp.data.result.photo.length - 1].file_id;
          sentCount++;
        } else if (req.file && finalFileId) {
          await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, {
            chat_id: chatId,
            photo: finalFileId,
            caption: toHtml(message) || '',
            parse_mode: 'HTML'
          });
          sentCount++;
        } else {
          await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text: toHtml(message),
            parse_mode: 'HTML'
          });
          sentCount++;
        }
      } catch (err) {
        failedCount++;
        const rawErr = err?.response?.data?.description || err.message || '';
        const reason = cleanReason(rawErr);
        failedDetails.push({ chatId, name, reason });

        // Auto-hapus dari DB kalau errornya permanen (bukan rate limit / server error sementara)
        const isPermanentError = (
          rawErr.includes('chat not found') ||
          rawErr.includes('bot was kicked') ||
          rawErr.includes('bot was blocked by the user') ||
          rawErr.includes('user is deactivated') ||
          rawErr.includes('Forbidden') ||
          rawErr.includes('PEER_ID_INVALID') ||
          rawErr.includes('CHAT_ID_INVALID')
        );

        if (isPermanentError) {
          const { kind } = targets[i]; // 'user' atau 'group'
          if (kind === 'group') {
            Group.deleteOne({ chatId: String(chatId) }).catch(() => {});
          } else {
            // User udah ga ada / block bot → hapus dari DB biar target makin bersih
            User.deleteOne({ telegramId: String(chatId) }).catch(() => {});
          }
          console.log(`[Broadcast] Auto-cleanup (${kind}): ${name} (${chatId}) - ${reason}`);
        }
      }

      // Emit progress setiap 10 pesan
      if (i % 10 === 0 || i === targets.length - 1) {
        try {
          getIo().to('admins').emit('broadcast_progress', {
            id: broadcast._id,
            sentCount,
            failedCount,
            targetCount: broadcast.targetCount,
            // Kirim 20 kegagalan terakhir saja biar socket payload nggak besar-besar
            failedDetails: failedDetails.slice(-20)
          });
        } catch (e) {}
      }

      // Rate limit: maks ~20/detik biar nggak kena flood wait
      if (i % 20 === 0 && i !== 0) await delay(1000);
    }

    // Simpan state final ke DB
    broadcast.status = 'done';
    broadcast.sentCount = sentCount;
    broadcast.failedCount = failedCount;
    broadcast.failedDetails = failedDetails;
    broadcast.completedAt = new Date();
    if (finalFileId) broadcast.imageFileId = finalFileId;
    await broadcast.save();

    if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) {} }
    
    // Final emit: status done + semua failedDetails
    try {
      getIo().to('admins').emit('broadcast_progress', {
        id: broadcast._id,
        status: 'done',
        sentCount,
        failedCount,
        targetCount: broadcast.targetCount,
        failedDetails
      });
    } catch (e) {}

  } catch (err) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {}
    console.error('[Broadcast]', err.message);
    // res.json sudah dipanggil jadi jangan panggil lagi - hanya log
  }
});

module.exports = router;
