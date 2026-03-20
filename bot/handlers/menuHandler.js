const { buildMainMenu } = require('../utils/keyboard');
const settingsService = require('../../api/services/settingsService');
const { miniAppButton } = require('../utils/miniappLink');

function registerMenuHandler(bot) {
  bot.start(async (ctx) => {
    const name = ctx.dbUser?.firstName || ctx.from.first_name || 'Kawan';

    // Welcome flow untuk user baru
    const isRecentlyCreated = ctx.dbUser?.createdAt && (Date.now() - new Date(ctx.dbUser.createdAt).getTime() < 60000);
    const isNew = ctx.isNewUser || isRecentlyCreated;

    if (isNew) {
      try {
        const wImg1 = settingsService.getString('welcomeImage1');
        const wMsg1 = settingsService.getString('welcomeMessage1', { nama: name });
        const wImg2 = settingsService.getString('welcomeImage2');
        const wMsg2 = settingsService.getString('welcomeMessage2', { nama: name });

        if (wImg1 && wImg1.startsWith('http')) {
          await ctx.replyWithPhoto(wImg1, { caption: wMsg1, parse_mode: 'HTML' }).catch(() =>
            ctx.reply(wMsg1, { parse_mode: 'HTML' }).catch(() => {})
          );
        } else if (wMsg1) {
          await ctx.reply(wMsg1, { parse_mode: 'HTML' }).catch(() => {});
        }

        if (wImg2 && wImg2.startsWith('http')) {
          await ctx.replyWithPhoto(wImg2, { caption: wMsg2, parse_mode: 'HTML' }).catch(() =>
            ctx.reply(wMsg2, { parse_mode: 'HTML' }).catch(() => {})
          );
        } else if (wMsg2) {
          await ctx.reply(wMsg2, { parse_mode: 'HTML' }).catch(() => {});
        }
      } catch (e) {}
    }

    // Build menu utama dengan link MiniApp yang benar
    const dynamicKeyboard = buildMainMenu(bot);
    const config = settingsService.getSettings();
    if (config?.isLeaderboardActive !== false) {
      const ldbBtn = miniAppButton(bot, '🏆 Leaderboard', 'leaderboard');
      dynamicKeyboard.reply_markup.inline_keyboard.splice(1, 0, [ldbBtn]);
    }

    await ctx.reply(
      settingsService.getString('welcome', { nama: name }),
      { parse_mode: 'HTML', ...dynamicKeyboard }
    );
  });

  bot.command('menu', async (ctx) => {
    const dynamicKeyboard = buildMainMenu(bot);
    const config = settingsService.getSettings();
    if (config?.isLeaderboardActive !== false) {
      const ldbBtn = miniAppButton(bot, '🏆 Leaderboard', 'leaderboard');
      dynamicKeyboard.reply_markup.inline_keyboard.splice(1, 0, [ldbBtn]);
    }
    await ctx.reply('📋 Menu Utama:', dynamicKeyboard);
  });
}

module.exports = registerMenuHandler;
