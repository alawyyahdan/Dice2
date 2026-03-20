const express = require('express');
const router = express.Router();
const Bet = require('../models/Bet');
const User = require('../models/User');
const Deposit = require('../models/Deposit');
const authMiddleware = require('../middlewares/authMiddleware');
const crypto = require('crypto');

function verifyTelegramInitData(initData) {
  if (process.env.DEBUG === 'true' && initData === 'mock-debug-init-data') return true;
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    return hash === expectedHash;
  } catch { return false; }
}

// Censor Helper
function censorName(username, fallback) {
  if (!username) return 'Anonim';
  if (username.length <= 4) return username.substring(0, 1) + '***';
  return username.substring(0, username.length - 4) + '****';
}

router.get('/public', async (req, res) => {
  try {
    const { filter, initData } = req.query; // 'daily', 'weekly', 'monthly'
    
    if (!verifyTelegramInitData(initData)) return res.status(403).json({ error: 'Auth failed: Invalid Telegram Signature' });

    let startDate = new Date();
    startDate.setHours(0,0,0,0);

    if (filter === 'weekly') {
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(startDate.setDate(diff));
    } else if (filter === 'monthly') {
      startDate.setDate(1);
    }

    const pipeline = [
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: "$telegramId", totalVolume: { $sum: "$betAmount" } } },
      { $sort: { totalVolume: -1 } },
      { $limit: 50 }
    ];

    const aggregated = await Bet.aggregate(pipeline);

    const results = [];
    for (let i = 0; i < aggregated.length; i++) {
        const u = await User.findOne({ telegramId: aggregated[i]._id }).lean();
        if (u) {
            results.push({
                rank: i + 1,
                username: censorName(u.username || u.firstName),
                volume: aggregated[i].totalVolume,
                photoUrl: u.photoUrl || ''
            });
        }
    }

    res.json({ success: true, leaderboard: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin', authMiddleware, async (req, res) => {
  try {
    const { filter } = req.query;
    let startDate = new Date();
    if (filter === 'all_time') {
       startDate = new Date(0);
    } else {
       startDate.setHours(0,0,0,0);
       if (filter === 'weekly') {
          const day = startDate.getDay();
          const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
          startDate = new Date(startDate.setDate(diff));
       } else if (filter === 'monthly') {
          startDate.setDate(1);
       }
    }

    // 1. Get Volume, Win, Lose from Bets
    const betAggregation = await Bet.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: {
          _id: "$telegramId",
          volume: { $sum: "$betAmount" },
          win: { $sum: { $cond: [{ $eq: ["$isWin", true] }, "$profit", 0] } },
          lose: { $sum: { $cond: [{ $eq: ["$isWin", false] }, "$betAmount", 0] } }
      }}
    ]);

    // 2. Map and fetch User + Deposit data
    const finalData = [];
    for (const b of betAggregation) {
       const u = await User.findOne({ telegramId: b._id }).lean();
       
       // Calculate explicit total deposit within timeframe
       const depAgg = await Deposit.aggregate([
          { $match: { telegramId: b._id, status: 'success', createdAt: { $gte: startDate } } },
          { $group: { _id: null, total: { $sum: "$amount" } } }
       ]);
       const depositInTimeframe = depAgg.length > 0 ? depAgg[0].total : 0;

       if (u) {
          finalData.push({
             telegramId: b._id,
             username: u.username || '-',
             firstName: u.firstName || '-',
             volume: b.volume,
             win: b.win,
             lose: b.lose,
             deposit: depositInTimeframe
          });
       }
    }

    // Sort by volume descending
    finalData.sort((a,b) => b.volume - a.volume);

    res.json({ success: true, leaderboard: finalData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
