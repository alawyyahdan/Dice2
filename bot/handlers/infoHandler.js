const Bet = require('../../api/models/Bet');
const settingsService = require('../../api/services/settingsService');

function registerInfoHandler(bot) {
  bot.command('saldo', async (ctx) => {
    const user = ctx.dbUser;
    if (!user) return ctx.reply('❌ Data user tidak ditemukan.');

    await ctx.reply(
      `💰 *Saldo Kamu*\n\n` +
      `💵 Saldo: *${user.balance} poin*\n` +
      `📥 Total Deposit: ${user.totalDeposit} poin\n` +
      `🎯 Sisa Turnover: ${user.turnoverRequired > 0 ? user.turnoverRequired : 'LUNAS (Bisa WD)'}\n` +
      `✨ Cashback Pending: ${user.cashback} poin`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('history', async (ctx) => {
    const telegramId = String(ctx.from.id);
    const bets = await Bet.find({ telegramId })
      .sort({ createdAt: -1 })
      .limit(10);

    if (bets.length === 0) {
      return ctx.reply('📜 Belum ada riwayat taruhan.');
    }

    let msg = '📜 *10 Taruhan Terakhir*\n\n';
    bets.forEach((b, i) => {
      const status = b.isWin ? `✅ +${b.payout}` : `❌ -${b.betAmount}`;
      msg += `${i + 1}. *${b.betType}* | ${b.betAmount}p | 🎲[${b.diceResult?.join(',')}]=${b.diceTotal} | ${status}\n`;
    });

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      `📖 *Cara Bermain Dadu (Sic Bo)*\n\n` +
      `*Format Taruhan:*\n` +
      `\`B100\` → Besar (11-18) 100 poin\n` +
      `\`K100\` → Kecil (3-10) 100 poin\n` +
      `\`GA100\` → Ganjil 100 poin\n` +
      `\`GE100\` → Genap 100 poin\n` +
      `\`BGA100\` → Besar Ganjil 100 poin\n` +
      `\`BGE100\` → Besar Genap 100 poin\n` +
      `\`KGA100\` → Kecil Ganjil 100 poin\n` +
      `\`KGE100\` → Kecil Genap 100 poin\n` +
      `\`11J100\` → Jumlah 11, 100 pt (Pilihan: 4-17)\n` +
      `\`T100\` → Triple sembarang 100 pt\n` +
      `\`L100\` → Lurus 100 pt\n` +
      `\`P100\` → Pasangan 100 pt\n` +
      `\`TB100\` → Tiga Berbeda 100 pt\n` +
      `\`5DS100\` → Dadu Spesifik angka 5, 100 pt (Pilihan Dadunya: 1-6)\n` +
      `\`5TS100\` → Triple Spesifik angka 5, 100 pt (Pilihan Dadunya: 1-6)\n` +
      `\`N100\` → Naga (d1>d3) 100 poin\n` +
      `\`H100\` → Harimau (d3>d1) 100 poin\n` +
      `\`S100\` → Seri (d1=d3) 100 poin\n\n` +
      `*Perintah:*\n` +
      `\`/deposit 10000\` → Isi saldo\n` +
      `\`/saldo\` → Cek saldo\n` +
      `\`/history\` → Riwayat taruhan\n` +
      `\`TR\` → Klaim cashback\n` +
      `\`/menu\` → Menu utama`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('kontak', async (ctx) => {
    await ctx.reply(settingsService.getString('cs_contact'), { parse_mode: 'HTML' });
  });
}

module.exports = { registerInfoHandler };
