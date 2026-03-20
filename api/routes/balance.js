const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middlewares/authMiddleware');

// PATCH /api/balance/adjust
router.patch('/adjust', auth, async (req, res) => {
  try {
    const { telegramId, amount, note, includeTurnover } = req.body;
    if (!telegramId || amount === undefined) {
      return res.status(400).json({ error: 'telegramId and amount required' });
    }

    // First, find the user to get the current turnoverRequired
    const user = await User.findOne({ telegramId });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const updateFields = {
      $inc: { balance: Number(amount) }
    };
    
    // Tambah syarat TO jika di-centang dan jika amount positif (penambahan saldo)
    // turnoverRequired += amount — progres yang sudah dibet user tetap terhitung
    if (includeTurnover && Number(amount) > 0) {
      updateFields.$inc.turnoverRequired = Number(amount);
    }

    const updatedUser = await User.findOneAndUpdate(
      { telegramId },
      updateFields,
      { new: true }
    );

    res.json({ updatedBalance: user.balance, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
