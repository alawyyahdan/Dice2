const Group = require('../../api/models/Group');

// In-memory set to reduce DB writes per message
const knownGroups = new Set();

module.exports = async (ctx, next) => {
  if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
    const chatId = ctx.chat.id.toString();
    if (!knownGroups.has(chatId)) {
      knownGroups.add(chatId);
      try {
        await Group.findOneAndUpdate(
          { chatId },
          { title: ctx.chat.title, isActive: true, lastActive: new Date() },
          { upsert: true }
        );
      } catch (e) {
        console.error('Error saving group:', e.message);
      }
    }
  }
  return next();
};
