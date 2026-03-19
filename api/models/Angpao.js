const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  telegramId: String,
  username: String,
  amount: Number,
  claimedAt: { type: Date, default: Date.now }
});

const angpaoSchema = new mongoose.Schema({
  angpaoId: { type: String, required: true, unique: true },
  creatorTelegramId: String,
  creatorName: String,
  type: { type: String, enum: ['random', 'fixed'] },
  totalAmount: Number,
  maxClaims: Number,
  remainingAmount: Number,
  remainingClaims: Number,
  claims: [claimSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Angpao', angpaoSchema);
