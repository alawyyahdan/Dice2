const User = require('../../api/models/User');
const Group = require('../../api/models/Group');
const Angpao = require('../../api/models/Angpao');
const crypto = require('crypto');
const settingsService = require('../../api/services/settingsService');

function registerAngpaoHandler(bot) {
  // Format: PAO <nominal> <jumlah_orang> ATAU PAOF <nominal> <jumlah_orang>
  bot.hears(/^(PAO|PAOF)\s+(\d+(?:\.\d+)?)\s+(\d+)$/i, async (ctx) => {
    try {
      const command = ctx.match[1].toUpperCase();
      const isFixed = command === 'PAOF';
      const amount = Number(ctx.match[2]);
      const maxClaims = parseInt(ctx.match[3], 10);

      if (ctx.chat.type === 'private') {
        return ctx.reply('⚠️ Command Angpao (PAO/PAOF) hanya bisa digunakan *di dalam Grup*.', { parse_mode: 'Markdown' });
      }

      if (amount <= 0) return ctx.reply('⚠️ Nominal angpao harus lebih dari 0.');
      if (maxClaims <= 0) return ctx.reply('⚠️ Jumlah orang harus lebih dari 0.');

      const senderId = ctx.from.id.toString();
      const sender = await User.findOne({ telegramId: senderId });
      if (!sender) return ctx.reply('⚠️ Akun Anda tidak ditemukan.');

      if (sender.balance < amount) {
        return ctx.reply(`⚠️ Saldo tidak cukup untuk membuat Angpao!\nSaldo Anda: ${sender.balance.toLocaleString()} pt`);
      }

      // Potong saldo
      sender.balance -= amount;
      await sender.save();

      // Create Angpao DB
      const angpaoId = 'pao_' + crypto.randomBytes(4).toString('hex');
      const newAngpao = new Angpao({
        angpaoId,
        creatorTelegramId: senderId,
        creatorName: sender.username ? '@' + sender.username : sender.firstName,
        type: isFixed ? 'fixed' : 'random',
        totalAmount: amount,
        maxClaims,
        remainingAmount: amount,
        remainingClaims: maxClaims,
        claims: []
      });
      await newAngpao.save();

      const tipe = isFixed ? 'Sama Rata' : 'Acak (Gacha)';
      const caption = settingsService.getString('angpao_caption', {
        creator: newAngpao.creatorName,
        nominal: amount.toLocaleString(),
        kuota: maxClaims,
        tipe
      });

      const keyboard = {
        inline_keyboard: [[
          { text: '🧧 Klik untuk ambil', callback_data: `claim_pao_${angpaoId}` },
          { text: '📋 Daftar penerima', callback_data: `list_pao_${angpaoId}` }
        ]]
      };

      const angpaoImageUrl = settingsService.getString('angpao_image');
      await ctx.replyWithPhoto(angpaoImageUrl, {
        caption,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });

    } catch (e) {
      console.error('Angpao create error:', e);
      ctx.reply('❌ Gagal membuat Angpao.');
    }
  });

  // Handle Claims
  bot.action(/^claim_pao_(.+)$/, async (ctx) => {
    try {
      const angpaoId = ctx.match[1];
      const userId = ctx.from.id.toString();
      const username = ctx.from.username ? '@' + ctx.from.username : ctx.from.first_name;

      const angpao = await Angpao.findOne({ angpaoId });

      if (!angpao) return ctx.answerCbQuery('❌ Angpao tidak ditemukan!', { show_alert: true });
      if (angpao.remainingClaims <= 0) return ctx.answerCbQuery(settingsService.getString('angpao_habis'), { show_alert: true });
      if (angpao.claims.some(c => c.telegramId === userId)) return ctx.answerCbQuery(settingsService.getString('angpao_sudah_klaim'), { show_alert: true });

      // Calculate amount mathematically
      let claimAmount = 0;
      if (angpao.type === 'fixed') {
        claimAmount = angpao.totalAmount / angpao.maxClaims;
      } else {
        if (angpao.remainingClaims === 1) {
          claimAmount = angpao.remainingAmount;
        } else {
          const max = (angpao.remainingAmount / angpao.remainingClaims) * 2;
          const min = 0.01;
          claimAmount = Math.random() * (max - min) + min;
        }
      }

      claimAmount = Number(claimAmount.toFixed(2));

      // Atomic Update to prevent race condition double-claims
      const updateResult = await Angpao.findOneAndUpdate(
        {
          angpaoId,
          remainingClaims: { $gt: 0 },
          'claims.telegramId': { $ne: userId }
        },
        {
          $inc: { remainingAmount: -claimAmount, remainingClaims: -1 },
          $push: { claims: { telegramId: userId, username, amount: claimAmount } }
        },
        { new: true }
      );

      // If race condition fails
      if (!updateResult) {
        return ctx.answerCbQuery('😢 Gagal! Angpao sudah habis di saat bersamaan atau Anda sudah claim.', { show_alert: true });
      }

      // Add actual balance
      await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: claimAmount } });

      ctx.answerCbQuery(settingsService.getString('angpao_claim_success', { nominal: claimAmount.toLocaleString() }), { show_alert: true });

    } catch (e) {
      console.error(e);
      ctx.answerCbQuery('❌ Terjadi kesalahan saat claim.', { show_alert: true });
    }
  });

  // Handle List Penerima
  bot.action(/^list_pao_(.+)$/, async (ctx) => {
    try {
      const angpaoId = ctx.match[1];
      const angpao = await Angpao.findOne({ angpaoId });

      if (!angpao) return ctx.answerCbQuery('❌ Angpao tidak ditemukan!', { show_alert: true });

      if (angpao.claims.length === 0) {
        return ctx.answerCbQuery('Belum ada yang berhasil merebut Angpao ini.', { show_alert: true });
      }

      let text = `📋 Penerima Angpao (${angpao.claims.length}/${angpao.maxClaims}):\n`;
      let i = 1;
      for (const c of angpao.claims) {
        const line = `${i}. ${c.username}: ${c.amount} pt\n`;
        // Telegram answerCbQuery popup is max 200 chars limit.
        if ((text + line).length > 180) {
          text += `...dan lainnya`;
          break;
        }
        text += line;
        i++;
      }

      ctx.answerCbQuery(text, { show_alert: true });
    } catch (e) {
      console.error(e);
      ctx.answerCbQuery('❌ Terjadi kesalahan.', { show_alert: true });
    }
  });
}

module.exports = { registerAngpaoHandler };
