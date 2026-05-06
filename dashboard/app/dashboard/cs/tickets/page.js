'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '@/lib/auth';
import { EMOJI_LIST, FORMAT_TOOLS, renderMarkdown } from '@/lib/constants';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function apiFetch(path, opts = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {})
    }
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(e.error || 'Request failed');
  }
  return res.json();
}

export default function TicketChat() {
  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState('all');
  const [socket, setSocket] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [imageToUpload, setImageToUpload] = useState(null); // { file, url }
  const [sending, setSending] = useState(false);
  const [lightbox, setLightbox] = useState(null); // url to show in lightbox

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchTickets = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/cs/tickets?status=${filter}`);
      setTickets(data);
    } catch (err) { console.error(err); }
  }, [filter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // Socket connection & Reconnection logic
  useEffect(() => {
    const newSocket = io(API_URL, {
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    setSocket(newSocket);
    
    newSocket.on('connect', () => {
      console.log('✅ Socket connected, joining admins room...');
      newSocket.emit('join_admin');
    });

    newSocket.on('reconnect', () => {
      console.log('🔄 Socket reconnected, re-joining admins room...');
      newSocket.emit('join_admin');
    });

    return () => newSocket.disconnect();
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('new_ticket', (data) => {
      // Masukin ke list, pastiin paling atas
      setTickets(prev => {
        const exists = prev.find(t => t._id === data.ticket._id);
        if (exists) return prev;
        return [data.ticket, ...prev];
      });
    });

    socket.on('new_message', (data) => {
      // Update waktu dan move to top
      setTickets(prev => {
        const target = prev.find(t => t._id === data.ticketId);
        if (!target) {
          // Kalau tiketnya nggak ada di list (mungkin karena filter), re-fetch aja biar aman
          fetchTickets();
          return prev;
        }
        
        // Update ticket di list: pastikan status jadi open (karena user chat lagi)
        return [...prev.map(t => 
          t._id === data.ticketId 
            ? { ...t, lastMessageAt: new Date().toISOString(), status: 'open' } 
            : t
        )].sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      });

      setActiveTicket(active => {
        if (active && active._id === data.ticketId) {
          setMessages(prev => {
            if (prev.find(m => m._id === data.message._id)) return prev;
            return [...prev, data.message];
          });
          // Pastikan active status juga jadi open
          return { ...active, status: 'open' };
        }
        return active;
      });
    });

    socket.on('ticket_closed', (data) => {
      setTickets(prev => prev.map(t => t._id === data.ticketId ? { ...t, status: 'closed' } : t));
      setActiveTicket(active => active && active._id === data.ticketId ? { ...active, status: 'closed' } : active);
    });

    return () => { 
      socket.off('new_ticket'); 
      socket.off('new_message'); 
      socket.off('ticket_closed'); 
      socket.off('connect');
      socket.off('reconnect');
    };
  }, [socket, fetchTickets]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const loadTicket = async (ticket) => {
    setActiveTicket(ticket);
    setShowEmoji(false);
    setImageToUpload(null);
    try {
      const msgs = await apiFetch(`/api/cs/tickets/${ticket._id}/messages`);
      setMessages(msgs);
    } catch (err) { console.error(err); }
  };

  // Insert text at cursor position
  const insertAtCursor = (before, after = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = inputValue.slice(start, end);
    const newVal = inputValue.slice(0, start) + before + selected + after + inputValue.slice(end);
    setInputValue(newVal);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const insertEmoji = (emoji) => {
    const ta = textareaRef.current;
    if (!ta) { setInputValue(v => v + emoji); return; }
    const pos = ta.selectionStart;
    setInputValue(v => v.slice(0, pos) + emoji + v.slice(pos));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(pos + emoji.length, pos + emoji.length); }, 0);
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!activeTicket || activeTicket.status === 'closed' || sending) return;
    
    // Check if there is content to send (either text or image)
    if (!inputValue.trim() && !imageToUpload) return;

    setSending(true);
    
    try {
      if (imageToUpload) {
        // Send Image with potential caption (inputValue)
        const formData = new FormData();
        formData.append('image', imageToUpload.file);
        if (inputValue.trim()) formData.append('caption', inputValue.trim());

        const token = getToken();
        const res = await fetch(`${API_URL}/api/cs/tickets/${activeTicket._id}/reply/image`, {
          method: 'POST',
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: formData
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Upload gagal');
        setImageToUpload(null);
        setInputValue('');
      } else {
        // Send Text only
        const text = inputValue;
        setInputValue('');
        await apiFetch(`/api/cs/tickets/${activeTicket._id}/reply`, {
          method: 'POST',
          body: JSON.stringify({ text })
        });
      }
    } catch (err) {
      alert('Gagal kirim: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  // Image file selected → show preview inline
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return alert('Maks 10MB');
    const url = URL.createObjectURL(file);
    setImageToUpload({ file, url });
    e.target.value = ''; // reset input
    textareaRef.current?.focus();
  };

  const closeTicket = async () => {
    if (!confirm('Tutup tiket ini?')) return;
    try { await apiFetch(`/api/cs/tickets/${activeTicket._id}/close`, { method: 'POST' }); }
    catch (err) { alert('Error: ' + err.message); }
  };

  const getImageSrc = (msg) => {
    if (msg.imageUrl) return msg.imageUrl;
    if (msg.imageFileId) return `${API_URL}/api/cs/telegram-image/${msg.imageFileId}`;
    return null;
  };

  return (
    <>
      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="preview" className="max-w-full max-h-full rounded-xl shadow-2xl object-contain" />
          <button className="absolute top-4 right-4 text-white text-3xl font-bold hover:text-red-400">✕</button>
        </div>
      )}

      <div className="h-[calc(100vh-120px)] flex bg-slate-800 rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50">

        {/* ===== LEFT: Ticket List ===== */}
        <div className="w-80 min-w-[240px] border-r border-slate-700 bg-slate-900 flex flex-col">
          <div className="p-4 pb-3 border-b border-slate-800">
            <h2 className="text-lg font-black text-white mb-3">💬 Live Support</h2>
            <div className="flex gap-2 text-xs">
              {['all','open','closed'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`flex-1 py-1.5 rounded-full font-black uppercase tracking-wide transition ${filter === f
                    ? f === 'open' ? 'bg-green-600 text-white' : f === 'closed' ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {tickets.length === 0 && (
              <div className="p-6 text-center text-slate-500 font-bold text-sm">Belum ada tiket</div>
            )}
            {tickets.map(t => (
              <div key={t._id} onClick={() => loadTicket(t)}
                className={`p-4 border-b border-slate-800/60 cursor-pointer transition-all ${
                  activeTicket?._id === t._id
                    ? 'bg-slate-800 border-l-4 border-l-blue-500'
                    : 'hover:bg-slate-800/50'
                }`}>
                <div className="flex justify-between items-start mb-0.5">
                  <span className="font-bold text-white text-sm truncate">{t.firstName || t.username || 'User'}</span>
                  <span className="text-[10px] text-slate-500 ml-2 flex-shrink-0">
                    {new Date(t.lastMessageAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-blue-400 font-mono">{t.referenceId}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-black ${t.status === 'open' ? 'bg-green-500/20 text-green-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {t.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== RIGHT: Chat ===== */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeTicket ? (
            <>
              {/* Chat Header */}
              <div className="border-b border-slate-700 bg-slate-800/90 backdrop-blur px-5 py-3 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                    {activeTicket.firstName || activeTicket.username || 'User'}
                    <span className="bg-slate-700 px-2 py-0.5 rounded text-[10px] font-mono text-slate-400">
                      UID: {activeTicket.telegramId}
                    </span>
                  </h3>
                  <p className="text-[11px] font-mono text-blue-400 mt-0.5">{activeTicket.referenceId}</p>
                </div>
                {activeTicket.status === 'open' && (
                  <button onClick={closeTicket}
                    className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow transition-transform hover:scale-105">
                    ✅ Tutup Tiket
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4"
                style={{ backgroundImage: 'radial-gradient(circle, #1e293b 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                {messages.map((m, i) => {
                  const isAdmin = m.senderModel === 'Admin';
                  const imgSrc = getImageSrc(m);
                  return (
                    <div key={i} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl overflow-hidden shadow-lg ${
                        isAdmin
                          ? 'bg-blue-600 text-white rounded-tr-sm'
                          : 'bg-slate-700 text-slate-200 border border-slate-600/50 rounded-tl-sm'
                      }`}>
                        {imgSrc ? (
                          <div className="relative group">
                            <img
                              src={imgSrc}
                              alt="attachment"
                              className="max-w-full max-h-64 cursor-zoom-in object-cover hover:opacity-90 transition"
                              onClick={() => setLightbox(imgSrc)}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                              }}
                            />
                            <div className="hidden items-center gap-2 p-3 text-sm opacity-70">
                              🖼️ Gambar tidak tersedia atau kadaluwarsa
                            </div>
                            {m.content && (
                              <p className="px-4 py-2 text-sm border-t border-white/10" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                            )}
                          </div>
                        ) : (
                          <p className="px-4 py-3 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 font-medium">
                        {new Date(m.createdAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              {activeTicket.status === 'closed' ? (
                <div className="p-4 bg-slate-900 border-t border-slate-700 text-center text-rose-400 font-bold text-sm bg-rose-900/10">
                  🔒 Tiket ditutup — tidak bisa membalas pesan
                </div>
              ) : (
                <div className="bg-slate-900 border-t border-slate-700 flex-shrink-0">

                  {/* Inline Image Preview */}
                  {imageToUpload && (
                    <div className="px-4 pt-4">
                      <div className="relative inline-block border-2 border-blue-500 rounded-xl overflow-hidden shadow-xl bg-slate-800">
                        <img src={imageToUpload.url} alt="upload preview" className="h-32 w-auto object-contain" />
                        <button
                          onClick={() => setImageToUpload(null)}
                          className="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs hover:bg-rose-700 shadow-md">
                          ✕
                        </button>
                        <div className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 text-center uppercase tracking-tighter">
                          Siap Kirim
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Format Toolbar */}
                  <div className="px-4 pt-3 pb-2 flex items-center gap-1 border-b border-slate-800">
                    {FORMAT_TOOLS.map(tool => (
                      <button key={tool.label}
                        title={tool.title}
                        onClick={() => insertAtCursor(tool.wrap[0], tool.wrap[1])}
                        className={`w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-sm flex items-center justify-center ${tool.style}`}>
                        {tool.label}
                      </button>
                    ))}
                    <div className="h-5 w-px bg-slate-700 mx-1" />
                    {/* Emoji toggle */}
                    <button
                      onClick={() => setShowEmoji(v => !v)}
                      className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition ${showEmoji ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'}`}>
                      😊
                    </button>
                    <div className="h-5 w-px bg-slate-700 mx-1" />
                    {/* Image tool */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      title="Lampirkan Gambar"
                      className={`w-8 h-8 rounded-lg transition text-base flex items-center justify-center ${imageToUpload ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'}`}>
                      📎
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

                    <span className="ml-auto text-[10px] text-slate-600 font-mono">Enter = kirim • Shift+Enter = baris baru</span>
                  </div>

                  {/* Emoji Panel */}
                  {showEmoji && (
                    <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/80">
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

                  {/* Text Input */}
                  <div className="p-3 flex gap-3 items-end">
                    <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-shadow">
                      <textarea
                        ref={textareaRef}
                        rows="3"
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        placeholder={imageToUpload ? "Ketik caption gambar..." : "Ketik Balasan... (Markdown: **bold**, _italic_)"}
                        className="w-full bg-transparent text-white p-3 focus:outline-none resize-none text-sm leading-relaxed"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                      />
                    </div>
                    <button
                      onClick={handleSend}
                      disabled={(!inputValue.trim() && !imageToUpload) || sending}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-5 py-3 rounded-xl font-black text-sm shadow-lg transition-all hover:scale-105 active:scale-95 self-end">
                      {sending ? '⏳' : '🚀'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <div className="text-6xl mb-4 opacity-30 animate-pulse">💬</div>
              <p className="font-bold text-lg">Pilih tiket di sebelah kiri</p>
              <p className="text-sm mt-2 text-slate-600 max-w-xs text-center">Keluhan user masuk secara real-time tanpa perlu refresh</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
