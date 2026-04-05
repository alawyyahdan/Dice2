'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Emoji data
const EMOJI_LIST = [
  '😊','😂','🤣','❤️','😍','🙏','😭','😘','😅','😁',
  '🔥','✅','👍','🎉','💪','😎','🤔','😢','🥰','😡',
  '💰','🎲','🏆','📢','⚠️','❌','🚀','💬','📱','🔔',
  '👋','🤝','💯','✨','🌟','💎','📊','📈','🎯','🛡️'
];

const FORMAT_TOOLS = [
  { label: 'B', title: 'Bold', wrap: ['**', '**'], style: 'font-bold' },
  { label: 'I', title: 'Italic', wrap: ['_', '_'], style: 'italic' },
  { label: 'S', title: 'Strikethrough', wrap: ['~~', '~~'], style: 'line-through' },
  { label: '<>', title: 'Code', wrap: ['`', '`'], style: 'font-mono text-xs' },
];

function getToken() {
  return document.cookie.match(/(?:^|; )admin_token=([^;]*)/)?.[1]
    ? decodeURIComponent(document.cookie.match(/(?:^|; )admin_token=([^;]*)/)[1])
    : null;
}

// Markdown → HTML preview (for live preview in the composer)
function renderMarkdown(text) {
  if (!text) return '';
  let esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/~~(.*?)~~/g, '<s>$1</s>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-black/20 px-1 rounded font-mono text-xs">$1</code>')
    .replace(/\n/g, '<br/>');
}

const TARGET_OPTIONS = [
  { value: 'users', label: '👤 Semua Private Chat User', color: 'blue' },
  { value: 'groups', label: '🏢 Semua Grup Aktif', color: 'green' },
  { value: 'both', label: '🌐 Semua (User + Grup)', color: 'purple' },
];

