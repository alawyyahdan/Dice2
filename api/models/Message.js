const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  senderId: { type: String, required: true }, // 'admin' atau telegramId
  senderModel: { type: String, enum: ['Admin', 'User'] },
  type: { type: String, enum: ['text', 'image'], default: 'text' },
  content: { type: String },
  imageFileId: { type: String }, // Jika gambar dari telegram
  imageUrl: { type: String },    // Jika diakses via HTTP
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);
