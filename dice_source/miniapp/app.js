const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Atur warnanya
tg.setHeaderColor('#0f172a');
tg.setBackgroundColor('#0f172a');

const API_URL = ''; // Autodetect origin
let currentInitData = tg.initData;

let userInfo = null;
let currentUser = null;
let selectedBankIndex = -1;

// Tabs
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  // Find the button that triggers this tab and make it active
  const triggerBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick') === `switchTab('${tabId}')`);
  if (triggerBtn) triggerBtn.classList.add('active');

  document.getElementById(`tab-${tabId}`).classList.add('active');

  if (tabId === 'history') loadHistory();
  if (tabId === 'history-depo') loadDepoHistory();
  if (tabId === 'guide') loadGuide();
}

async function loadGuide() {
  const container = document.getElementById('guide-table-container');
  try {
    const res = await fetch(`${API_URL}/api/settings/public`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const O = data.odds;
    const B = data.bounds;

    const list = [
      { code: 'B / K', name: 'Besar / Kecil', odds: O.standard, max: B.maxStandard },
      { code: 'GA / GE', name: 'Ganjil / Genap', odds: O.standard, max: B.maxStandard },
      { code: 'BGA / KGE', name: 'Besar Gnjil / Kcil Gnap', odds: O.BGA_KGE, max: B.maxKombinasi },
      { code: 'BGE / KGA', name: 'Besar Genap / Kcil Gnjil', odds: O.BGE_KGA, max: B.maxKombinasi },
      { code: 'J4/J17', name: 'Jumlah Dadu 4 / 17', odds: O.J4_17, max: B.maxJ4_17 },
      { code: 'T', name: 'Triple Sembarang', odds: O.T, max: B.maxT },
      { code: 'L', name: 'Lurus (ex: 2,3,4)', odds: O.L, max: B.maxL },
      { code: 'P', name: 'Pasangan (2 Kembar)', odds: O.P, max: B.maxP },
      { code: 'TS', name: 'Triple Spesifik (ex: 5,5,5)', odds: O.TS, max: B.maxTS },
      { code: 'N / H', name: 'Naga / Harimau', odds: O.N_H, max: B.maxTie },
      { code: 'S', name: 'Seri', odds: O.S, max: B.maxTie },
    ];

    let html = `<div style="overflow-x:auto; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; margin-top: 10px;">
      <table style="width:100%; text-align:left; border-collapse: collapse; font-size: 0.9rem;">
      <tr style="border-bottom: 2px solid var(--border); color: #fff;">
        <th style="padding: 10px 12px; white-space:nowrap;">Kode</th>
        <th style="padding: 10px 12px;">Makna Taruhan</th>
        <th style="padding: 10px 12px;">Hadiah</th>
        <th style="padding: 10px 12px; white-space:nowrap;">Max Bet</th>
      </tr>`;

    list.forEach(item => {
      html += `<tr style="border-bottom: 1px solid var(--border); color: var(--text-muted);">
        <td style="padding: 10px 12px; font-weight:bold; color:var(--primary); white-space:nowrap;">${item.code}</td>
        <td style="padding: 10px 12px; line-height:1.2;">${item.name}</td>
        <td style="padding: 10px 12px; color:var(--success); font-weight:bold;">x${item.odds}</td>
        <td style="padding: 10px 12px; color:var(--warning); white-space:nowrap;">${item.max}</td>
      </tr>`;
    });

    html += `</table></div>
    <div style="margin-top:16px; padding:12px; background: rgba(239,68,68,0.1); border-left: 4px solid var(--danger); border-radius:4px;">
      <h4 style="color:var(--danger); margin-bottom:4px; font-size:0.9rem;">🚨 PENTING: ATURAN TRIPLE OVERRIDE</h4>
      <p style="font-size:0.85rem; color:#f87171; line-height:1.4;">Jika hasil ketiga dadu adalah KEMBAR (contoh: 2-2-2), maka SELURUH taruhan standar (Besar/Kecil/Ganjil/Genap/Dst) akan otomatis dinyatakan <b>KALAH</b>, kecuali kamu menebak taruhan spesifik "T" atau "TS".</p>
    </div>`;

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<span style="color:var(--danger)">Gagal memuat: ${err.message}</span>`;
  }
}

async function init() {
  currentUser = tg.initDataUnsafe?.user;

  // Debug Simulation
  const params = new URLSearchParams(window.location.search);
  const debugId = params.get('debugId');
  if (!currentUser && debugId) {
    currentUser = { id: debugId, first_name: 'DebugUser' };
    currentInitData = 'mock-debug-init-data';
    console.log('Simulating Telegram User:', debugId);
  }

  if (!currentUser) {
    document.getElementById('loading').innerHTML = `❌ Buka MiniApp dari dalam Telegram!<div style="margin-top:20px;font-size:0.9rem;color:#888;">Simulasi PC: <code>?debugId=TELEGRAM_ID</code></div>`;
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/miniapp/user-info?telegramId=${currentUser.id}`);
    userInfo = await res.json();
    if (!res.ok) throw new Error(userInfo.error || 'Error');
    renderUI();
  } catch (err) {
    document.getElementById('loading').innerHTML = `❌ Gagal memuat data: ${err.message}`;
  }
}

