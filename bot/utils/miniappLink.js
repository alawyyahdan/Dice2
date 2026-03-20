/**
 * Utility untuk generate link MiniApp yang benar.
 *
 * - Jika MINIAPP_URL diset: gunakan web_app button (overlay langsung, hanya di private chat)
 * - Jika MINIAPP_URL kosong: gunakan t.me/bot?startapp=tab (overlay dialog, works di private & grup)
 *
 * @param {object} bot - Telegraf bot instance (untuk ambil username)
 * @param {string} tab - Nama tab tujuan: 'withdraw', 'deposit', 'history', 'leaderboard', dll
 * @returns {{ type: 'web_app'|'url', url: string }} object yang bisa dipakai sebagai button
 */
function getMiniAppLink(bot, tab = '') {
  const miniappUrl = (process.env.MINIAPP_URL || '').trim();

  if (miniappUrl) {
    // Mode: MINIAPP_URL diset → web_app button (buka overlay langsung, private chat)
    const url = tab ? `${miniappUrl.replace(/\/$/, '')}?tab=${tab}` : miniappUrl;
    return { type: 'web_app', url };
  }

  // Mode: MINIAPP_URL kosong → gunakan t.me link (buka overlay dialog, private & grup)
  const botUsername = bot?.botInfo?.username || process.env.BOT_USERNAME || '';
  const appShortname = (process.env.MINIAPP_SHORTNAME || '').trim();

  let url;
  if (appShortname) {
    url = `https://t.me/${botUsername}/${appShortname}${tab ? `?startapp=${tab}` : ''}`;
  } else {
    url = `https://t.me/${botUsername}${tab ? `?startapp=${tab}` : ''}`;
  }

  return { type: 'url', url };
}

/**
 * Build inline keyboard button untuk MiniApp
 * @param {object} bot
 * @param {string} label - Label tombol
 * @param {string} tab - Nama tab
 */
function miniAppButton(bot, label, tab = '') {
  const { type, url } = getMiniAppLink(bot, tab);
  if (type === 'web_app') {
    return { text: label, web_app: { url } };
  }
  return { text: label, url };
}

module.exports = { getMiniAppLink, miniAppButton };
