const { Markup } = require('telegraf');

const mainMenuKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('📊 Saldo', 'menu_saldo'),
    Markup.button.callback('📜 History Taruhan', 'menu_history')
  ],
  [
    Markup.button.webApp('💸 Withdraw', process.env.MINIAPP_URL || 'https://yourdomain.com/miniapp'),
    Markup.button.url('👥 Ke Grup', process.env.GROUP_LINK || 'https://t.me/yourgrouplink')
  ],
  [
    Markup.button.url('📞 Kontak CS', `https://t.me/${(process.env.CS_USERNAME || '@cs').replace('@', '')}`)
  ]
]);

const rollChoiceKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('🎲 Saya yang Roll', 'roll_user'),
    Markup.button.callback('🤖 Bot yang Roll', 'roll_bot')
  ]
]);

// Reply Keyboard tombol dadu — muncul di bawah area input chat
const rollDiceReplyKeyboard = Markup.keyboard([
  ['🎲']
]).resize();

// Hapus Reply Keyboard setelah selesai
const removeRollKeyboard = Markup.removeKeyboard();

module.exports = { mainMenuKeyboard, rollChoiceKeyboard, rollDiceReplyKeyboard, removeRollKeyboard };
