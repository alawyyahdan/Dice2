const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Bet = require('../models/Bet');
const auth = require('../middlewares/authMiddleware');

// GET /api/users?page=1&limit=20&search=xxx
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { telegramId: search },
        { firstName: { $regex: search, $options: 'i' } }
      ];
    }
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ users, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:telegramId
router.get('/:telegramId', auth, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.params.telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const recentBets = await Bet.find({ telegramId: req.params.telegramId })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ user, recentBets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// PUT /api/users/:telegramId/ban
router.put('/:telegramId/ban', auth, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.params.telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.isBanned = !user.isBanned;
    await user.save();
    res.json({ message: 'User ban status updated', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:telegramId/bank/:accountNumber
router.delete('/:telegramId/bank/:accountNumber', auth, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.params.telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Filter out the bank
    const initialLen = user.banks?.length || 0;
    user.banks = user.banks.filter(b => b.accountNumber !== req.params.accountNumber);
    
    if (user.banks.length === initialLen) {
      return res.status(404).json({ error: 'Rekening tidak ditemukan di data user ini' });
    }

    await user.save();
    res.json({ message: 'Rekening berhasil dihapus oleh Admin', banks: user.banks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:telegramId
router.delete('/:telegramId', auth, async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ telegramId: req.params.telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    await Bet.deleteMany({ telegramId: req.params.telegramId }); // Hapus histori juga
    res.json({ message: 'User and their bets deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
