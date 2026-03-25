const { Telegraf } = require('telegraf');
const Deposit = require('../api/models/Deposit');
const Withdraw = require('../api/models/Withdraw');
const User = require('../api/models/User');
const axios = require('axios');

// In-memory map: promptMessageId -> { type, recordId, originalMsgId, chatId, originalText }
const pendingRejects = new Map();

module.exports = function startNotifyBot(mainBotToken) {
  if (!process.env.NOTIFY_BOT_TOKEN) {
    console.log('[NotifyBot] NOTIFY_BOT_TOKEN tidak ada, bot notif dinonaktifkan.');
    return;
  }

  const notifyBot = new Telegraf(process.env.NOTIFY_BOT_TOKEN);

  // Kirim pesan ke user via bot utama
  const notifyUser = async (telegramId, text) => {
    try {
      await axios.post(`https://api.telegram.org/bot${mainBotToken}/sendMessage`, {
        chat_id: telegramId, text, parse_mode: 'HTML'
      });
    } catch (e) { console.error('[NotifyBot] notifyUser error:', e.message); }
  };

  // Edit pesan notif admin (hapus tombol, tampilkan status)
  const editNotif = async (chatId, msgId, newText) => {
    try {
      await notifyBot.telegram.editMessageText(chatId, msgId, undefined, newText, { parse_mode: 'Markdown' });
    } catch (e) { console.error('[NotifyBot] editNotif error:', e.message); }
  };

  // ===================== DEPOSIT APPROVE =====================
  notifyBot.action(/^depo_approve_(.+)$/, async (ctx) => {
    try {
      const id = ctx.match[1];
      const depo = await Deposit.findById(id);
      if (!depo) return ctx.answerCbQuery('❌ Data deposit tidak ditemukan!');
      if (depo.status !== 'pending') return ctx.answerCbQuery(`⚠️ Sudah diproses (${depo.status})`);

      // FIX: Deposit enum = 'success', bukan 'approved'
      depo.status = 'success';
      depo.adminNote = 'Diterima via Telegram Admin';
      depo.processedAt = new Date();
      depo.updatedAt = Date.now();
      await depo.save();

      // Tambah saldo + turnover
      const nominal = depo.amount;
      const topupTotal = nominal + (depo.bonusApplied || 0);
      const finalTOInc = depo.promoId ? (depo.turnoverApplied || 0) : nominal;

      await User.findByIdAndUpdate(depo.userId, {
        $inc: { balance: topupTotal, totalDeposit: nominal, turnoverRequired: finalTOInc }
      });

      // Notif user
      await notifyUser(depo.telegramId, `✅ <b>Deposit Berhasil!</b>\n\nNominal: <b>${depo.amount} poin</b> telah masuk ke saldo kamu. Selamat bermain! 🎲`);

      // Edit pesan notif admin
      const origText = ctx.callbackQuery.message.text;
      await editNotif(ctx.chat.id, ctx.callbackQuery.message.message_id,
        origText + '\n\n✅ *STATUS: DITERIMA*\nAdmin: Deposit dikonfirmasi ✔'
      );

      await ctx.answerCbQuery('✅ Deposit berhasil diterima!');
    } catch (e) {
      console.error('[NotifyBot] depo_approve error:', e.message);
      await ctx.answerCbQuery('❌ Error: ' + e.message);
    }
  });

  // ===================== DEPOSIT REJECT =====================
  notifyBot.action(/^depo_reject_(.+)$/, async (ctx) => {
    try {
      const id = ctx.match[1];
      const depo = await Deposit.findById(id);
      if (!depo) return ctx.answerCbQuery('❌ Data deposit tidak ditemukan!');
      if (depo.status !== 'pending') return ctx.answerCbQuery(`⚠️ Sudah diproses (${depo.status})`);

      const prompt = await ctx.reply(
        `❓ *Ketik alasan penolakan deposit:*\n\n👤 User: ${depo.telegramId}\n💰 Nominal: *${depo.amount} pt*\n\n_Silakan reply pesan ini dengan alasannya_`,
        { parse_mode: 'Markdown', reply_markup: { force_reply: true, selective: true } }
      );

      // Simpan ke Map dengan key = message_id prompt
      pendingRejects.set(prompt.message_id, {
        type: 'deposit',
        recordId: id,
        chatId: ctx.chat.id,
        originalMsgId: ctx.callbackQuery.message.message_id,
        originalText: ctx.callbackQuery.message.text
      });

      await ctx.answerCbQuery('📝 Tulis alasan penolakan!');
    } catch (e) {
      console.error('[NotifyBot] depo_reject error:', e.message);
      await ctx.answerCbQuery('❌ Error: ' + e.message);
    }
  });

  // ===================== WITHDRAW APPROVE =====================
  notifyBot.action(/^wd_approve_(.+)$/, async (ctx) => {
    try {
      const id = ctx.match[1];
      const wd = await Withdraw.findById(id);
      if (!wd) return ctx.answerCbQuery('❌ Data withdraw tidak ditemukan!');
      if (wd.status !== 'pending') return ctx.answerCbQuery(`⚠️ Sudah diproses (${wd.status})`);

      wd.status = 'approved';
      wd.adminNote = 'Diterima via Telegram Admin';
      wd.processedAt = new Date();
      await wd.save();

      await notifyUser(wd.telegramId,
        `✅ Permintaan withdraw <b>${wd.amount} poin</b> kamu telah <b>DISETUJUI!</b>\n\nBank: ${wd.bankName}\nRekening: ${wd.accountNumber}\nAtas Nama: ${wd.accountName}\n\nDana segera masuk ke rekeningmu! 💸`
      );

      const origText = ctx.callbackQuery.message.text;
      await editNotif(ctx.chat.id, ctx.callbackQuery.message.message_id,
        origText + '\n\n✅ *STATUS: DITERIMA*\nAdmin: Withdraw dikonfirmasi ✔'
      );

      await ctx.answerCbQuery('✅ Withdraw berhasil diterima!');
    } catch (e) {
      console.error('[NotifyBot] wd_approve error:', e.message);
      await ctx.answerCbQuery('❌ Error: ' + e.message);
    }
  });

  // ===================== WITHDRAW REJECT =====================
  notifyBot.action(/^wd_reject_(.+)$/, async (ctx) => {
    try {
      const id = ctx.match[1];
      const wd = await Withdraw.findById(id);
      if (!wd) return ctx.answerCbQuery('❌ Data withdraw tidak ditemukan!');
      if (wd.status !== 'pending') return ctx.answerCbQuery(`⚠️ Sudah diproses (${wd.status})`);

      const prompt = await ctx.reply(
        `❓ *Ketik alasan penolakan withdraw:*\n\n👤 User: ${wd.telegramId}\n💰 Nominal: *${wd.amount} pt*\n🏦 Bank: ${wd.bankName}\n\n_Silakan reply pesan ini dengan alasannya_`,
        { parse_mode: 'Markdown', reply_markup: { force_reply: true, selective: true } }
      );

      pendingRejects.set(prompt.message_id, {
        type: 'withdraw',
        recordId: id,
        chatId: ctx.chat.id,
        originalMsgId: ctx.callbackQuery.message.message_id,
        originalText: ctx.callbackQuery.message.text
      });

      await ctx.answerCbQuery('📝 Tulis alasan penolakan!');
    } catch (e) {
      console.error('[NotifyBot] wd_reject error:', e.message);
      await ctx.answerCbQuery('❌ Error: ' + e.message);
    }
  });

  // ===================== TEXT HANDLER — ALASAN PENOLAKAN =====================
  notifyBot.on('text', async (ctx) => {
    const replyTo = ctx.message?.reply_to_message;
    if (!replyTo) return; // Bukan balasan, abaikan

    const promptMsgId = replyTo.message_id;
    const pending = pendingRejects.get(promptMsgId);
    if (!pending) return; // Bukan reply ke prompt penolakan, abaikan

    const reason = ctx.message.text;
    pendingRejects.delete(promptMsgId); // Hapus dari Map supaya tidak diproses ulang

    try {
      if (pending.type === 'deposit') {
        const depo = await Deposit.findById(pending.recordId);
        if (!depo) return ctx.reply('❌ Data deposit tidak ditemukan!');
        if (depo.status !== 'pending') return ctx.reply(`⚠️ Deposit sudah diproses: ${depo.status}`);

        // FIX: Deposit enum = 'failed', bukan 'rejected'
        depo.status = 'failed';
        depo.adminNote = reason;
        depo.processedAt = new Date();
        depo.updatedAt = Date.now();
        await depo.save();

        await notifyUser(depo.telegramId,
          `❌ <b>Deposit Dibatalkan</b>\n\nNominal: <b>${depo.amount} poin</b> ditolak.\nAlasan: ${reason}\n\nHubungi admin jika ada pertanyaan.`
        );

        await editNotif(pending.chatId, pending.originalMsgId,
          pending.originalText + `\n\n❌ *STATUS: DITOLAK*\nAlasan: ${reason}`
        );

        return ctx.reply(`✅ Deposit ditolak.\n💬 Alasan: ${reason}`);
      }

      if (pending.type === 'withdraw') {
        const wd = await Withdraw.findById(pending.recordId);
        if (!wd) return ctx.reply('❌ Data withdraw tidak ditemukan!');
        if (wd.status !== 'pending') return ctx.reply(`⚠️ Withdraw sudah diproses: ${wd.status}`);

        wd.status = 'rejected';
        wd.adminNote = reason;
        wd.processedAt = new Date();
        await wd.save();

        // Kembalikan saldo user
        await User.findByIdAndUpdate(wd.userId, { $inc: { balance: wd.amount } });

        await notifyUser(wd.telegramId,
          `❌ Permintaan withdraw <b>${wd.amount} poin</b> kamu <b>DITOLAK</b>.\n\nAlasan: ${reason}\n\nSaldo kamu telah dikembalikan. 💰`
        );

        await editNotif(pending.chatId, pending.originalMsgId,
          pending.originalText + `\n\n❌ *STATUS: DITOLAK*\nAlasan: ${reason}`
        );

        return ctx.reply(`✅ Withdraw ditolak.\n💬 Alasan: ${reason}\n💰 Saldo user sudah dikembalikan.`);
      }
    } catch (e) {
      console.error('[NotifyBot] text handler error:', e.message);
      ctx.reply('❌ Terjadi error: ' + e.message).catch(() => {});
    }
  });

  notifyBot.launch()
    .then(() => console.log('🔔 NotifyBot started successfully!'))
    .catch(e => console.error('[NotifyBot] Launch error:', e.message));

  process.once('SIGINT', () => notifyBot.stop('SIGINT'));
  process.once('SIGTERM', () => notifyBot.stop('SIGTERM'));
};
