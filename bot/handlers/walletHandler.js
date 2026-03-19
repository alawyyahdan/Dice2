const User = require('../../api/models/User');

function registerWalletHandler(bot) {
  // Mengunci /deposit, arahkan ke WebApp
  bot.command('deposit', async (ctx) => {
    return ctx.reply('⚠️ *Sistem Berubah!*\nSekarang Deposit dan Withdraw wajib dilakukan melalui MiniApp (Web) otomatis.\n\nSilakan buka menu Web App dari tombol **💸 Buka Withdraw/Deposit**.', { parse_mode: 'Markdown' });
  });
}

module.exports = { registerWalletHandler };
