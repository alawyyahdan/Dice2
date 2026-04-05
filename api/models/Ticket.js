const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  referenceId: { type: String, required: true, unique: true },
  telegramId: { type: String, required: true },
  username: { type: String },
  firstName: { type: String },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  lastMessageAt: { type: Date, default: Date.now },
  closedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ticket', ticketSchema);
