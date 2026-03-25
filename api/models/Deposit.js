const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  telegramId: String,
  amount: Number,
  paymentMethod: String,
  status: { type: String, enum: ['pending', 'success', 'failed', 'expired'], default: 'pending' },
  referenceId: { type: String, unique: true }, // Referensi transaksi unik kita
  transactionId: String, // ID dari SiTranfer
  paymentData: String, // Menyimpan URL DANA atau URL Gambar QRIS
  checkoutUrl: String, // Endpoint untuk mini app jika ada opsi eksternal
  qrMessageId: Number, // ID pesan QR di Telegram untuk auto-delete
  notifyMessageId: Number, // ID pesan notifikasi ke admin
  promoId: String, // ID Promo yang dipakai saat deposit
  promoName: String, // Nama Promo
  bonusApplied: { type: Number, default: 0 }, // Bonus coin yang didapatkan
  turnoverApplied: { type: Number, default: 0 }, // Syarat TO yang dibebankan
  adminNote: { type: String, default: '' },
  processedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Deposit', depositSchema);
