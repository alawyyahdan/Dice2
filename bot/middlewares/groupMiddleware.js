const Group = require('../../api/models/Group');

// Cache to store known group status { chatId: { isActive: boolean, lastChecked: timestamp } }
const groupCache = new Map();
const CACHE_TTL = 30000; // 30 seconds cache

module.exports = async (ctx, next) => {
  if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
    const chatId = ctx.chat.id.toString();
    const now = Date.now();

    let cached = groupCache.get(chatId);
    if (!cached || (now - cached.lastChecked > CACHE_TTL)) {
      try {
        const group = await Group.findOneAndUpdate(
          { chatId },
          { 
            $set: { title: ctx.chat.title, lastActive: new Date() },
            $setOnInsert: { isActive: true }
          },
          { upsert: true, new: true, lean: true }
        );
        cached = { isActive: group.isActive !== false, lastChecked: now };
        groupCache.set(chatId, cached);
      } catch (e) {
        console.error('Error saving group:', e.message);
        cached = { isActive: true, lastChecked: now }; // fallback
      }
    }

    // Blokir 100% jika status disabled
    if (cached && !cached.isActive) return;
  }
  return next();
};
