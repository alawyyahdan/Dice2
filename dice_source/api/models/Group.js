const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  title: String,
  isActive: { type: Boolean, default: true },
  addedAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Group', groupSchema);