export default function BroadcastPage() {
  const [targetType, setTargetType] = useState('users');
  const [message, setMessage] = useState('');
  const [imageToUpload, setImageToUpload] = useState(null); // { file, url }
  const [broadcasts, setBroadcasts] = useState([]);
  const [broadcasting, setBroadcasting] = useState(false);
  const [progress, setProgress] = useState(null); // { id, sentCount, failedCount, targetCount, status, failedDetails }
  const [expandedFailed, setExpandedFailed] = useState(null); // broadcast _id yg lagi di-expand
  const [showEmoji, setShowEmoji] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [socket, setSocket] = useState(null);
  
  // State for HTML history preview modal
  const [historyPreview, setHistoryPreview] = useState(null); // { message, imageFileId }

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const fetchBroadcasts = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/broadcast`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setBroadcasts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { fetchBroadcasts(); }, [fetchBroadcasts]);

  // Socket for real-time broadcast progress
  useEffect(() => {
    const newSocket = io(API_URL);
    setSocket(newSocket);
    newSocket.on('connect', () => newSocket.emit('join_admin'));
    newSocket.on('broadcast_progress', (data) => {
      setProgress(prev => ({
        ...(prev || {}),
        ...data,
        // Merge failedDetails biar nggak hilang kalau parse partial
        failedDetails: data.failedDetails || (prev?.failedDetails || [])
      }));
      if (data.status === 'done') {
        fetchBroadcasts();
        setTimeout(() => setProgress(null), 8000); // Tutup setelah 8 detik
      }
    });
    return () => newSocket.disconnect();
  }, [fetchBroadcasts]);

  const insertAtCursor = (before, after = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = message.slice(start, end);
    const newVal = message.slice(0, start) + before + selected + after + message.slice(end);
    setMessage(newVal);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const insertEmoji = (emoji) => {
    const ta = textareaRef.current;
    if (!ta) { setMessage(v => v + emoji); return; }
    const pos = ta.selectionStart;
    setMessage(v => v.slice(0, pos) + emoji + v.slice(pos));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(pos + emoji.length, pos + emoji.length); }, 0);
    setShowEmoji(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return alert('Maks 10MB');
    setImageToUpload({ file, url: URL.createObjectURL(file) });
    e.target.value = '';
  };

  const handleBroadcast = async () => {
    if (!message.trim() && !imageToUpload) return;
    if (!confirm(`⚠️ Broadcast akan dikirim ke SEMUA target. Yakin lanjutkan?`)) return;

    setSendError(null);
    setBroadcasting(true);
    setProgress(null);

    const formData = new FormData();
    formData.append('type', targetType);
    formData.append('message', message);
    if (imageToUpload) formData.append('image', imageToUpload.file);

    try {
      const res = await fetch(`${API_URL}/api/broadcast/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Broadcast gagal dimulai');

      // Reset form
      setMessage('');
      setImageToUpload(null);
      setShowPreview(false);
      setProgress({ id: data.broadcast._id, sentCount: 0, failedCount: 0, targetCount: data.broadcast.targetCount, failedDetails: [] });
    } catch (err) {
      setSendError(err.message);
    } finally {
      setBroadcasting(false);
    }
  };

  const progressPct = progress ? Math.round((progress.sentCount / Math.max(progress.targetCount, 1)) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">📢 Broadcast Sender</h1>
        <p className="text-slate-400 mt-2">Kirim pesan massal ke seluruh user bot dan grup terafiliasi.</p>
      </div>

      {/* Composer Card */}
      <div className="bg-slate-900 border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Top Section: Target + Image Preview */}
        <div className="p-6 border-b border-slate-800 space-y-4">
          {/* Target selector */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Target Broadcast</label>
            <div className="flex gap-2 flex-wrap">
              {TARGET_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTargetType(opt.value)}
                  className={`px-4 py-2 rounded-xl font-bold text-sm transition-all border ${
                    targetType === opt.value
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Inline Image Preview */}
          {imageToUpload && (
            <div className="flex items-start gap-3 bg-slate-800 rounded-2xl p-3 border border-blue-500/40">
              <div className="relative flex-shrink-0">
                <img src={imageToUpload.url} alt="preview" className="h-24 w-24 object-cover rounded-xl" />
                <button
                  onClick={() => setImageToUpload(null)}
                  className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs hover:bg-rose-700 shadow-md">
                  ✕
                </button>
              </div>
              <div>
                <p className="text-blue-400 font-bold text-sm">📷 Gambar Terlampir</p>
                <p className="text-slate-500 text-xs mt-1">{imageToUpload.file.name}</p>
                <p className="text-slate-500 text-xs">{(imageToUpload.file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          )}
        </div>

        {/* Format Toolbar */}
        <div className="px-6 pt-4 pb-2 flex items-center gap-1 flex-wrap border-b border-slate-800">
          {FORMAT_TOOLS.map(tool => (
            <button key={tool.label}
              title={tool.title}
              onClick={() => insertAtCursor(tool.wrap[0], tool.wrap[1])}
              className={`w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-sm flex items-center justify-center ${tool.style}`}>
              {tool.label}
            </button>
          ))}
          <div className="h-5 w-px bg-slate-700 mx-1" />
          <button
            onClick={() => setShowEmoji(v => !v)}
            className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition ${showEmoji ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'}`}>
            😊
          </button>
          <div className="h-5 w-px bg-slate-700 mx-1" />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Lampirkan Gambar"
            className={`w-8 h-8 rounded-lg transition text-base flex items-center justify-center ${imageToUpload ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'}`}>
            📎
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          <div className="h-5 w-px bg-slate-700 mx-1" />
          <button
            onClick={() => setShowPreview(v => !v)}
            className={`px-3 h-8 rounded-lg text-xs font-bold transition ${showPreview ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/40' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            👁️ Preview
          </button>
          <span className="ml-auto text-[10px] text-slate-600 font-mono">**bold** _italic_ ~~coret~~ `code`</span>
        </div>

        {/* Emoji Panel */}
        {showEmoji && (
          <div className="px-6 py-2 border-b border-slate-800 bg-slate-900/80">
            <div className="flex flex-wrap gap-1">
              {EMOJI_LIST.map(e => (
                <button key={e} onClick={() => insertEmoji(e)}
                  className="w-8 h-8 text-lg hover:bg-slate-700 rounded-lg transition flex items-center justify-center">
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Textarea + Preview */}
        <div className="relative">
          {showPreview ? (
            <div
              className="min-h-[160px] p-6 text-sm text-slate-200 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message) || '<span class="text-slate-500 italic">Preview kosong...</span>' }}
            />
          ) : (
            <textarea
              ref={textareaRef}
              rows={6}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={imageToUpload ? "Ketik caption gambar... (opsional)" : "Ketik pesan broadcast di sini...\n\nSupport: **bold**, _italic_, ~~coret~~, `kode`"}
              className="w-full bg-transparent text-white p-6 focus:outline-none resize-none text-sm leading-relaxed placeholder-slate-600"
            />
          )}
        </div>

        {/* Error info */}
        {sendError && (
          <div className="mx-6 mb-4 bg-rose-900/20 border border-rose-500/40 text-rose-400 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
            ❌ {sendError}
          </div>
        )}

        {/* Progress Bar */}
        {progress && (
          <div className="mx-6 mb-4 bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className={progress.status === 'done' ? 'text-green-400' : 'text-blue-400'}>
                {progress.status === 'done' ? '✅ Broadcast Selesai!' : '⏳ Mengirim broadcast...'}
              </span>
              <span className="text-slate-400 font-mono">
                {progress.sentCount}/{progress.targetCount}
                {progress.failedCount > 0 && <span className="text-rose-400 ml-2">Gagal: {progress.failedCount}</span>}
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progress.status === 'done' ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {/* Detailed Failures */}
            {progress.failedDetails && progress.failedDetails.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-xl bg-slate-900/60 border border-rose-500/20">
                <div className="px-3 py-1.5 bg-rose-900/20 border-b border-rose-500/20">
                  <span className="text-rose-400 text-xs font-black">⚠️ Detail Kegagalan ({progress.failedDetails.length})</span>
                </div>
                {progress.failedDetails.map((f, i) => (
                  <div key={i} className="px-3 py-2 border-b border-slate-800/60 last:border-0 flex items-start gap-3">
                    <span className="text-slate-300 text-xs font-bold flex-shrink-0 w-36 truncate" title={f.name}>{f.name}</span>
                    <span className="text-rose-400 text-xs">{f.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Send Button */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleBroadcast}
            disabled={broadcasting || (!message.trim() && !imageToUpload)}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-900/30 transition-all flex justify-center items-center gap-3 disabled:cursor-not-allowed"
          >
            {broadcasting ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                Memasukkan ke Antrean...
              </span>
            ) : (
              '🚀 KIRIM BROADCAST SEKARANG'
            )}
          </button>
        </div>
      </div>

      {/* History Table */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-black text-white">⏱️ Riwayat Broadcast</h2>
          <button onClick={fetchBroadcasts} className="text-xs text-slate-500 hover:text-slate-300 transition font-bold bg-slate-800 px-3 py-1.5 rounded-lg">
            🔄 Refresh
          </button>
        </div>
        <div className="bg-slate-900 border border-slate-700/60 rounded-3xl overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-400 uppercase text-xs tracking-wider">
                <th className="px-5 py-3 font-bold">Waktu</th>
                <th className="px-5 py-3 font-bold">Target</th>
                <th className="px-5 py-3 font-bold">Pesan</th>
                <th className="px-5 py-3 font-bold text-center">Terkirim</th>
                <th className="px-5 py-3 font-bold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-300 divide-y divide-slate-800/60">
              {broadcasts.map(b => (
                <React.Fragment key={b._id}>
                  <tr className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                      {new Date(b.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-black uppercase ${
                        b.type === 'users' ? 'bg-blue-500/20 text-blue-400' :
                        b.type === 'groups' ? 'bg-green-500/20 text-green-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>
                        {b.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 max-w-[220px] truncate text-slate-400">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate">
                          {b.imageFileId && b.imageFileId !== 'pending' ? '📷 ' : ''}
                          {b.message || <em className="text-slate-600">(hanya gambar)</em>}
                        </div>
                        <button
                          onClick={() => setHistoryPreview({ message: b.message, imageFileId: b.imageFileId })}
                          className="bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40 px-2 py-1 rounded text-[10px] font-bold shrink-0 transition"
                        >
                          👁️ View
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center whitespace-nowrap">
                      <span className="font-mono font-bold text-green-400">{b.sentCount}</span>
                      <span className="text-slate-600 mx-1">/</span>
                      <span className="font-mono text-slate-400">{b.targetCount}</span>
                      {b.failedCount > 0 && (
                        <div className="text-rose-400 text-xs font-bold">Gagal: {b.failedCount}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                        b.status === 'done' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {b.status === 'done' ? '✅ Done' : '⏳ Sending'}
                      </span>
                      {b.failedCount > 0 && b.failedDetails?.length > 0 && (
                        <button
                          onClick={() => setExpandedFailed(expandedFailed === b._id ? null : b._id)}
                          className="block mt-1 mx-auto text-[10px] text-rose-400 hover:text-rose-300 underline font-bold">
                          {expandedFailed === b._id ? 'Sembunyikan' : `Lihat ${b.failedDetails.length} Gagal`}
                        </button>
                      )}
                    </td>
                  </tr>
                  {/* Expandable row detail gagal */}
                  {expandedFailed === b._id && b.failedDetails?.length > 0 && (
                    <tr className="bg-rose-900/5">
                      <td colSpan="5" className="px-5 pb-4">
                        <div className="rounded-xl border border-rose-500/20 overflow-hidden">
                          <div className="bg-rose-900/20 px-4 py-2 text-xs font-black text-rose-400 border-b border-rose-500/20">
                            ⚠️ Detail Kegagalan ({b.failedDetails.length} target)
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {b.failedDetails.map((f, i) => (
                              <div key={i} className="px-4 py-2 border-b border-slate-800/40 last:border-0 flex items-center gap-4 hover:bg-slate-800/30">
                                <span className="text-slate-400 text-xs w-6 shrink-0">{i + 1}.</span>
                                <span className="text-slate-200 text-xs font-bold w-48 shrink-0 truncate" title={f.name}>{f.name}</span>
                                <span className="text-slate-500 font-mono text-xs w-32 shrink-0">{f.chatId}</span>
                                <span className="text-rose-400 text-xs truncate flex-1" title={f.reason}>{f.reason}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {broadcasts.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-5 py-12 text-center text-slate-600 font-bold">
                    Belum ada histori broadcast
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* History Preview Modal */}
      {historyPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setHistoryPreview(null)}>
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-200">👁️ Preview Pesan</h3>
              <button 
                onClick={() => setHistoryPreview(null)}
                className="text-slate-400 hover:text-white rounded-full w-6 h-6 flex items-center justify-center bg-slate-700 hover:bg-rose-500 transition"
              >
                ✕
              </button>
            </div>
            <div className="p-4 text-sm text-slate-200 leading-relaxed max-h-[60vh] overflow-y-auto">
              {historyPreview.imageFileId && historyPreview.imageFileId !== 'pending' && (
                <div className="mb-4 flex justify-center">
                  <img 
                    src={`${API_URL}/api/cs/telegram-image/${historyPreview.imageFileId}`} 
                    alt="Media Terlampir" 
                    className="max-w-full max-h-64 object-contain rounded-xl border border-slate-700 shadow-lg bg-slate-900" 
                    onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'block'; }}
                  />
                  <div className="hidden text-rose-400 text-xs font-bold bg-rose-900/20 px-4 py-2 rounded-lg border border-rose-500/20">
                    ❌ Gambar sudah kadaluwarsa di server Telegram
                  </div>
                </div>
              )}
              {historyPreview.message ? (
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(historyPreview.message) }} />
              ) : (
                <span className="text-slate-500 italic">Hanya mengirim gambar tanpa caption.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
