const Setting = require('../../api/models/Setting');

const forceSubMiddleware = async (ctx, next) => {
  // If no chat or it's not a private message, skip this middleware
  if (!ctx.chat || ctx.chat.type !== 'private') {
    return next();
  }

  // If this is a callback query specifically for checking sub, skip running the block again so it can be handled
  if (ctx.callbackQuery && ctx.callbackQuery.data === 'check_sub') {
    return next();
  }

  try {
    const settings = await Setting.findOne();
    if (!settings || !settings.forceSub || !settings.forceSub.isActive) {
      return next(); // Not active
    }

    const channelUsername = settings.forceSub.channelUsername; // e.g. '@MyChannel'
    const channelLink = settings.forceSub.channelUrl; // e.g. 'https://t.me/MyChannel'
    
    if (!channelUsername) return next();

    // Check membership
    const member = await ctx.telegram.getChatMember(channelUsername, ctx.from.id);
    const status = member.status;

    if (['member', 'administrator', 'creator'].includes(status)) {
      // User is subscribed, continue handling
      return next();
    } else {
      // Not subscribed, block interaction and show force sub message
      const text = settings.strings?.forceSub_block || `⚠️ <b>Akses Ditolak!</b>\n\nUntuk menggunakan Bot ini dan bermain, kamu <b>WAJIB</b> berlangganan / join ke Channel Info Resmi kami terlebih dahulu.\n\nSilakan join melalui tombol di bawah, lalu klik <b>✅ SAYA SUDAH JOIN</b>.`;
      const btnJoin = settings.strings?.forceSub_btn_join || '📢 JOIN CHANNEL OFFICIAL';
      const btnCheck = settings.strings?.forceSub_btn_check || '✅ SAYA SUDAH JOIN';
      
      const keyboard = {
        inline_keyboard: [
          [{ text: btnJoin, url: channelLink || `https://t.me/${channelUsername.replace('@', '')}` }],
          [{ text: btnCheck, callback_data: 'check_sub' }]
        ]
      };

      if (ctx.callbackQuery) {
        return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        return ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    }
  } catch (err) {
    console.error('ForceSub Error (Bot might not be admin in channel):', err.message);
    // If bot is not admin in channel, or other error, let it pass rather than perma-blocking the user
    return next();
  }
};

module.exports = forceSubMiddleware;
