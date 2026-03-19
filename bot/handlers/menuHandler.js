const { mainMenuKeyboard } = require('../utils/keyboard');
const settingsService = require('../../api/services/settingsService');

function registerMenuHandler(bot) {
  bot.start(async (ctx) => {
    // Abaikan jika ini masuk dari MiniApp Withdraw (biasanya ngirim command payload)
    const payload = ctx.message.text.split(' ')[1];
    if (payload === 'withdraw' || payload === 'deposit') {
      return ctx.reply('💸 Klik tombol di bawah ini untuk membuka menu otomatis WebApp:', {
        reply_markup: {
          inline_keyboard: [[{ text: '🌐 Buka MiniApp', web_app: { url: process.env.MINIAPP_URL || 'https://yourdomain.com/miniapp' } }]]
        }
      });
    }

    const name = ctx.dbUser?.firstName || ctx.from.first_name || 'Kawan';
    await ctx.reply(
      settingsService.getString('welcome', { nama: name }),
      { parse_mode: 'HTML', ...mainMenuKeyboard }
    );
  });

  bot.command('menu', async (ctx) => {
    await ctx.reply('📋 Menu Utama:', mainMenuKeyboard);
  });

  // Callback: Saldo
  bot.action('menu_saldo', async (ctx) => {
    await ctx.answerCbQuery();
    const user = ctx.dbUser;
    if (!user) return ctx.reply('❌ Data user tidak ditemukan.');

    const sisaTO = user.turnoverRequired > 0 ? `${user.turnoverRequired} poin` : 'LUNAS (Bisa WD)';
    await ctx.reply(
      settingsService.getString('saldo_info', {
        nama: user.firstName || '-',
        id: user.telegramId,
        saldo: user.balance,
        total_deposit: user.totalDeposit,
        sisa_to: sisaTO,
        cashback: user.cashback
      }),
      { parse_mode: 'HTML' }
    );
  });

  // Callback: History Taruhan
  bot.action('menu_history', async (ctx) => {
    await ctx.answerCbQuery();
    const Bet = require('../../api/models/Bet');
    const bets = await Bet.find({ telegramId: ctx.dbUser.telegramId })
      .sort({ createdAt: -1 })
      .limit(10);

    if (bets.length === 0) {
      return ctx.reply('📜 Belum ada riwayat taruhan.');
    }

    let msg = `📜 *10 Taruhan Terakhir*\n\n`;
    bets.forEach((b, i) => {
      const status = b.isWin ? `✅ +${b.payout}` : `❌ -${b.betAmount}`;
      const source = b.isGroup ? 'Grup' : 'PC';
      const tanggal = new Date(b.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      msg += `${i + 1}. [${source}] ${b.betType} | ${b.betAmount} poin | 🎲 [${b.diceResult?.join(',')}]=${b.diceTotal} | ${status}\n`;
    });

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  });
}

module.exports = registerMenuHandler;
