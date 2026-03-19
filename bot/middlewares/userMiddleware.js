const User = require('../../api/models/User');

const userMiddleware = async (ctx, next) => {
  const from = ctx.from;
  if (!from) return next();

  try {
    let user = await User.findOneAndUpdate(
      { telegramId: String(from.id) },
      {
        $set: {
          username: from.username,
          firstName: from.first_name,
          lastActive: new Date()
        },
        $setOnInsert: {
          telegramId: String(from.id),
          balance: 0,
          totalDeposit: 0,
          turnover: 0,
          turnoverRequired: 0,
          cashback: 0
        }
      },
      { upsert: true, new: true }
    );

    ctx.dbUser = user;
    if (user.isBanned) {
      if (ctx.chat?.type === 'private') {
        return ctx.reply('❌ Anda telah di-banned dari menggunakan layanan bot ini.');
      }
      return; 
    }
    return next();
  } catch (err) {
    console.error('userMiddleware error:', err.message);
    return next();
  }
};

module.exports = userMiddleware;
