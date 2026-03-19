const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  telegramId: String,
  amount: Number,
  paymentMethod: String,
  status: { type: String, enum: ['pending', 'success', 'failed', 'expired'], default: 'pending' },
  referenceId: { type: String, unique: true }, // Referensi transaksi unik kita / Tripay
  checkoutUrl: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Deposit', depositSchema);
