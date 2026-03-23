const express = require('express');
const router = express.Router();
const Deposit = require('../models/Deposit');
const Withdraw = require('../models/Withdraw');
const paymentService = require('../services/paymentService');
const requireAdmin = require('../middlewares/authMiddleware');

router.use(requireAdmin);

router.get('/', async (req, res) => {
  try {
    // 1. Get PG Balance (Silent warning if not configured yet)
    let pgBalance = 0;
    try {
      const balanceData = await paymentService.checkBalance();
      if (balanceData) {
        // If balanceData is an object with balance prop, or just the balance number
        pgBalance = Number(balanceData.balance !== undefined ? balanceData.balance : balanceData);
      }
    } catch (e) {
      console.warn('Unable to get PG balance for analytics:', e.message);
    }

    // 2. Global Totals (Success and Approved only)
    const totalDepoAggr = await Deposit.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    // Multiply by 1000 (1 pt = 1000 IDR)
    const totalDeposit = (totalDepoAggr.length > 0 ? totalDepoAggr[0].total : 0) * 1000;

    const totalWdAggr = await Withdraw.aggregate([
      { $match: { status: 'approved' } }, // Status is 'approved' for successful withdrawals
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    // Multiply by 1000 (1 pt = 1000 IDR)
    const totalWithdraw = (totalWdAggr.length > 0 ? totalWdAggr[0].total : 0) * 1000;

    // 3. Daily Volume
    const dailyDepoAggr = await Deposit.aggregate([
      { $match: { status: 'success' } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          deposit: { $sum: '$amount' }
        }
      }
    ]);

    const dailyWdAggr = await Withdraw.aggregate([
      { $match: { status: 'approved' } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          withdraw: { $sum: '$amount' }
        }
      }
    ]);

    // Format daily data into a simple map
    const dailyVolumeMap = {};
    dailyDepoAggr.forEach(d => {
      dailyVolumeMap[d._id] = { date: d._id, deposit: d.deposit * 1000, withdraw: 0 };
    });
    dailyWdAggr.forEach(w => {
      if (!dailyVolumeMap[w._id]) {
        dailyVolumeMap[w._id] = { date: w._id, deposit: 0, withdraw: 0 };
      }
      dailyVolumeMap[w._id].withdraw = w.withdraw * 1000;
    });

    // Sort by date ascending
    const dailyVolume = Object.values(dailyVolumeMap).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      totalDeposit,
      totalWithdraw,
      pnl: totalDeposit - totalWithdraw,
      pgBalance,
      dailyVolume
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
