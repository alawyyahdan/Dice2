const express = require('express');
const router = express.Router();
const Bet = require('../models/Bet');
const auth = require('../middlewares/authMiddleware');

// GET /api/bets?page=1&limit=20&telegramId=xxx&betType=xxx&dateFrom=xxx&dateTo=xxx&isWin=true
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, telegramId, betType, dateFrom, dateTo, isWin, isGroup } = req.query;
    const query = { telegramId: { $ne: 'system' } };

    if (telegramId) query.telegramId = telegramId;
    if (betType) query.betType = betType;
    if (isWin !== undefined && isWin !== '') query.isWin = isWin === 'true';
    if (isGroup !== undefined && isGroup !== '') {
      if (isGroup === 'true') {
        query.isGroup = true;
      } else {
        query.$or = [{ isGroup: false }, { isGroup: { $exists: false } }];
      }
    }
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const total = await Bet.countDocuments(query);
    const bets = await Bet.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Stats
    const allBets = await Bet.find(query);
    const stats = {
      totalBet: allBets.reduce((s, b) => s + b.betAmount, 0),
      totalWin: allBets.filter(b => b.isWin).reduce((s, b) => s + b.payout, 0),
      totalLose: allBets.filter(b => !b.isWin).reduce((s, b) => s + b.betAmount, 0),
      totalProfit: allBets.reduce((s, b) => s + (b.profit || 0), 0),
    };

    res.json({ bets, total, page: Number(page), stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bets/volume7d
router.get('/volume7d', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const past7Days = new Date(today);
    past7Days.setDate(past7Days.getDate() - 6);
    past7Days.setHours(0, 0, 0, 0);

    const rawBets = await Bet.find({
      telegramId: { $ne: 'system' },
      createdAt: { $gte: past7Days, $lte: today }
    });

    const volumeMap = {};
    for (const b of rawBets) {
      if (!b.createdAt) continue;
      const d = new Date(b.createdAt);
      // Group by localized YYYY-MM-DD
      const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      volumeMap[dateKey] = (volumeMap[dateKey] || 0) + (b.betAmount || 0);
    }

    const chartData = [];
    const labels = [];
    const daysName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - i);
      const targetKey = `${targetDate.getFullYear()}-${targetDate.getMonth() + 1}-${targetDate.getDate()}`;
      
      chartData.push(volumeMap[targetKey] || 0);
      labels.push(daysName[targetDate.getDay()]);
    }

    res.json({ chartData, labels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
