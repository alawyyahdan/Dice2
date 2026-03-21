const cron = require('node-cron');
const Bet = require('../../api/models/Bet');
const User = require('../../api/models/User');
const { calculateBet, getMatchingCategories } = require('../utils/diceCalculator');
const { generateTrendImage } = require('../utils/trendGenerator');
const { Markup } = require('telegraf');
const settingsService = require('../../api/services/settingsService');
const { miniAppButton } = require('../utils/miniappLink');

const activeGroups = new Set();

// Get the current round ID based on time (e.g. 202603181505)
function getCurrentRoundId() {
  const config = settingsService.getSettings();
  const duration = config?.roundDuration || 1;
  
  const now = new Date();
  // Round up to the next N-minute mark
  const currentMinutes = now.getMinutes();
  const diff = duration - (currentMinutes % duration);
  const minutes = currentMinutes + (now.getSeconds() > 0 ? diff : 0);
  
  const target = new Date(now);
  target.setMinutes(minutes);
  target.setSeconds(0);
  const pad = n => String(n).padStart(2, '0');
  return `${target.getFullYear()}${pad(target.getMonth()+1)}${pad(target.getDate())}${pad(target.getHours())}${pad(target.getMinutes())}`;
}

function getNextRoundId() {
  const config = settingsService.getSettings();
  const duration = config?.roundDuration || 1;
  const now = new Date();
  
  // Start from "now" rounded to current mark, then add duration
  const currentMinutes = now.getMinutes();
  const diffToCurrentMark = (currentMinutes % duration);
  const nextTargetMinutes = currentMinutes - diffToCurrentMark + duration;

  const target = new Date(now);
  target.setMinutes(nextTargetMinutes);
  target.setSeconds(0);
  const pad = n => String(n).padStart(2, '0');
  return `${target.getFullYear()}${pad(target.getMonth()+1)}${pad(target.getDate())}${pad(target.getHours())}${pad(target.getMinutes())}`;
}

const rollingGroups = new Set();

