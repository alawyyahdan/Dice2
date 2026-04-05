'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';

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

export default function ChannelManagerPage() {
  const [channelId, setChannelId] = useState('');
  const [posts, setPosts] = useState([]);
  
  // Composer state
  const [message, setMessage] = useState('');
  const [imageToUpload, setImageToUpload] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Edit state
  const [editingPost, setEditingPost] = useState(null); // the post object
  const [editMessage, setEditMessage] = useState('');

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [resTarget, resPosts] = await Promise.all([
        fetch(`${API_URL}/api/channel/target`, { headers }),
        fetch(`${API_URL}/api/channel/posts`, { headers })
      ]);

      if (resTarget.ok) {
        const data = await resTarget.json();
        setChannelId(data.channelId || '');
      }
      if (resPosts.ok) {
        const data = await resPosts.json();
        setPosts(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  const handleSend = async () => {
    if (!message.trim() && !imageToUpload) return;
    
    setErrorMsg(null);
    setIsSending(true);

    const formData = new FormData();
    formData.append('content', message);
    if (imageToUpload) formData.append('image', imageToUpload.file);

    try {
      const res = await fetch(`${API_URL}/api/channel/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim pesan');

      setMessage('');
      setImageToUpload(null);
      setShowPreview(false);
      fetchData(); // reload posts
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleEdit = async () => {
    if (!editingPost) return;
    try {
      const res = await fetch(`${API_URL}/api/channel/edit/${editingPost._id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ content: editMessage })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengedit');
      
      setEditingPost(null);
      fetchData();
    } catch(err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin ingin menghapus pesan ini dari channel?')) return;
    try {
      const res = await fetch(`${API_URL}/api/channel/delete/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menghapus');
      }
      fetchData();
    } catch(err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">📺 Channel Manager</h1>
        <p className="text-slate-400 mt-2">Kirim dan kelola pesan di Channel Resmi menggunakan bot CS.</p>
        
        {channelId ? (
          <div className="mt-4 inline-flex items-center gap-2 bg-blue-900/40 border border-blue-500/50 px-4 py-2 rounded-xl">
            <span className="text-xl">📢</span>
            <span className="text-slate-300 font-bold text-sm">Target Channel:</span>
            <span className="text-blue-400 font-mono font-black">{channelId}</span>
          </div>
        ) : (
          <div className="mt-4 bg-yellow-900/30 border border-yellow-500/50 p-4 rounded-xl text-yellow-400 text-sm font-bold">
            ⚠️ ID Channel belum diatur. Silakan atur di Pengaturan Game {">"} Force Subscribe, atau sistem tidak bisa mengirim.
          </div>
        )}
      </div>

      {/* Composer Card */}
      <div className="bg-slate-900 border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden">
        {/* Top Section:  Image Preview */}
        {imageToUpload && (
          <div className="p-6 border-b border-slate-800 flex items-start gap-3 bg-slate-800/50">
            <div className="relative flex-shrink-0">
              <img src={imageToUpload.url} alt="preview" className="h-24 w-24 object-cover rounded-xl border border-slate-600 shadow" />
              <button
                onClick={() => setImageToUpload(null)}
                className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs hover:bg-rose-700 shadow-md">
                ✕
              </button>
            </div>
            <div>
              <p className="text-blue-400 font-bold text-sm">📷 Gambar Terlampir</p>
              <p className="text-slate-500 text-xs mt-1">{imageToUpload.file.name}</p>
            </div>
          </div>
        )}

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
              className="min-h-[120px] p-6 text-sm text-slate-200 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message) || '<span class="text-slate-500 italic">Preview kosong...</span>' }}
            />
          ) : (
            <textarea
              ref={textareaRef}
              rows={4}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Tulis pesan untuk channel..."
              className="w-full bg-transparent text-white p-6 focus:outline-none resize-none text-sm leading-relaxed placeholder-slate-600"
            />
          )}
        </div>

        {/* Error info */}
        {errorMsg && (
          <div className="mx-6 mb-4 bg-rose-900/20 border border-rose-500/40 text-rose-400 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
            ❌ {errorMsg}
          </div>
        )}

        {/* Bottom Bar Container */}
        <div className="bg-slate-800/50 p-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={handleSend}
            disabled={isSending || !channelId}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center gap-2"
          >
            {isSending ? '⏳ Mengirim...' : '✈️ Kirim Ke Channel'}
          </button>
        </div>
      </div>

      {/* Timeline Sejarah Postingan */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-white px-2 border-l-4 border-blue-500 mb-6">📜 Riwayat Postingan</h2>
        
        {posts.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500 font-bold">
            Belum ada pesan terkirim ke Channel.
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {posts.map(p => (
            <div key={p._id} className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-xl flex flex-col transition hover:border-slate-600">
              <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold">{new Date(p.createdAt).toLocaleString('id-ID')}</span>
                <span className="bg-slate-900 text-slate-500 px-2 py-1 rounded font-mono">MSG: {p.messageId}</span>
              </div>
              
              <div className="p-5 flex-1 text-sm text-slate-300 space-y-4">
                {p.imageFileId && (
                  <div className="flex justify-center bg-slate-950 p-2 rounded-xl">
                    <img 
                      src={`${API_URL}/api/cs/telegram-image/${p.imageFileId}`} 
                      alt="Media" 
                      className="max-h-40 rounded-lg object-contain shadow border border-slate-800"
                      onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'block'; }}
                    />
                    <div className="hidden text-rose-400/50 text-[10px] uppercase font-bold text-center py-4">Foto Kadaluwarsa</div>
                  </div>
                )}
                
                {editingPost?._id === p._id ? (
                  <textarea
                    rows={4}
                    className="w-full bg-slate-950/50 text-white p-3 rounded-xl focus:outline-none border border-blue-500/50 resize-none"
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                  />
                ) : (
                  <div className="leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.content) }} />
                )}
              </div>

              <div className="p-3 bg-slate-800/50 border-t border-slate-700 flex justify-end gap-2">
                {editingPost?._id === p._id ? (
                  <>
                    <button onClick={() => setEditingPost(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 text-white hover:bg-slate-600">Batal</button>
                    <button onClick={handleEdit} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-500">Simpan Edit</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditingPost(p); setEditMessage(p.content); }} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600/40">✍️ Edit</button>
                    <button onClick={() => handleDelete(p._id)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600/20 text-rose-500 hover:bg-rose-600/40">🗑️ Hapus</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
