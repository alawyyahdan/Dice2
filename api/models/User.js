const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: String, unique: true, required: true },
  username: String,
  firstName: String,
  balance: { type: Number, default: 0 },
  totalDeposit: { type: Number, default: 0 },
  turnover: { type: Number, default: 0 },
  turnoverRequired: { type: Number, default: 0 },
  cashback: { type: Number, default: 0 },
  isBanned: { type: Boolean, default: false },
  banks: [{
    bankName: String,
    accountNumber: String,
    accountName: String,
    addedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  lastActive: Date
});

module.exports = mongoose.model('User', userSchema);
