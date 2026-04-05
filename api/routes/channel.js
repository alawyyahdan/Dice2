const express = require('express');
const router = express.Router();
const ChannelPost = require('../models/ChannelPost');
const Setting = require('../models/Setting');
const upload = require('../middlewares/upload');
const auth = require('../middlewares/authMiddleware');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const getCSBotToken = () => process.env.CS_BOT_TOKEN;

const toHtml = (t) => {
  if (!t) return '';
  return t
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/~~(.*?)~~/g, '<s>$1</s>')
    .replace(/_(.*?)_/g, '<i>$1</i>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
};

// Helper to get channel ID from Settings
async function getChannelId() {
  const cfg = await Setting.findOne();
  let ch = cfg?.forceSub?.channelUsername || '';
  ch = ch.trim();
  if (ch && !ch.startsWith('@') && !ch.startsWith('-100')) {
    if (isNaN(ch)) ch = '@' + ch;
  }
  return ch;
}

// 1. Dapatkan semua post channel dari DB
router.get('/posts', auth, async (req, res) => {
  try {
    const posts = await ChannelPost.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Dapatkan Channel target saat ini
router.get('/target', auth, async (req, res) => {
  try {
    const channelId = await getChannelId();
    res.json({ channelId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Send Post
router.post('/send', [auth, upload.single('image')], async (req, res) => {
  const token = getCSBotToken();
  if (!token) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch(e){}
    return res.status(400).json({ error: 'CS_BOT_TOKEN belum diatur di server.' });
  }

  try {
    const channelId = await getChannelId();
    if (!channelId) {
       if (req.file) try { fs.unlinkSync(req.file.path); } catch(e){}
       return res.status(400).json({ error: 'Username/ID Channel belum diatur di menu Setting.' });
    }

    const { content } = req.body;
    if (!content && !req.file) {
      if (req.file) try { fs.unlinkSync(req.file.path); } catch(e){}
      return res.status(400).json({ error: 'Pesan atau gambar tidak boleh kosong.' });
    }

    let messageId = null;
    let finalFileId = null;

    if (req.file) {
      const formData = new FormData();
      formData.append('chat_id', channelId);
      if (content) formData.append('caption', toHtml(content));
      formData.append('parse_mode', 'HTML');
      formData.append('photo', fs.createReadStream(req.file.path));

      const resp = await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, formData, { headers: formData.getHeaders() });
      if (resp.data.ok) {
        messageId = resp.data.result.message_id;
        finalFileId = resp.data.result.photo[resp.data.result.photo.length - 1].file_id;
      } else {
        throw new Error('Telegram API Error');
      }
    } else {
      const resp = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: channelId,
        text: toHtml(content),
        parse_mode: 'HTML'
      });
      if (resp.data.ok) {
        messageId = resp.data.result.message_id;
      } else {
        throw new Error('Telegram API Error');
      }
    }

    const newPost = await ChannelPost.create({
      channelId,
      messageId,
      content: content || '',
      imageFileId: finalFileId
    });

    if (req.file) try { fs.unlinkSync(req.file.path); } catch(e){}
    res.json({ message: 'Post berhasil', post: newPost });

  } catch (err) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch(e){}
    const rawErr = err?.response?.data?.description || err.message || '';
    res.status(500).json({ error: 'Telegram Error: ' + rawErr });
  }
});

// 4. Edit Post (Cuma text, Telegram gak support ganti media secara mudah tanpa multipart complex)
router.put('/edit/:id', auth, async (req, res) => {
  const token = getCSBotToken();
  if (!token) return res.status(400).json({ error: 'CS_BOT_TOKEN belum diatur.' });

  try {
    const post = await ChannelPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post tidak ditemukan di database.' });

    const { content } = req.body;
    let success = false;

    try {
      if (post.imageFileId) {
        await axios.post(`https://api.telegram.org/bot${token}/editMessageCaption`, {
          chat_id: post.channelId,
          message_id: post.messageId,
          caption: toHtml(content),
          parse_mode: 'HTML'
        });
      } else {
        await axios.post(`https://api.telegram.org/bot${token}/editMessageText`, {
          chat_id: post.channelId,
          message_id: post.messageId,
          text: toHtml(content),
          parse_mode: 'HTML'
        });
      }
      success = true;
    } catch(err) {
      const raw = err?.response?.data?.description || '';
      if(raw.includes('message is not modified')) {
         success = true; // Anggap sukses kalau gada yang diubah
      } else {
         throw err;
      }
    }

    if (success) {
      post.content = content || '';
      post.updatedAt = new Date();
      await post.save();
      res.json({ message: 'Post updated', post });
    }

  } catch (err) {
    const rawErr = err?.response?.data?.description || err.message || '';
    res.status(500).json({ error: 'Telegram Error: ' + rawErr });
  }
});

// 5. Delete Post
router.delete('/delete/:id', auth, async (req, res) => {
  const token = getCSBotToken();
  if (!token) return res.status(400).json({ error: 'CS_BOT_TOKEN belum diatur.' });

  try {
    const post = await ChannelPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post tidak ditemukan di database.' });

    try {
      await axios.post(`https://api.telegram.org/bot${token}/deleteMessage`, {
        chat_id: post.channelId,
        message_id: post.messageId
      });
    } catch(err) {
      // Hiraukan error jika pesan memang sudah tidak ada di telegram
      const raw = err?.response?.data?.description || '';
      if(!raw.includes('message to delete not found')) {
         console.warn('[ChannelManagement] Error deleteMessage from Telegram:', raw);
      }
    }

    await ChannelPost.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
