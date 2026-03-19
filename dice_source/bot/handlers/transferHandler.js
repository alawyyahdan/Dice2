const User = require('../../api/models/User');
const settingsService = require('../../api/services/settingsService');

function registerTransferHandler(bot) {
  // Format: TF <nominal> <telegramId>
  // Transfer antar pemain
  bot.hears(/^TF\s+(\d+(?:\.\d+)?)\s+(\d+)$/i, async (ctx) => {
    try {
      const amount = Number(ctx.match[1]);
      const targetId = ctx.match[2];

      if (amount <= 0) return ctx.reply('⚠️ Nominal transfer harus lebih dari 0.');

      const senderId = ctx.from.id.toString();

      if (senderId === targetId) return ctx.reply('⚠️ Tidak bisa transfer ke diri sendiri.');

      // Find sender
      const sender = await User.findOne({ telegramId: senderId });
      if (!sender) return ctx.reply('⚠️ Akun Anda tidak ditemukan.');

      if (sender.balance < amount) {
        return ctx.reply(settingsService.getString('tf_saldo_kurang', { saldo: sender.balance.toLocaleString() }));
      }

      // Find receiver
      const receiver = await User.findOne({ telegramId: targetId });
      if (!receiver) return ctx.reply('⚠️ ID Penerima tidak ditemukan di database.');

      // Perform transfer
      sender.balance -= amount;
      receiver.balance += amount;

      await Promise.all([sender.save(), receiver.save()]);

      const pengirim = sender.username ? '@'+sender.username : sender.firstName;
      const penerima = receiver.username ? '@'+receiver.username : receiver.firstName;
      ctx.reply(
        settingsService.getString('tf_success', { nominal: amount.toLocaleString(), pengirim, target_id: targetId, penerima }),
        { parse_mode: 'HTML' }
      );

    } catch (e) {
      console.error('TF Error:', e);
      ctx.reply('❌ Terjadi kesalahan saat transfer.');
    }
  });
}

module.exports = { registerTransferHandler };
