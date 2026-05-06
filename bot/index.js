require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Telegraf } = require('telegraf');
// PENTING: Gunakan instance mongoose yang MURNI sama dengan yang di-require oleh API
// Ini mencegah duplikasi instance (error buffering timeout) akibat npm auto-hoisting
let mongoose;
try {
  const apiMongoosePath = require.resolve('mongoose', { paths: [require('path').join(__dirname, '../api')] });
  mongoose = require(apiMongoosePath);
} catch (e) {
  mongoose = require('mongoose');
}

const userMiddleware = require('./middlewares/userMiddleware');
const groupMiddleware = require('./middlewares/groupMiddleware');
const registerMenuHandler = require('./handlers/menuHandler');
const { registerBetHandler, pendingBets, roundTracker } = require('./handlers/betHandler');
const { registerDiceHandler } = require('./handlers/diceHandler');

const { registerGroupGameManager } = require('./handlers/groupGameManager');
const { registerTransferHandler } = require('./handlers/transferHandler');
const { registerAngpaoHandler } = require('./handlers/angpaoHandler');

const botToken = process.env.BOT_TOKEN;
const mongoUri = process.env.MONGODB_URI;

if (!botToken) {
  console.error('❌ Bot error: BOT_TOKEN is missing in .env file');
  process.exit(1);
}

if (!mongoUri) {
  console.error('❌ MongoDB error: MONGODB_URI is missing in .env file');
  process.exit(1);
}

const bot = new Telegraf(botToken);

// Connect MongoDB — semua handler dan bot.launch harus di dalam .then()
console.log('⏳ Bot connecting to MongoDB...');
mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 })
  .then(async () => {
    console.log('✅ Bot connected to MongoDB');
    const settingsService = require('../api/services/settingsService');
    await settingsService.loadSettings();

    // Register all handlers (setelah DB ready)
    registerMenuHandler(bot);
    registerBetHandler(bot);
    registerDiceHandler(bot, pendingBets, roundTracker);
    registerGroupGameManager(bot);
    registerTransferHandler(bot);
    registerAngpaoHandler(bot);

    // Start Notify & CS Bot
    require('./notifyBot')(bot, process.env.BOT_TOKEN);
    require('./csBot')();

    // Error handler
    bot.catch((err, ctx) => {
      console.error(`Bot error for ${ctx.updateType}:`, err);
      ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.').catch(() => {});
    });

    // Launch bot
    bot.launch()
      .then(() => console.log('🤖 Bot started!'))
      .catch(err => console.error('Failed to launch bot:', err));
  })
  .catch(err => { 
    console.error('❌ MongoDB connection error:', err.message); 
    process.exit(1); 
  });

// Middleware: auto-create user & detect groups
bot.use(userMiddleware);
bot.use(groupMiddleware);

const forceSubMiddleware = require('./middlewares/forceSubMiddleware');
bot.use(forceSubMiddleware);

// Action handler for checking sub
bot.action('check_sub', async (ctx) => {
  try {
    const Setting = require('../api/models/Setting');
    const settings = await Setting.findOne();
    
    if (!settings?.forceSub?.isActive || !settings.forceSub.channelUsername) {
      await ctx.answerCbQuery('✅ Akses terbuka!');
      await ctx.editMessageText('✅ Akses Bot berhasil dibuka!\n\nKetik /start untuk mulai bermain.');
      return;
    }

    const channelUsername = settings.forceSub.channelUsername;
    const channelUrl = settings.forceSub.channelUrl;
    
    let member;
    try {
      member = await ctx.telegram.getChatMember(channelUsername, ctx.from.id);
    } catch (e) {
      // Bot is not admin or channel not found
      await ctx.answerCbQuery('✅ Akses terbuka!');
      await ctx.editMessageText('✅ Akses Bot berhasil dibuka!\n\nKetik /start untuk mulai bermain.');
      return;
    }

    const status = member.status;
    if (['member', 'administrator', 'creator'].includes(status)) {
      // SUCCESS - user has joined
      const successMsg = settings.strings?.forceSub_success || '✅ <b>Terima kasih sudah bergabung!</b>\n\nAkses Bot berhasil dibuka. Ketik /start atau klik tombol untuk mulai bermain.';
      await ctx.answerCbQuery('✅ Sukses! Akses dibuka.');
      await ctx.editMessageText(successMsg, { parse_mode: 'HTML' });
    } else {
      // User still hasn't joined
      const blockMsg = settings.strings?.forceSub_block || '⚠️ <b>Akses Ditolak!</b>\n\nKamu <b>belum</b> bergabung ke Channel resmi kami. Silakan join dulu, lalu klik tombol di bawah.';
      const keyboard = {
        inline_keyboard: [
          [{ text: '📢 JOIN CHANNEL OFFICIAL', url: channelUrl || `https://t.me/${channelUsername.replace('@', '')}` }],
          [{ text: '✅ SAYA SUDAH JOIN', callback_data: 'check_sub' }]
        ]
      };
      const alertMsg = settings.strings?.forceSub_not_joined_alert || '❌ Kamu belum join channel!';
      await ctx.answerCbQuery(alertMsg, { show_alert: true });
      await ctx.editMessageText(blockMsg, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  } catch (e) {
    console.error('Error in check_sub:', e.message);
    await ctx.answerCbQuery('❌ Terjadi kesalahan. Coba lagi.').catch(() => {});
  }
});

// Track if bot is kicked/added to groups
bot.on('my_chat_member', async (ctx) => {
  if (ctx.chat.type.includes('group')) {
    const status = ctx.update.my_chat_member.new_chat_member.status;
    const Group = require('../api/models/Group');
    const chatId = ctx.chat.id.toString();

    try {
      if (status === 'member' || status === 'administrator') {
        // Auto-add but respect existing DB toggle settings using $setOnInsert
        await Group.findOneAndUpdate(
          { chatId },
          { 
            $set: { title: ctx.chat.title, lastActive: new Date() },
            $setOnInsert: { isActive: true }
          },
          { upsert: true }
        );
      } else if (status === 'kicked' || status === 'left' || status === 'restricted') {
        // Auto-delete so it disappears from Dashboard list
        await Group.deleteOne({ chatId });
      }
    } catch(e) {
      console.error('Error handling my_chat_member update:', e.message);
    }
  }
});

// Graceful shutdown
process.once('SIGINT', () => { try { bot.stop('SIGINT'); } catch(e) {} process.exit(0); });
process.once('SIGTERM', () => { try { bot.stop('SIGTERM'); } catch(e) {} process.exit(0); });

