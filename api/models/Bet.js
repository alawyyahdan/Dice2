const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  telegramId: String,
  isGroup: { type: Boolean, default: false },
  groupId: String,
  groupName: String,
  roundId: String,
  betType: String,
  betAmount: Number,
  odds: Number,
  diceResult: [Number],
  diceTotal: Number,
  isWin: Boolean,
  payout: Number,
  profit: Number,
  cashbackAmount: Number,
  rolledBy: { type: String, enum: ['user', 'bot'] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Bet', betSchema);
