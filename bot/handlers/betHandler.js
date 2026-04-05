const { parseBet } = require('../utils/betParser');
const { calculateBet, getMaxBet } = require('../utils/diceCalculator');
const { rollChoiceKeyboard } = require('../utils/keyboard');
const User = require('../../api/models/User');
const Bet = require('../../api/models/Bet');
const settingsService = require('../../api/services/settingsService');

// In-memory session: Map<telegramId, pendingBet>
const pendingBets = new Map();

// Anti-hedging: track bets per round per user
// Map<telegramId, { roundId, bets: [betType] }>
const roundTracker = new Map();

function registerBetHandler(bot) {
  // Tangkap emoji dadu dari user (🎲 selalu jadi message.dice di Telegram, bukan text)
  bot.on('dice', async (ctx) => {
    const telegramId = String(ctx.from.id);
    const { waitingRolls, handleUserDiceRoll } = require('./diceHandler');
    if (!waitingRolls.has(telegramId)) return;
    if (ctx.chat.id !== waitingRolls.get(telegramId).chatId) return;

    const value = ctx.message.dice.value;
    return handleUserDiceRoll(ctx, telegramId, value);
  });

  bot.on('text', async (ctx, next) => {
    const text = ctx.message.text.trim();
    const telegramId = String(ctx.from.id);

    // Skip commands
    if (text.startsWith('/')) return next();

    // --- Cek sesi roll dadu aktif ---
    // Lazy require untuk hindari circular dependency di load time
    const { waitingRolls, handleUserDiceRoll } = require('./diceHandler');
    if (waitingRolls.has(telegramId)) {
      // User tap tombol 🎲 (Reply Keyboard kirim TEXT, bukan dice)
      // Kita kirim sendDice sendiri untuk dapat value asli
      if (text === '🎲') {
        const session = waitingRolls.get(telegramId);
        if (session && session.collected.length < 3) {
          const diceMsg = await ctx.telegram.sendDice(ctx.chat.id, { emoji: '🎲' });
          return handleUserDiceRoll(ctx, telegramId, diceMsg.dice.value);
        }
      }
      // Pesan lain diabaikan selama sesi roll berlangsung
      return;
    }

    // Handle cashback klaim
    if (text.toUpperCase() === 'TR') {
      return handleCashback(ctx);
    }

    const bet = parseBet(text);
    if (!bet) return next();

    const config = settingsService.getSettings();
    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';

    // 🛑 CHECK MAINTENANCE MODE
    const isActive = isGroup ? (config.isGroupActive !== false) : (config.isBotActive !== false);
    if (!isActive) {
      return ctx.reply(settingsService.getString('maintenance_msg'), { parse_mode: 'HTML' });
    }

    const minBet = config.minBet || 1;
    const maxBetGlobal = config.maxBet || 500000;

    if (bet.betAmount < minBet) {
      return ctx.reply(`❌ Minimal bet adalah <b>${minBet} poin</b>.`, { parse_mode: 'HTML' });
    }

    const user = ctx.dbUser;
    if (!user) return ctx.reply('❌ Data user tidak ditemukan.');

    // Validasi saldo
    if (user.balance < bet.betAmount) {
      return ctx.reply(
        settingsService.getString('bet_saldo_kurang', { saldo: user.balance, bet: bet.betAmount }),
        { parse_mode: 'HTML' }
      );
    }

    // Validasi max bet spesifik (Bounds)
    const maxBetSpecific = getMaxBet(bet.betType, bet.jumlah);
    if (bet.betAmount > maxBetSpecific) {
      return ctx.reply(
        settingsService.getString('bet_max_exceeded', { jenis: bet.betType, max: maxBetSpecific }),
        { parse_mode: 'HTML' }
      );
    }

    const betLabel = formatBetLabel(bet);

    // Cek Akumulasi & Anti-hedging (Di Grup) atau batas global (Private)
    let accumulatedBet = 0;
    if (isGroup) {
      const { getCurrentRoundId } = require('./groupGameManager');
      const currentRoundId = getCurrentRoundId();
      const existingBets = await Bet.find({
        telegramId,
        isGroup: true,
        groupId: String(ctx.chat.id),
        roundId: currentRoundId,
        diceResult: { $size: 0 } // belum diproses
      }).select('betType betAmount');

      accumulatedBet = existingBets.reduce((sum, b) => sum + b.betAmount, 0);

      const existingTypes = existingBets.map(b => b.betType);
      if (
        (bet.betType === 'K' && existingTypes.includes('B')) ||
        (bet.betType === 'B' && existingTypes.includes('K')) ||
        (bet.betType === 'GE' && existingTypes.includes('GA')) ||
        (bet.betType === 'GA' && existingTypes.includes('GE'))
      ) {
        return ctx.reply(settingsService.getString('bet_anti_hedging'), { parse_mode: 'HTML' });
      }
    }

    // Validasi Global Max Bet
    if ((bet.betAmount + accumulatedBet) > maxBetGlobal) {
      return ctx.reply(`❌ Maksimal total modal dalam 1 periode adalah <b>${maxBetGlobal} poin</b>. (Terakumulasi: ${accumulatedBet})`, { parse_mode: 'HTML' });
    }

    if (isGroup) {
      // Flow untuk Grup
      const { addActiveGroup, getCurrentRoundId, isGroupRolling } = require('./groupGameManager');
      
      // BLOKIR TARUHAN JIKA STATUSNYA SEDANG DITUTUP (ROLLING FASE)
      if (isGroupRolling(ctx.chat.id)) {
        return ctx.reply(settingsService.getString('bet_ditutup'), { parse_mode: 'HTML' });
      }

      addActiveGroup(ctx.chat.id);
      
      const roundId = getCurrentRoundId();
      
      // Cek batas maksimal total 25000 per ronde
      const existingBetsCount = await Bet.aggregate([
        { $match: { telegramId, isGroup: true, groupId: String(ctx.chat.id), roundId: roundId, diceResult: { $size: 0 } } },
        { $group: { _id: null, total: { $sum: "$betAmount" } } }
      ]);
      const currentTotal = existingBetsCount.length > 0 ? existingBetsCount[0].total : 0;
      if (currentTotal + bet.betAmount > 25000) {
        return ctx.reply(`❌ Batas total bet per periode adalah <b>25,000 poin</b>.\nTotal bet kamu: <b>${currentTotal}</b>\nSisa kuota: <b>${25000 - currentTotal}</b> poin.`, { parse_mode: 'HTML' });
      }

      // Deduct balance directly (rounded to 2 decimals)
      const deductAmt = Number(Number(bet.betAmount).toFixed(2));
      const updatedUser = await User.findByIdAndUpdate(user._id, { $inc: { balance: -deductAmt } }, { new: true });
      
      await Bet.create({
        userId: user._id,
        telegramId,
        isGroup: true,
        groupId: String(ctx.chat.id),
        groupName: ctx.chat.title,
        roundId,
        betType: bet.betType,
        betAmount: bet.betAmount,
        diceResult: []
      });

      const uname = user.username ? `@${user.username}` : user.firstName;
      return ctx.reply(
        settingsService.getString('bet_grup_success', { username: uname, jenis: betLabel, bet: bet.betAmount.toFixed(2), saldo: (updatedUser?.balance || 0).toFixed(2) }),
        { parse_mode: 'HTML' }
      );
    }

    // --- Private Chat Flow ---
    // Simpan pending bet
    pendingBets.set(telegramId, { ...bet, userId: user._id, telegramId });

    // Konfirmasi & tanya roll
    await ctx.reply(
      settingsService.getString('bet_pc_confirm', { jenis: betLabel, bet: bet.betAmount }),
      { parse_mode: 'HTML', ...rollChoiceKeyboard }
    );
  });
}

