const { calculateBet } = require('../utils/diceCalculator');
const User = require('../../api/models/User');
const Bet = require('../../api/models/Bet');
const crypto = require('crypto');
const settingsService = require('../../api/services/settingsService');

// Listener in-memory: Map<telegramId, { chatId, collected: [], timeout, processing }>
const waitingRolls = new Map();

// pendingBets & roundTracker di-inject dari betHandler saat registerDiceHandler dipanggil
let _pendingBets;
let _roundTracker;

function registerDiceHandler(bot, pendingBets, roundTracker) {
  _pendingBets = pendingBets;
  _roundTracker = roundTracker;

  // User pilih Bot yang Roll
  bot.action('roll_bot', async (ctx) => {
    await ctx.answerCbQuery('🎲 Bot sedang roll...');
    const telegramId = String(ctx.from.id);
    const bet = _pendingBets.get(telegramId);
    if (!bet) return ctx.reply('❌ Tidak ada taruhan aktif.');

    _pendingBets.delete(telegramId);
    // Remove the inline buttons
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});

    const dice = [];
    for (let i = 0; i < 3; i++) {
      const msg = await ctx.telegram.sendDice(ctx.chat.id, { emoji: '🎲' });
      dice.push(msg.dice.value);
      if (i < 2) await sleep(1500);
    }

    await processResult(ctx, bet, dice, 'bot');
  });

  // User pilih Roll sendiri → kirim pesan + Reply Keyboard tombol dadu
  bot.action('roll_user', async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = String(ctx.from.id);
    const bet = _pendingBets.get(telegramId);
    if (!bet) return ctx.reply('❌ Tidak ada taruhan aktif.');

    _pendingBets.delete(telegramId);
    // Remove the inline buttons
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});

    const { rollDiceReplyKeyboard } = require('../utils/keyboard');

    await ctx.reply(
      settingsService.getString('roll_user_start'),
      { parse_mode: 'HTML', ...rollDiceReplyKeyboard }
    );

    // Timeout 120 detik (2 Menit)
    const timeout = setTimeout(async () => {
      if (waitingRolls.has(telegramId)) {
        waitingRolls.delete(telegramId);
        const { removeRollKeyboard } = require('../utils/keyboard');
        try {
          await ctx.reply(settingsService.getString('roll_timeout'), {
            parse_mode: 'HTML',
            ...removeRollKeyboard
          });
        } catch (_) {}
      }
    }, 120000);

    waitingRolls.set(telegramId, {
      chatId: ctx.chat.id,
      bet,
      collected: [],
      timeout,
      processing: false
    });
  });
}

// Dipanggil dari betHandler saat user kirim emoji dadu 🎲
// value = ctx.message.dice.value (langsung dari dadu user, tidak perlu sendDice lagi)
async function handleUserDiceRoll(ctx, telegramId, value) {
  const session = waitingRolls.get(telegramId);
  if (!session) return;
  if (ctx.chat.id !== session.chatId) return;
  if (session.processing) return;

  // Cooldown 2 detik antar roll
  const now = Date.now();
  if (session.lastRollTime && (now - session.lastRollTime) < 2000) {
    const sisaMs = 2000 - (now - session.lastRollTime);
    const sisaDtk = Math.ceil(sisaMs / 1000);
    await ctx.reply(`⏳ *Anda terlalu cepat!* Harap tunggu ${sisaDtk} detik lagi sebelum roll berikutnya.`, { parse_mode: 'Markdown' });
    return;
  }
  session.lastRollTime = now;

  session.processing = true;
  session.collected.push(value);
  const count = session.collected.length;

  // Kirim hasil tiap dadu satu per satu
  await ctx.reply(
    `✅ *Dadu ${count}/3* → hasil: *[${value}]*`,
    { parse_mode: 'Markdown' }
  );

  if (count < 3) {
    session.processing = false;
  } else {
    // 3 dadu terkumpul → hapus keyboard, proses hasil
    clearTimeout(session.timeout);
    waitingRolls.delete(telegramId);

    const { removeRollKeyboard } = require('../utils/keyboard');
    await ctx.reply('✅ Semua dadu sudah diroll!', { ...removeRollKeyboard });

    await processResult(ctx, session.bet, session.collected, 'user');
  }
}

async function processResult(ctx, bet, dice, rolledBy) {
  const telegramId = bet.telegramId;
  const [d1, d2, d3] = dice;
  const total = d1 + d2 + d3;

  const result = calculateBet(bet, dice);
  const { getMatchingCategories } = require('../utils/diceCalculator');
  const categories = getMatchingCategories(dice);

  const r2 = (n) => Number(Number(n).toFixed(2));
  const updateOp = { $inc: { turnoverRequired: -bet.betAmount, turnover: bet.betAmount, cashback: r2(bet.betAmount * 0.01) } };
  if (result.isWin) {
    updateOp.$inc.balance = r2(result.payout - bet.betAmount);
  } else {
    updateOp.$inc.balance = -bet.betAmount;
  }

  const updatedUser = await User.findOneAndUpdate(
    { telegramId },
    updateOp,
    { new: true }
  );

  // RoundId format: YYYYMMDDHHmmss + 4 digit random
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const roundId =
    `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}` +
    `${String(Math.floor(Math.random()*10000)).padStart(4,'0')}`;

  await Bet.create({
    userId: bet.userId,
    telegramId,
    roundId,
    betType: bet.betType,
    betAmount: bet.betAmount,
    odds: result.odds,
    diceResult: dice,
    diceTotal: total,
    isWin: result.isWin,
    payout: result.payout,
    profit: result.profit,
    cashbackAmount: bet.betAmount * 0.01,
    rolledBy
  });

  // Anti-hedging round tracker
  const round = _roundTracker.get(telegramId) || { bets: [] };
  round.bets.push(bet.betType);
  _roundTracker.set(telegramId, round);
  setTimeout(() => _roundTracker.delete(telegramId), 5 * 60 * 1000);

  const catStr = categories.map(c => `|${c}`).join('') + '|';

  const textMsg = result.isWin
    ? settingsService.getString('result_win', { round_id: roundId, d1, d2, d3, total, kategori: catStr, payout: result.payout.toFixed(2), saldo: (updatedUser?.balance || 0).toFixed(2) })
    : settingsService.getString('result_lose', { round_id: roundId, d1, d2, d3, total, kategori: catStr, bet: bet.betAmount.toFixed(2), saldo: (updatedUser?.balance || 0).toFixed(2) });

  const { generateTrendImage } = require('../utils/trendGenerator');
  const imageBuffer = await generateTrendImage({ isGroup: false, telegramId });
  
  if (imageBuffer) {
    await ctx.replyWithPhoto({ source: imageBuffer }, { caption: textMsg, parse_mode: 'HTML' });
  } else {
    await ctx.reply(textMsg, { parse_mode: 'HTML' });
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { registerDiceHandler, waitingRolls, handleUserDiceRoll };
