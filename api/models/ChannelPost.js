const mongoose = require('mongoose');

const channelPostSchema = new mongoose.Schema({
  channelId: { type: String, required: true },
  messageId: { type: Number, required: true }, // Telegram message_id
  content: { type: String, default: '' },
  imageFileId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChannelPost', channelPostSchema);