async function handleCashback(ctx) {
  const user = ctx.dbUser;
  if (!user || user.cashback <= 0) {
    return ctx.reply(settingsService.getString('cashback_empty'));
  }

  await User.findOneAndUpdate(
    { telegramId: user.telegramId },
    { $inc: { balance: user.cashback }, $set: { cashback: 0 } }
  );
  ctx.reply(settingsService.getString('cashback_claimed', { cashback: user.cashback }), { parse_mode: 'HTML' });
}

function formatBetLabel(bet) {
  const labels = {
    B: 'Besar', K: 'Kecil', GA: 'Ganjil', GE: 'Genap',
    BGA: 'Besar Ganjil', BGE: 'Besar Genap', KGA: 'Kecil Ganjil', KGE: 'Kecil Genap',
    T: 'Triple', L: 'Lurus', P: 'Pasangan', TB: 'Tiga Berbeda',
    DS: 'Dadu Spesifik', TS: 'Triple Spesifik', N: 'Naga', H: 'Harimau', S: 'Seri'
  };
  let label = labels[bet.betType] || bet.betType;
  if (bet.betType === 'J') label = `Jumlah ${bet.jumlah}`;
  if (bet.betType === 'DS' || bet.betType === 'TS') label += ` ${bet.diceSpecific}`;
  return label;
}

module.exports = { registerBetHandler, pendingBets, roundTracker };