function renderUI() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('main-content').style.display = 'block';

  document.getElementById('balance-amount').textContent = `${userInfo.balance} pt`;
  document.getElementById('depo-balance-amount').textContent = `${userInfo.balance} pt`;
  const remainingTO = userInfo.turnoverRemaining || 0;

  // Set text sisa turnover
  document.getElementById('turnover-text').innerHTML = remainingTO > 0
    ? `🎯 Sisa Turnover: <strong>${remainingTO} pt</strong>`
    : `🎯 Sisa Turnover: <strong class="text-success">LUNAS (Bisa WD)</strong>`;

  // Hide the bar since we use text only now
  const barFill = document.getElementById('turnover-fill');
  if (barFill) barFill.parentElement.style.display = 'none';

  // Toggle form WD if TO is met
  const wdWarning = document.getElementById('wd-warning');
  const wdSection = document.getElementById('wd-section');

  if (!userInfo.turnoverMet) {
    wdWarning.style.display = 'block';
    wdSection.style.display = 'none';
    wdWarning.textContent = `⚠️ Syarat Turnover belum terpenuhi. Sisa target ${remainingTO} poin lagi untuk bisa Withdraw!`;
  } else {
    wdWarning.style.display = 'none';
    wdSection.style.display = 'block';
    renderBanks();
  }
}

function renderBanks() {
  const bankList = document.getElementById('bank-list');
  bankList.innerHTML = '';
  const wdFormArea = document.getElementById('wd-form-area');

  if (!userInfo.banks || userInfo.banks.length === 0) {
    bankList.innerHTML = `<p style="color:var(--warning); font-weight:bold; font-size: 0.9rem; margin-bottom: 12px;">Peringatan: Kamu belum menautkan rekening bank!</p>`;
    wdFormArea.style.display = 'none';
    document.getElementById('add-bank-form').style.display = 'block';
    document.getElementById('btn-show-add-bank').style.display = 'none';
  } else {
    document.getElementById('btn-show-add-bank').style.display = userInfo.banks.length >= 3 ? 'none' : 'block';
    userInfo.banks.forEach((bank, idx) => {
      const el = document.createElement('div');
      el.className = `bank-option ${selectedBankIndex === idx ? 'bank-selected' : ''}`;
      el.innerHTML = `
        <div style="flex:1;">
          <div style="font-size: 1.1rem; color: #fff; font-weight: bold;">${bank.bankName}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">${bank.accountNumber} <br>a/n ${bank.accountName}</div>
        </div>
        <div style="display: flex; gap: 15px; align-items: center;">
          <button style="background: rgba(239,68,68,0.1); border: 1px solid var(--danger); border-radius: 8px; padding: 6px 10px; cursor: pointer; color: var(--danger); transition: all 0.2s;" onclick="event.stopPropagation(); alert('Hubungi CS untuk mengubah atau menghapus data rekening ini demi keamanan.')">
            <span style="font-size: 1.2rem; line-height: 1;">🗑️</span>
          </button>
          <div style="font-size: 1.5rem;">${selectedBankIndex === idx ? '✅' : '○'}</div>
        </div>
      `;
      el.onclick = () => {
        selectedBankIndex = idx;
        wdFormArea.style.display = 'block';
        renderBanks();
      };
      bankList.appendChild(el);
    });
  }
}

function toggleAddBankForm() {
  const f = document.getElementById('add-bank-form');
  f.style.display = f.style.display === 'none' || f.style.display === '' ? 'block' : 'none';
}