function registerGroupGameManager(bot) {
  const Group = require('../../api/models/Group');
  
  // Load groups from DB on restart
  Group.find({ isActive: true }).lean().then(groups => {
    groups.forEach(g => activeGroups.add(g.chatId));
  }).catch(err => console.error('Gagal meload groups', err));

  // Background Sync: Hapus grup yang dimatikan via Dashboard dari memory bot
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const dbGroups = await Group.find({ isActive: true }).lean();
      const validGroupIds = new Set(dbGroups.map(g => g.chatId));
      for (const gid of activeGroups) {
        if (!validGroupIds.has(gid)) activeGroups.delete(gid);
      }
    } catch (e) {}
  });

  // 10-Second Warning Cron (runs at *:50 setiap menit)
  cron.schedule('50 * * * * *', async () => {
    // If no active groups at all, do nothing to prevent errors.
    if (activeGroups.size === 0) return;

    const config = settingsService.getSettings();
    if (config?.isGroupActive === false) return;

    const duration = config.roundDuration || 1;
    const now = new Date();
    // Only warn if next minute is the start of a round
    if ((now.getMinutes() + 1) % duration !== 0) return;

    const roundId = getCurrentRoundId();
    for (const groupId of activeGroups) {
      try {
        await bot.telegram.sendMessage(
          groupId,
          settingsService.getString('round_warning', { round_id: roundId }),
          { parse_mode: 'HTML' }
        );
      } catch (err) {
        console.error(`Gagal mengirim warning ke grup ${groupId}:`, err.message);
        // Clean up group if bot is kicked
        if (err.message.includes('Forbidden') || err.message.includes('chat not found')) {
            console.log(`Menghapus grup ${groupId} dari activeGroups karena Forbidden/Not Found.`);
            activeGroups.delete(groupId);
        }
      }
    }
  });

  // Round Close and Resolve Cron (runs at 00 setiap menit)
  cron.schedule('0 * * * * *', async () => {
    const config = settingsService.getSettings();
    if (config?.isGroupActive === false) return;

    const duration = config.roundDuration || 1;
    const now = new Date();
    // Only resolve if current minute is a multiple of duration
    if (now.getMinutes() % duration !== 0) return;

    if (activeGroups.size === 0) return;

    const roundId = getCurrentRoundId(); // This is the round that just closed
    const nextRoundId = getNextRoundId();

    // Iterate over active groups
    for (const groupId of activeGroups) {
      // 🛑 KUNCI GRUP AGAR TIDAK BISA MENERIMA BET BARU
      rollingGroups.add(String(groupId));

      try {
        // Fetch unresolved bets for this group and round
        const bets = await Bet.find({ isGroup: true, groupId: String(groupId), roundId, diceResult: { $size: 0 } }).populate('userId');
        
        // Announce closing
        let playersStr = '';
        if (bets.length > 0) {
          bets.forEach(b => {
            playersStr += `👤 ${b.userId.username || b.userId.firstName}: ${b.betType} (${b.betAmount})\n`;
          });
        } else {
          playersStr = '<i>Tidak ada taruhan di periode ini.</i>';
        }

        const closeMsg = settingsService.getString('round_close', { round_id: roundId, players: playersStr || '<i>Tidak ada taruhan.</i>' });
        await bot.telegram.sendMessage(groupId, closeMsg, { parse_mode: 'HTML' });

        // Roll 3 dice locally using telegram's sendDice so each group has its own result animated
        const dice = [];
        for (let i = 0; i < 3; i++) {
          const msg = await bot.telegram.sendDice(groupId, { emoji: '🎲' });
          dice.push(msg.dice.value);
          await sleep(1500); // Wait for animation
        }
        
        const total = dice[0] + dice[1] + dice[2];

        let resultMsg = `🎯 *Hasil Periode \`${roundId}\`*\n`;
        resultMsg += `🎲 ${dice[0]} + ${dice[1]} + ${dice[2]} = *${total}*\n`;
        
        const catStr = getMatchingCategories(dice).map(c => `|${c}`).join('') + '|';
        resultMsg += `📊 Kategori: ${catStr}\n\n`;

        // Process bets
        if (bets.length > 0) {
          resultMsg += `*Rekap Taruhan:*\n`;
          for (const bet of bets) {
            const result = calculateBet(bet, dice);
            const user = bet.userId;
            
            bet.diceResult = dice;
            bet.diceTotal = total;
            bet.isWin = result.isWin;
            bet.payout = result.payout;
            bet.profit = result.profit;
            bet.cashbackAmount = bet.betAmount * 0.01;
            bet.odds = result.odds;
            bet.rolledBy = 'bot';
            await bet.save();

            const r2 = (n) => Number(Number(n).toFixed(2));
            const updateOp = { $inc: { turnoverRequired: -bet.betAmount, turnover: bet.betAmount, cashback: r2(bet.betAmount * 0.01) } };
            // Note: balance was DEDUCTED when bet was placed in group!
            // So we only add payout if they win
            if (result.isWin) {
              updateOp.$inc.balance = r2(result.payout);
            }
            const updatedUser = await User.findByIdAndUpdate(user._id, updateOp, { new: true });

            const saldoFmt = updatedUser ? updatedUser.balance.toFixed(2) : '-';
            const status = result.isWin ? `✅ MENANG! (+${result.payout.toFixed(2)}) → Saldo: ${saldoFmt}` : `❌ KALAH (-${bet.betAmount.toFixed(2)}) → Saldo: ${saldoFmt}`;
            resultMsg += `👤 ${user.username || user.firstName}: ${bet.betType} → ${status}\n`;
          }
        } else {
            // No bets: insert a dummy bet so trendGenerator can pick up the history of this round
            await Bet.create({
              telegramId: 'system',
              isGroup: true,
              groupId: String(groupId),
              roundId,
              betType: 'SYSTEM',
              betAmount: 0,
              diceResult: dice,
              diceTotal: total,
              isWin: false,
              payout: 0,
              profit: 0,
              cashbackAmount: 0,
              rolledBy: 'bot'
            });
        }

        // Generate trend photo
        const imageBuffer = await generateTrendImage({ isGroup: true, groupId: String(groupId) });
        if (imageBuffer) {
          await bot.telegram.sendPhoto(groupId, { source: imageBuffer }, { caption: resultMsg, parse_mode: 'Markdown' });
        } else {
          await bot.telegram.sendMessage(groupId, resultMsg, { parse_mode: 'Markdown' });
        }

        // Open next round — pakai miniAppButton agar konsisten, dan cek setting leaderboard
        const config = settingsService.getSettings();
        const depoBtn    = miniAppButton(bot, '💳 DEPO/WD', 'deposit');
        const historyBtn = miniAppButton(bot, '📜 History', 'history');
        const saldoBtn   = miniAppButton(bot, '💰 Saldo', 'withdraw');

        const toBtn = (b) => b.type === 'web_app'
          ? { text: b.text, web_app: { url: b.url } }
          : { text: b.text, url: b.url };

        const row2 = [toBtn(saldoBtn)];
        if (config?.isLeaderboardActive !== false) {
          const ldbBtn = miniAppButton(bot, '🏆 Leaderboard', 'leaderboard');
          row2.push(toBtn(ldbBtn));
        }

        const csRaw = config?.strings?.cs_contact_link || process.env.CS_USERNAME || '@cs';
        const csUrl = csRaw.startsWith('http') ? csRaw : `https://t.me/${csRaw.replace('@', '')}`;

        const inlineKeyboardArr = [
          [ toBtn(depoBtn), toBtn(historyBtn) ],
          row2,
          [ { text: '📞 Kontak CS', url: csUrl } ]
        ];

        const inlineKeyboard = { reply_markup: { inline_keyboard: inlineKeyboardArr } };

        await bot.telegram.sendMessage(
          groupId,
          settingsService.getString('round_open', { next_round_id: nextRoundId }),
          { parse_mode: 'HTML', ...inlineKeyboard }
        );

      } catch (err) {
        console.error(`Group Manager Error [Group ${groupId}]:`, err);
      } finally {
        // BUKA KUNCI GRUP AGAR BISA TERIMA BET LAGI
        rollingGroups.delete(String(groupId));
      }
    }
  });
}

function addActiveGroup(groupId) {
  activeGroups.add(String(groupId));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isGroupRolling(groupId) {
  return rollingGroups.has(String(groupId));
}

module.exports = { registerGroupGameManager, addActiveGroup, getCurrentRoundId, isGroupRolling };
