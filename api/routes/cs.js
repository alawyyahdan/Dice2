const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Message = require('../models/Message');
const User = require('../models/User');
const upload = require('../middlewares/upload');
const { getIo } = require('../socket');
const auth = require('../middlewares/authMiddleware'); // Admin Only route
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const { toHtml: _toHtml } = require('../utils/toHtml');
const toHtml = (t) => _toHtml(t, { convertNewlines: true });

// 1. Ambil list tiket
router.get('/tickets', auth, async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    const query = {};
    if (status !== 'all') query.status = status;
    
    const tickets = await Ticket.find(query).sort({ lastMessageAt: -1 }).lean();
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Ambil messages untuk satu tiket
router.get('/tickets/:id/messages', auth, async (req, res) => {
  try {
    const messages = await Message.find({ ticketId: req.params.id }).sort({ createdAt: 1 }).lean();
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Admin membalas tiket (Text otomatis, fitur file ada di bawah)
router.post('/tickets/:id/reply', auth, async (req, res) => {
  try {
    const { text } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    
    if (ticket.status === 'closed') return res.status(400).json({ error: 'Ticket sudah ditutup.' });

    // Simpan pesan
    const msg = await Message.create({
      ticketId: ticket._id,
      senderId: 'admin',
      senderModel: 'Admin',
      type: 'text',
      content: text
    });

    ticket.lastMessageAt = new Date();
    await ticket.save();

    // Broadcast Socket
    getIo().to('admins').emit('new_message', { ticketId: ticket._id, message: msg });

    // Kirim via Telegram API (menggunakan CS_BOT_TOKEN)
    const token = process.env.CS_BOT_TOKEN || process.env.BOT_TOKEN;
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: ticket.telegramId,
      text: toHtml(text).replace(/<br\/>/g, '\n'), // Telegram pakai \n bukan <br/>
      parse_mode: 'HTML'
    });

    res.json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Admin kirim gambar
router.post('/tickets/:id/reply/image', [auth, upload.single('image')], async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!req.file) return res.status(400).json({ error: 'No image provided' });

    const token = process.env.CS_BOT_TOKEN || process.env.BOT_TOKEN;
    const formData = new FormData();
    formData.append('chat_id', ticket.telegramId);
    if (req.body.caption) formData.append('caption', toHtml(req.body.caption).replace(/<br\/>/g, '\n'));
    formData.append('parse_mode', 'HTML');
    formData.append('photo', fs.createReadStream(req.file.path));

    // Send to telegram
    const response = await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, formData, {
      headers: formData.getHeaders()
    });

    // Sesudah sukses dikirim, hapus filenya lokal
    try { fs.unlinkSync(req.file.path); } catch (e) {}

    const fileId = response.data.result.photo[response.data.result.photo.length - 1].file_id;

    const msg = await Message.create({
      ticketId: ticket._id,
      senderId: 'admin',
      senderModel: 'Admin',
      type: 'image',
      content: req.body.caption || '',
      imageFileId: fileId
    });

    ticket.lastMessageAt = new Date();
    await ticket.save();
    getIo().to('admins').emit('new_message', { ticketId: ticket._id, message: msg });

    res.json(msg);
  } catch (err) {
    console.error(err);
    if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {}
    res.status(500).json({ error: err.message });
  }
});

// 5. Tutup tiket
router.post('/tickets/:id/close', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    
    ticket.status = 'closed';
    ticket.closedAt = new Date();
    await ticket.save();

    getIo().to('admins').emit('ticket_closed', { ticketId: ticket._id });

    const token = process.env.CS_BOT_TOKEN || process.env.BOT_TOKEN;
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: ticket.telegramId,
      text: `✅ Keluhan #${ticket.referenceId} telah diselesaikan.\nTerima kasih telah menghubungi kami!`,
      parse_mode: 'HTML'
    }).catch(e => {});

    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// INTERNAL ROUTE: Dipanggil oleh Bot Engine untuk memancing websocket (no auth dlu, block ke local aja)
router.post('/internal/notify_ticket', async (req, res) => {
  try {
    const { event, data } = req.body;
    console.log(`[InternalNotify] Received event: ${event}`);
    getIo().to('admins').emit(event, data);
    res.json({ success: true });
  } catch(e) {
    console.error('[InternalNotify] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PROXY: Serve gambar Telegram by file_id — NO AUTH supaya <img src> browser bisa load
router.get('/telegram-image/:fileId', async (req, res) => {
  try {
    const token = process.env.CS_BOT_TOKEN || process.env.BOT_TOKEN;
    const { fileId } = req.params;
    
    // Step 1: getFile untuk dapat path
    const fileRes = await axios.get(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    
    if (!fileRes.data?.ok || !fileRes.data?.result?.file_path) {
      console.error('[ImageProxy] Telegram getFile failed:', fileRes.data);
      return res.status(404).json({ error: 'Telegram file not found' });
    }

    const filePath = fileRes.data.result.file_path;
    
    // Step 2: stream file ke browser
    const imageRes = await axios.get(`https://api.telegram.org/file/bot${token}/${filePath}`, {
      responseType: 'stream'
    });
    
    res.setHeader('Content-Type', imageRes.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 1 hari
    imageRes.data.pipe(res);
  } catch (err) {
    console.error('[ImageProxy] critical error:', err.message);
    if (err.response) console.error('[ImageProxy] Telegram responded with:', err.response.data);
    res.status(500).json({ error: 'Internal Image Proxy Error' });
  }
});

module.exports = router;

