/**
 * Convert markdown-like text ke HTML (untuk Telegram & Dashboard)
 * Supports: **bold**, ~~strikethrough~~, _italic_, `code`
 * @param {string} text - Input text
 * @param {object} options
 * @param {boolean} options.convertNewlines - Convert \n ke <br/> (default: false)
 * @returns {string}
 */
function toHtml(text, { convertNewlines = false } = {}) {
  if (!text) return '';
  let result = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/~~(.*?)~~/g, '<s>$1</s>')
    .replace(/_(.*?)_/g, '<i>$1</i>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
  if (convertNewlines) {
    result = result.replace(/\n/g, '<br/>');
  }
  return result;
}

module.exports = { toHtml };
