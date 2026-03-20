const { Markup } = require('telegraf');
const { miniAppButton } = require('./miniappLink');
const settingsService = require('../../api/services/settingsService');

/**
 * Build keyboard menu utama.
 * Perlu bot instance agar bisa generate link yang benar.
 */
function buildMainMenu(bot) {
  const wdBtn      = miniAppButton(bot, '💸 WD / Deposit', 'withdraw');
  const saldoBtn   = miniAppButton(bot, '📊 Saldo', 'withdraw');
  const historyBtn = miniAppButton(bot, '📜 History', 'history');

  const toMarkup = (b) => b.type === 'web_app'
    ? Markup.button.webApp(b.text, b.url)
    : Markup.button.url(b.text, b.url);

  const cfg = settingsService.getSettings();
  const groupUrl = cfg?.strings?.group_link || process.env.GROUP_LINK || 'https://t.me/yourgrouplink';
  const csRaw = cfg?.strings?.cs_contact_link || process.env.CS_USERNAME || '@cs';
  const csUrl = csRaw.startsWith('http') ? csRaw : `https://t.me/${csRaw.replace('@', '')}`;

  return Markup.inlineKeyboard([
    [
      toMarkup(saldoBtn),
      toMarkup(historyBtn)
    ],
    [
      toMarkup(wdBtn),
      Markup.button.url('👥 Ke Grup', groupUrl)
    ],
    [
      Markup.button.url('📞 Kontak CS', csUrl)
    ]
  ]);
}


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

module.exports = { buildMainMenu, rollChoiceKeyboard, rollDiceReplyKeyboard, removeRollKeyboard };
