require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');

const userMiddleware = require('./middlewares/userMiddleware');
const groupMiddleware = require('./middlewares/groupMiddleware');
const registerMenuHandler = require('./handlers/menuHandler');
const { registerBetHandler, pendingBets, roundTracker } = require('./handlers/betHandler');
const { registerDiceHandler } = require('./handlers/diceHandler');
const { registerWalletHandler } = require('./handlers/walletHandler');
const { registerInfoHandler } = require('./handlers/infoHandler');
const { registerGroupGameManager } = require('./handlers/groupGameManager');
const { registerTransferHandler } = require('./handlers/transferHandler');
const { registerAngpaoHandler } = require('./handlers/angpaoHandler');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Connect MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connected (bot)');
    const settingsService = require('../api/services/settingsService');
    await settingsService.loadSettings();
    console.log('⚙️ Dynamic Settings Engine Online (Bot)');
  })
  .catch(err => { console.error('❌ MongoDB error:', err); process.exit(1); });

// Middleware: auto-create user & detect groups
bot.use(userMiddleware);
bot.use(groupMiddleware);

// Track if bot is kicked/added to groups
bot.on('my_chat_member', async (ctx) => {
  if (ctx.chat.type.includes('group')) {
    const status = ctx.update.my_chat_member.new_chat_member.status;
    const isActive = status === 'member' || status === 'administrator';
    try {
      const Group = require('../api/models/Group');
      await Group.findOneAndUpdate(
        { chatId: ctx.chat.id.toString() },
        { title: ctx.chat.title, isActive },
        { upsert: true }
      );
    } catch(e) {}
  }
});

// Register all handlers
// pendingBets & roundTracker di-inject ke diceHandler untuk hindari circular dependency
registerMenuHandler(bot);
registerInfoHandler(bot);
registerWalletHandler(bot);
registerBetHandler(bot);
registerDiceHandler(bot, pendingBets, roundTracker);
registerGroupGameManager(bot);
registerTransferHandler(bot);
registerAngpaoHandler(bot);

// Error handler
bot.catch((err, ctx) => {
  console.error(`Bot error for ${ctx.updateType}:`, err);
  ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.').catch(() => {});
});

// Launch bot
bot.launch()
  .then(() => console.log('🤖 Bot started!'))
  .catch(err => console.error('Failed to launch bot:', err));

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
