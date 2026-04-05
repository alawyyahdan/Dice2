const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema({
  type: { type: String, enum: ['users', 'groups', 'both'], required: true },
  message: { type: String },
  imageFileId: { type: String },
  targetCount: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  // Array detail kegagalan: [{ chatId, name, reason }]
  failedDetails: { type: [{ chatId: String, name: String, reason: String }], default: [] },
  status: { type: String, enum: ['pending', 'sending', 'done', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

module.exports = mongoose.model('Broadcast', broadcastSchema);

