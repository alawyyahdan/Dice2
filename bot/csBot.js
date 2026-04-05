const { Telegraf } = require('telegraf');
const axios = require('axios');
const Ticket = require('../api/models/Ticket');
const Message = require('../api/models/Message');

module.exports = function startCsBot() {
  if (!process.env.CS_BOT_TOKEN) {
    console.log('[CSBot] CS_BOT_TOKEN tidak ada, bot Customer Service dinonaktifkan.');
    return;
  }

  const csBot = new Telegraf(process.env.CS_BOT_TOKEN);

  csBot.start((ctx) => {
    ctx.reply('Halo! 👋 Ini adalah layanan Customer Service. Silakan ketikkan detail keluhan, pertanyaan, atau lampirkan screenshot jika diperlukan. Admin kami akan segera merespons secara langsung di sini.');
  });

  // Handler untuk text
  csBot.on('text', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (ctx.message.text.startsWith('/')) return; // Abaikan command

    await processIncomingMessage(ctx, 'text', ctx.message.text);
  });

  // Handler untuk photo
  csBot.on('photo', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const photoArray = ctx.message.photo;
    const largestPhoto = photoArray[photoArray.length - 1]; // Resolusi tertinggi
    const caption = ctx.message.caption || '';
    
    await processIncomingMessage(ctx, 'image', caption, largestPhoto.file_id);
  });

  async function processIncomingMessage(ctx, type, content, imageFileId = null) {
      const telegramId = String(ctx.from.id);
      
      // Cari tiket paling baru
      let ticket = await Ticket.findOne({ telegramId }).sort({ createdAt: -1 });
      let isNewTicket = false;

      if (!ticket) {
        // Benar-benar user baru (belum pernah ada tiket)
        isNewTicket = true;
        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
        const count = await Ticket.countDocuments({ referenceId: new RegExp(`^TKT-${dateStr}`) });
        const seq = String(count + 1).padStart(4, '0');
        const referenceId = `TKT-${dateStr}-${seq}`;

        ticket = await Ticket.create({
          referenceId,
          telegramId,
          username: ctx.from.username || '',
          firstName: ctx.from.first_name || '',
          status: 'open',
          lastMessageAt: new Date()
        });
        
        ctx.reply(`✅ Keluhan kamu telah kami terima!\n📋 Nomor Referensi: ${referenceId}\n⏳ Tim kami akan segera merespons.`, { parse_mode: 'Markdown' });
      } else if (ticket.status === 'closed') {
        // REOPEN: Jika tiket terakhir sudah closed, buka kembali (status jadi open)
        ticket.status = 'open';
        ticket.lastMessageAt = new Date();
        await ticket.save();
        
        ctx.reply(`🔄 Tiket bantuan kamu #${ticket.referenceId} telah dibuka kembali. Silakan sampaikan keluhan Anda.`, { parse_mode: 'Markdown' });
      } else {
        // Tiket masih open, update waktu saja
        ticket.lastMessageAt = new Date();
        await ticket.save();
      }

      // Create message
      const msg = await Message.create({
        ticketId: ticket._id,
        senderId: telegramId,
        senderModel: 'User',
        type,
        content,
        imageFileId
      });

      // Notifikasi Admin via Teleram (Jika ada Admin terdaftar)
      try {
        const settingsService = require('../api/services/settingsService');
        const settings = settingsService.getSettings();
        const notificationTelegramId = settings?.admin?.notificationTelegramId;
        
        if (notificationTelegramId) {
          const mainBotToken = process.env.BOT_TOKEN;
          // Kirim lewat api main bot
          const msgText = type === 'image' ? `[📷 Gambar] ${content || ''}` : content;
          await axios.post(`https://api.telegram.org/bot${mainBotToken}/sendMessage`, {
            chat_id: notificationTelegramId,
            text: `🔔 *Tiket Baru Diterima!*\n\n📋 Ref: \`${ticket.referenceId}\`\n👤 User: ${ticket.firstName || ticket.username || 'Pemain'}\n🆔 ID: \`${telegramId}\`\n💬 Pesan: ${msgText}`,
            parse_mode: 'Markdown'
          });
        }
      } catch (e) {
        // Abaikan notif telegram error
      }

      // Internal ping ke Server API Socket.io buat memancarkan notifikasi realtime ke Dashboard Admin
      try {
        const port = process.env.API_PORT || 3001;
        await axios.post(`http://localhost:${port}/api/cs/internal/notify_ticket`, {
          event: isNewTicket ? 'new_ticket' : 'new_message',
          data: isNewTicket ? { ticket, message: msg } : { ticketId: ticket._id, message: msg }
        });
      } catch (err) {
        console.error('[CSBot] Internal Notification Failed:', err.message);
      }
  }

  csBot.launch()
    .then(() => console.log('🎧 CSBot started successfully!'))
    .catch(e => console.error('[CSBot] Launch error:', e.message));

  process.once('SIGINT', () => csBot.stop('SIGINT'));
  process.once('SIGTERM', () => csBot.stop('SIGTERM'));
}
