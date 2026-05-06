export const EMOJI_LIST = [
  '😊','😂','🤣','❤️','😍','🙏','😭','😘','😅','😁',
  '🔥','✅','👍','🎉','💪','😎','🤔','😢','🥰','😡',
  '💰','🎲','🏆','📢','⚠️','❌','🚀','💬','📱','🔔',
  '👋','🤝','💯','✨','🌟','💎','📊','📈','🎯','🛡️'
];

export const FORMAT_TOOLS = [
  { label: 'B', title: 'Bold', wrap: ['**', '**'], style: 'font-bold' },
  { label: 'I', title: 'Italic', wrap: ['_', '_'], style: 'italic' },
  { label: 'S', title: 'Strikethrough', wrap: ['~~', '~~'], style: 'line-through' },
  { label: '<>', title: 'Code', wrap: ['`', '`'], style: 'font-mono text-xs' },
];

/**
 * Convert markdown-like text ke HTML untuk preview di dashboard
 * @param {string} text
 * @returns {string}
 */
export function renderMarkdown(text) {
  if (!text) return '';
  let esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/~~(.*?)~~/g, '<s>$1</s>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-black/20 px-1 rounded font-mono text-xs">$1</code>')
    .replace(/\n/g, '<br/>');
}