async function addBankAccount() {
  const bankName = document.getElementById('new-bank-name').value.trim();
  const accountNumber = document.getElementById('new-bank-acc').value.trim();
  const accountName = document.getElementById('new-bank-name-owner').value.trim();

  if (!bankName || !accountNumber || !accountName) {
    alert('❌ Lengkapi semua data bank!'); return;
  }

  tg.MainButton.setText('Menyimpan rekening...').showProgress().show();

  try {
    const res = await fetch(`${API_URL}/api/miniapp/add-bank`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: currentInitData, telegramId: String(currentUser.id), bankName, accountNumber, accountName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');

    userInfo.banks = data.banks;
    selectedBankIndex = userInfo.banks.length - 1;

    document.getElementById('add-bank-form').style.display = 'none';
    document.getElementById('wd-form-area').style.display = 'block';
    renderBanks();
    alert('✅ Rekening berhasil ditautkan permanen!');
  } catch (err) {
    alert(`❌ ${err.message}`);
  } finally {
    tg.MainButton.hideProgress().hide();
  }
}

async function submitWithdraw() {
  const amount = parseInt(document.getElementById('wd-amount').value);
  if (selectedBankIndex < 0) return alert('Pilih rekening tujuan!');

  if (!amount || amount < 20) return showError('wd-amount-err', 'Min: 20 poin');
  if (amount > userInfo.balance) return showError('wd-amount-err', 'Saldo tidak cukup!');

  const btn = document.getElementById('btn-submit-wd');
  btn.innerText = 'PROSES...'; btn.disabled = true;

  try {
    const bank = userInfo.banks[selectedBankIndex];
    const res = await fetch(`${API_URL}/api/miniapp/withdraw`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: currentInitData, telegramId: String(currentUser.id), amount,
        bankName: bank.bankName, accountNumber: bank.accountNumber, accountName: bank.accountName
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showSuccessScreen('Penarikan Terkirim!', 'Dana sedang difinalisasi oleh sistem/admin.');
  } catch (err) {
    alert(`❌ ${err.message}`);
  } finally {
    btn.innerText = 'AJUKAN PENARIKAN'; btn.disabled = false;
  }
}

// === NEW: DEPOSIT FLOW ===
async function submitDeposit() {
  const amount = parseInt(document.getElementById('depo-amount').value);
  const method = document.getElementById('depo-method').value;

  if (!amount || amount < 10000) return showError('depo-amount-err', 'Min deposit Rp 10.000');
  if (!method) return showError('depo-method-err', 'Pilih metode pembayaran!');

  const btn = document.getElementById('btn-submit-depo');
  btn.innerText = 'MEMBUAT TAGIHAN...'; btn.disabled = true;

  try {
    const res = await fetch(`${API_URL}/api/deposit/create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: currentInitData, telegramId: String(currentUser.id), amount, paymentMethod: method
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // Redirect to PG Checkout
    if (data.data.checkoutUrl) {
      tg.openLink(data.data.checkoutUrl);
    }

    showSuccessScreen('Tagihan Dibuat!', 'Silakan selesaikan pembayaran di halaman Web Browser yang terbuka.');
  } catch (err) {
    alert(`❌ ${err.message}`);
  } finally {
    btn.innerText = 'BAYAR SEKARANG'; btn.disabled = false;
  }
}

async function loadHistory() {
  const container = document.getElementById('bets-container');
  container.innerHTML = '<div class="loading">Memuat riwayat dadu...</div>';
  try {
    const res = await fetch(`${API_URL}/api/miniapp/bets?telegramId=${currentUser.id}`);
    const data = await res.json();
    if (!data.bets || data.bets.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-weight:bold;">Belum ada taruhan dimainkan.</div>';
      return;
    }

    container.innerHTML = data.bets.map(bet => {
      const isWin = bet.isWin;
      const profitStr = isWin ? `+${bet.profit}` : `-${bet.betAmount}`;
      const colorCls = isWin ? 'text-win' : 'text-lose';
      const timeStr = new Date(bet.createdAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
      return `
        <div class="bet-card">
          <div class="bet-info">
            <div class="bet-title">Dadu ${bet.betType.toUpperCase()}</div>
            <div class="bet-time">🕒 ${timeStr}</div>
          </div>
          <div class="bet-amount ${colorCls}">${profitStr} pt</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="error-msg" style="display:block">Gagal muat histori</div>`;
  }
}

async function loadDepoHistory() {
  const container = document.getElementById('deposits-container');
  container.innerHTML = '<div class="loading">Memuat riwayat deposit...</div>';
  try {
    const res = await fetch(`${API_URL}/api/deposit/history?telegramId=${currentUser.id}`);
    const data = await res.json();
    if (!data.deposits || data.deposits.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-weight:bold;">Tidak ada riwayat deposit.</div>';
      return;
    }

    container.innerHTML = data.deposits.map(dep => {
      let statusColor = dep.status === 'success' ? 'var(--success)' : dep.status === 'failed' ? 'var(--danger)' : 'var(--warning)';
      let statusText = dep.status.toUpperCase();
      const timeStr = new Date(dep.createdAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });

      return `
        <div class="bet-card">
          <div class="bet-info">
            <div class="bet-title">DEPO via ${dep.paymentMethod}</div>
            <div class="bet-time">🕒 ${timeStr} | ID: ${dep.referenceId}</div>
            <div style="font-size:0.85rem;font-weight:bold;color:${statusColor}; margin-top: 4px;">[ ${statusText} ]</div>
          </div>
          <div class="bet-amount" style="color:var(--primary)">+${dep.amount} pt</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="error-msg" style="display:block">Gagal muat histori depo</div>`;
  }
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg; el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

function showSuccessScreen(title, desc) {
  document.getElementById('main-content').style.display = 'none';
  document.getElementById('success-title').innerText = title;
  document.getElementById('success-desc').innerText = desc;
  document.getElementById('success-msg').style.display = 'block';
  setTimeout(() => tg.close(), 4000);
}

window.addEventListener('load', init);
