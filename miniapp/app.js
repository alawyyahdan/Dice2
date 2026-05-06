const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Atur warnanya
tg.setHeaderColor('#0f172a');
tg.setBackgroundColor('#0f172a');

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
  if (tabId === 'deposit') loadDepoHistory();
  if (tabId === 'withdraw') loadWdHistory();
  if (tabId === 'promosi') loadPromosi();
  if (tabId === 'guide') loadGuide();
  if (tabId === 'leaderboard') loadLeaderboard('daily');
}

async function loadPromosi() {
  const listContainer = document.getElementById('promosi-list');
  const detailContainer = document.getElementById('promosi-detail');
  listContainer.style.display = 'flex';
  detailContainer.style.display = 'none';
  
  try {
    const res = await fetch(`/api/promotions/active`);
    const data = await res.json();
    if (!data.promotions || data.promotions.length === 0) {
      listContainer.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-weight:bold;">Belum ada promosi aktif saat ini.</div>';
      return;
    }

    listContainer.innerHTML = data.promotions.map(promo => {
      // Encode promo data into a safe string to click
      const safePromo = encodeURIComponent(JSON.stringify(promo));
      return `
        <div class="card-dark" style="padding:0; overflow:hidden; cursor:pointer; transition:transform 0.2s; border:1px solid var(--border);" onclick="showPromosiDetail('${safePromo}')">
          <img src="${promo.bannerUrl}" style="width:100%; height:160px; object-fit:cover; display:block;" onerror="this.src='https://via.placeholder.com/400x160?text=Banner'">
          <div style="padding:16px;">
            <h3 style="margin:0; font-size:1.1rem; color:#fff; font-weight:bold; margin-bottom:6px;">${promo.title}</h3>
            <div style="font-size:0.8rem; color:var(--text-muted);">🗓️ Berlaku s.d. ${new Date(promo.endDate).toLocaleString('id-ID')}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    listContainer.innerHTML = '<span style="color:var(--danger)">Gagal memuat promosi.</span>';
  }
}

function showPromosiDetail(encodedPromo) {
  const promo = JSON.parse(decodeURIComponent(encodedPromo));
  const listContainer = document.getElementById('promosi-list');
  const detailContainer = document.getElementById('promosi-detail');
  
  listContainer.style.display = 'none';
  detailContainer.style.display = 'flex';
  
  detailContainer.innerHTML = `
    <button onclick="document.getElementById('promosi-list').style.display='flex'; document.getElementById('promosi-detail').style.display='none';" class="btn" style="background:rgba(255,255,255,0.05); color:var(--text); border:1px solid var(--border); padding:8px 16px; font-weight:bold; width:max-content; border-radius:30px; margin-bottom:10px;">
      ← KEMBALI
    </button>
    <img src="${promo.bannerUrl}" style="width:100%; height:auto; border-radius:12px; border:2px solid var(--border);" onerror="this.src='https://via.placeholder.com/400x160?text=Banner'">
    <h2 style="font-size:1.4rem; color:#fff; font-weight:900; line-height:1.3; margin-top:8px;">${promo.title}</h2>
    <div style="font-size:0.85rem; color:var(--text-muted); background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; display:inline-block;">
      ⏳ Promo s.d. <strong style="color:var(--warning)">${new Date(promo.endDate).toLocaleString('id-ID')}</strong>
    </div>
    <div style="color:var(--text); line-height:1.6; font-size:0.95rem; margin-top:10px;">
      ${promo.description}
    </div>
  `;
}

async function loadGuide() {
  const container = document.getElementById('guide-table-container');
  try {
    const res = await fetch(`/api/settings/public`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const odds = data.odds;
    const bounds = data.bounds;

    const list = [
      { code: 'B / K', name: 'Besar / Kecil', odds: odds.standard, max: bounds.maxStandard },
      { code: 'GA / GE', name: 'Ganjil / Genap', odds: odds.standard, max: bounds.maxStandard },
      { code: 'BGA / KGE', name: 'Besar Gnjil / Kcil Gnap', odds: odds.BGA_KGE, max: bounds.maxKombinasi },
      { code: 'BGE / KGA', name: 'Besar Genap / Kcil Gnjil', odds: odds.BGE_KGA, max: bounds.maxKombinasi },
      { code: 'J4/J17', name: 'Jumlah Dadu 4 / 17', odds: odds.J4_17, max: bounds.maxJ4_17 },
      { code: 'T', name: 'Triple Sembarang', odds: odds.T, max: bounds.maxT },
      { code: 'L', name: 'Lurus (ex: 2,3,4)', odds: odds.L, max: bounds.maxL },
      { code: 'P', name: 'Pasangan (2 Kembar)', odds: odds.P, max: bounds.maxP },
      { code: 'TS', name: 'Triple Spesifik (ex: 5,5,5)', odds: odds.TS, max: bounds.maxTS },
      { code: 'N / H', name: 'Naga / Harimau', odds: odds.N_H, max: bounds.maxTie },
      { code: 'S', name: 'Seri', odds: odds.S, max: bounds.maxTie },
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
  const user = tg.initDataUnsafe?.user;
  
  if (!user || !user.id) {
    console.error('MiniApp failed: No user ID found in initDataUnsafe');
    document.getElementById('loading').innerHTML = `❌ Gagal: Akses MiniApp hanya melalui Telegram resmi!`;
    return;
  }
  
  currentUser = user; // Selesaikan assignment currentUser di sini
  currentInitData = tg.initData;

  // Load User Data
  try {
    const res = await fetch(`/api/miniapp/user-info?telegramId=${currentUser.id}&initData=${encodeURIComponent(currentInitData)}&photoUrl=${encodeURIComponent(currentUser.photo_url || '')}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan sistem');

    // Assign data to userInfo
    userInfo = data;

    // Toggle Leaderboard Tab visibility
    const ldbTab = document.getElementById('nav-leaderboard');
    if (ldbTab && userInfo.isLeaderboardActive) {
      ldbTab.style.display = 'inline-block';
    }

    // Load dynamic payment gateway methods
    await loadPaymentMethods();

    renderUI();

    // Handle Tab Deep-Linking (Supports ?tab=... and ?tgWebAppStartParam=...)
    const params = new URLSearchParams(window.location.search);
    const startParam = params.get('tgWebAppStartParam');
    const targetTab = params.get('tab') || startParam;

    if (targetTab) {
      setTimeout(() => switchTab(targetTab), 250); // Delay biar UI data siap dulu
    }
  } catch (err) {
    document.getElementById('loading').innerHTML = `❌ Gagal memuat data: ${err.message}`;
  }
}

let currentProviderType = 'none';
let currentMinDeposit = 10000;
let currentMaxDeposit = 50000000;

async function loadPaymentMethods() {
  try {
    const res = await fetch(`/api/deposit/methods`);
    const data = await res.json();
    currentProviderType = data.providerType;
    currentMinDeposit = data.minDeposit || 10000;
    currentMaxDeposit = data.maxDeposit || 50000000;

    document.getElementById('depo-warning-text').innerHTML = data.warningText || (data.manualConfig ? data.manualConfig.warningText : '');

    if (currentProviderType === 'none') {
      document.getElementById('depo-disabled-msg').style.display = 'block';
      document.getElementById('depo-form-area').style.display = 'none';
      document.getElementById('depo-title').style.display = 'none';
    } else {
      document.getElementById('depo-disabled-msg').style.display = 'none';
      document.getElementById('depo-form-area').style.display = 'block';
      document.getElementById('group-depo-method').style.display = 'block';

      const container = document.getElementById('method-options-container');
      container.innerHTML = '';
      (data.methods || []).forEach((m, idx) => {
        const checked = idx === 0 ? 'checked' : '';
        const mname = m.name || m.bankName; // sitranfer has name, manual has bankName
        const mcode = m.code || m.bankName; // manual methods without code fallback
        container.innerHTML += `
            <label style="display:block; margin:0; padding:0;">
               <input class="method-radio" type="radio" name="sitranfer_method" value="${mcode}" ${checked} style="display:none;">
               <div class="method-card">
                 <span>${mname}</span>
                 ${m.logoUrl ? `<img src="${m.logoUrl}">` : ''}
               </div>
            </label>
          `;
      });
      
      const promoGroup = document.getElementById('group-depo-promo');
      const promoInput = document.getElementById('depo-promo');
      const promoContainer = document.getElementById('promo-options-container');
      
      if (data.promos && data.promos.length > 0) {
        if(promoGroup) promoGroup.style.display = 'block';
        if(promoContainer) {
          let promoHTML = `
            <label style="display:block; margin:0; padding:0;">
               <input class="promo-radio method-radio" type="radio" name="depo_promo_sel" value="" checked style="display:none;" onchange="document.getElementById('depo-promo').value = this.value;">
               <div class="method-card" style="justify-content:flex-start;">
                 <span>🎁 Tidak Pakai Promo</span>
               </div>
            </label>
          `;
          data.promos.forEach(p => {
            const title = p.type === 'percent' ? `Bonus ${p.bonusValue}%` : `Bonus ${p.bonusValue}pt`;
            promoHTML += `
              <label style="display:block; margin:0; padding:0;">
                 <input class="promo-radio method-radio" type="radio" name="depo_promo_sel" value="${p.id}" style="display:none;" onchange="document.getElementById('depo-promo').value = this.value;">
                 <div class="method-card" style="justify-content:flex-start; gap:12px;">
                   <span>🏷️</span>
                   <div style="display:flex; flex-direction:column; align-items:flex-start;">
                     <span style="font-size:0.95rem;">${p.name}</span>
                     <span style="font-size:0.75rem; color:var(--success); opacity:0.9;">${title} / TO x${p.turnoverMultiplier}</span>
                   </div>
                 </div>
              </label>
            `;
          });
          promoContainer.innerHTML = promoHTML;
        }
        if(promoInput) promoInput.value = "";
      } else {
        if(promoGroup) promoGroup.style.display = 'none';
        if(promoInput) promoInput.value = "";
      }
    }
  } catch (err) {
    console.error('Failed to load payment methods:', err);
  }
}

function renderUI() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('main-content').style.display = 'block';

  const formattedBalance = Number(userInfo.balance).toFixed(2);
  document.getElementById('balance-amount').textContent = `${formattedBalance} pt`;
  document.getElementById('depo-balance-amount').textContent = `${formattedBalance} pt`;
  const remainingTO = Number(userInfo.turnoverRemaining || 0).toFixed(2);

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
  const wdAmountInput = document.getElementById('wd-amount');

  if (!userInfo.turnoverMet) {
    wdWarning.style.display = 'block';
    wdSection.style.display = 'none';
    wdWarning.textContent = `⚠️ Syarat Turnover belum terpenuhi. Sisa target ${remainingTO} poin lagi untuk bisa Withdraw!`;
  } else {
    wdWarning.style.display = 'none';
    wdSection.style.display = 'block';
    
    if (userInfo.withdrawRule === 'all') {
       if (wdAmountInput) {
         wdAmountInput.value = Math.floor(userInfo.balance);
         wdAmountInput.readOnly = true;
         wdAmountInput.style.opacity = '0.7';
         wdAmountInput.title = "Aturan sistem mewajibkan penarikan seluruh saldo sekaligus.";
         const lbl = wdAmountInput.previousElementSibling;
         if (lbl) lbl.innerHTML = `Jumlah Withdraw Poin <span style="opacity:0.8;font-size:0.8rem;color:var(--warning);">(Wajib Tarik Semua)</span>`;
         if (window.updateIdrLive) window.updateIdrLive();
       }
    } else {
       if (wdAmountInput) {
         wdAmountInput.readOnly = false;
         wdAmountInput.style.opacity = '1';
         wdAmountInput.title = "";
         const lbl = wdAmountInput.previousElementSibling;
         if (lbl) lbl.innerHTML = `Jumlah Withdraw Poin <span style="opacity:0.7;font-size:0.8rem;">(1pt = Rp1.000)</span>`;
         if (window.updateIdrLive) window.updateIdrLive();
       }
    }

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
    // FIX: Populate dropdown immediately if showing form for first-time user
    populateBankSelect();
  } else {
    // User already has 1 bank — show button but clicking it redirects to CS
    const addBtn = document.getElementById('btn-show-add-bank');
    addBtn.style.display = 'block';
    addBtn.textContent = '+ Tambah Rekening';
    addBtn.onclick = () => {
      const csRaw = (userInfo.csContactLink || '').trim();
      const csUrl = csRaw
        ? (csRaw.startsWith('http') ? csRaw : `https://t.me/${csRaw.replace('@', '')}`)
        : 'https://t.me/AdminDice';
      if (confirm('Untuk mengubah atau menambah rekening, silakan hubungi CS kami. Buka chat CS sekarang?')) {
        window.open(csUrl, '_blank');
      }
    };

    userInfo.banks.forEach((bank, idx) => {
      const el = document.createElement('div');
      const isSelected = (selectedBankIndex === idx);
      const borderColor = isSelected ? 'var(--primary)' : 'var(--border)';
      const bg = isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.05)';

      el.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: ${bg}; border: 1px solid ${borderColor}; border-radius: 12px; margin-bottom: 10px; transition: all 0.2s; cursor: pointer;">
          <div style="flex:1;">
            <div style="font-size: 1.1rem; color: #fff; font-weight: bold;">${bank.bankName}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">${bank.accountNumber} <br>a/n ${bank.accountName}</div>
          </div>
          <button style="background: rgba(239,68,68,0.1); border: 1px solid var(--danger); border-radius: 8px; padding: 6px 14px; cursor: pointer; color: var(--danger); font-weight: bold; font-size: 0.85rem; transition: all 0.2s; letter-spacing: 0.5px;" onclick="event.stopPropagation(); alert('Hubungi CS untuk mengubah atau menghapus data rekening ini demi keamanan.')">
            HAPUS
          </button>
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

function populateBankSelect() {
  const select = document.getElementById('new-bank-name');
  if (!select) return;

  // Always repopulate to avoid empty dropdown bug
  select.innerHTML = '<option value="">-- Pilih Bank / E-Wallet --</option>';
  if (userInfo.activeBanks && userInfo.activeBanks.length > 0) {
    userInfo.activeBanks.forEach(b => {
      select.innerHTML += `<option value="${b.code}">${b.name}</option>`;
    });
  } else {
    select.innerHTML += '<option value="" disabled>Tidak ada bank aktif — atur di Settings</option>';
  }
}

function toggleAddBankForm() {
  const f = document.getElementById('add-bank-form');
  f.style.display = f.style.display === 'none' || f.style.display === '' ? 'block' : 'none';
  if (f.style.display === 'block') {
    populateBankSelect();
  }
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
    const res = await fetch(`/api/miniapp/add-bank`, {
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

window.updateIdrLive = function() {
  const wdAmountInput = document.getElementById('wd-amount');
  const wdLiveText = document.getElementById('wd-idr-live');
  
  if (!wdAmountInput || !wdLiveText) return;
  
  const val = parseInt(wdAmountInput.value) || 0;
  if (val > 0) {
    wdLiveText.style.display = 'block';
    wdLiveText.innerText = '~ Rp ' + (val * 1000).toLocaleString('id-ID');
  } else {
    wdLiveText.style.display = 'none';
  }
};

async function submitWithdraw() {
  const amount = parseInt(document.getElementById('wd-amount').value);
  if (selectedBankIndex < 0) return alert('Pilih rekening tujuan!');

  if (!amount || amount < 20) return showError('wd-amount-err', 'Min: 20 poin');
  if (amount > userInfo.balance) return showError('wd-amount-err', 'Saldo tidak cukup!');

  const btn = document.getElementById('btn-submit-wd');
  btn.innerText = 'PROSES...'; btn.disabled = true;

  try {
    const bank = userInfo.banks[selectedBankIndex];
    const res = await fetch(`/api/miniapp/withdraw`, {
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

let currentCharge = null;
let paymentCheckInterval = null;

async function submitDeposit() {
  const amount = parseInt(document.getElementById('depo-amount').value);

  if (!amount || amount < currentMinDeposit) return showError('depo-amount-err', `Min: ${currentMinDeposit} pt`);
  if (amount > currentMaxDeposit) return showError('depo-amount-err', `Max: ${currentMaxDeposit} pt`);

  let method = 'MANUAL TRANSFER';
  const selectedRadio = document.querySelector('input[name="sitranfer_method"]:checked');
  if (selectedRadio) {
    method = selectedRadio.value;
  } else {
    return showError('depo-method-err', 'Pilih metode pembayaran!');
  }

  const promoSelect = document.getElementById('depo-promo');
  const promoId = promoSelect && promoSelect.value !== "" ? promoSelect.value : undefined;

  const btn = document.getElementById('btn-submit-depo');
  btn.innerText = 'MEMPROSES...'; btn.disabled = true;

  try {
    const res = await fetch(`/api/deposit/create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: currentInitData, telegramId: String(currentUser.id), amount, paymentMethod: method, promoId
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (currentProviderType === 'manual') {
      currentCharge = data.data;
      showManualOverlay();
    } else {
      currentCharge = data.data; // Berisi referenceId, paymentData, amount, transaksi SiTranfer
      showPaymentOverlay();
    }
  } catch (err) {
    alert(`❌ ${err.message}`);
  } finally {
    btn.innerText = 'LANJUTKAN DEPOSIT'; btn.disabled = false;
  }
}

function showPaymentOverlay() {
  const overlay = document.getElementById('payment-overlay');
  const qrContainer = document.getElementById('qr-container');
  const qrImage = document.getElementById('qr-image');
  const danaContainer = document.getElementById('dana-container');
  const danaLink = document.getElementById('dana-link');
  const instruction = document.getElementById('payment-instruction');

  overlay.style.display = 'flex';
  document.getElementById('payment-success-anim').style.display = 'none';

  instruction.innerHTML = `Referensi: <span style="font-family:monospace;font-size:0.85em;">${currentCharge.referenceId}</span>`;

  const spanNominal = document.getElementById('copy-nominal-text');
  if (spanNominal) {
    spanNominal.innerText = (currentCharge.amount * 1000).toLocaleString('id-ID');
  }

  const pd = currentCharge.paymentData;
  if (pd && pd.includes('http')) {
    // Jika bentuk URL (DANA link atau Direct Image)
    if (pd.includes('dana.id') || pd.includes('app') || pd.includes('pay')) {
      danaContainer.style.display = 'block';
      qrContainer.style.display = 'none';
      danaLink.href = pd;
    } else {
      qrContainer.style.display = 'block';
      danaContainer.style.display = 'none';
      qrImage.src = pd;
    }
  } else if (pd) {
    // Jika bentuk raw text string QRIS CODE
    qrContainer.style.display = 'block';
    danaContainer.style.display = 'none';
    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pd)}`;
  } else {
    // Fallback jika paymentData kosong
    instruction.innerHTML = 'Data pembayaran gagal dimuat. Hubungi CS.';
  }

  // Auto check status every 5 seconds
  if (paymentCheckInterval) clearInterval(paymentCheckInterval);
  paymentCheckInterval = setInterval(checkPaymentStatusSilent, 5000);
}

function closePaymentOverlay() {
  document.getElementById('payment-overlay').style.display = 'none';
  if (paymentCheckInterval) clearInterval(paymentCheckInterval);
}

function showManualOverlay() {
  const overlay = document.getElementById('manual-overlay');
  overlay.style.display = 'flex';

  try {
    const bankInfo = JSON.parse(currentCharge.paymentData);
    document.getElementById('manual-nominal-text').innerText = (bankInfo.finalIdrAmount || (currentCharge.amount * 1000)).toLocaleString('id-ID');
    document.getElementById('manual-bank-name').innerText = bankInfo.bankName || 'BANK MANUAL';
    document.getElementById('manual-rek-no').innerText = bankInfo.accountNumber || '-';
    document.getElementById('manual-rek-name').innerText = bankInfo.accountName || '-';
  } catch (e) {
    console.error('Failed parsing manual bank info', e);
    document.getElementById('manual-nominal-text').innerText = (currentCharge.amount * 1000).toLocaleString('id-ID');
  }
}

function closeManualOverlay() {
  document.getElementById('manual-overlay').style.display = 'none';
}

function copyManualNominal() {
  if (!currentCharge || !currentCharge.amount) return;

  let idrToPay = currentCharge.amount * 1000;
  try {
    const bankInfo = JSON.parse(currentCharge.paymentData);
    if (bankInfo.finalIdrAmount) idrToPay = bankInfo.finalIdrAmount;
  } catch (e) { }

  copyTextToClipboard(idrToPay.toString(), 'Nominal');
}

function copyManualRek() {
  const rekNo = document.getElementById('manual-rek-no').innerText;
  copyTextToClipboard(rekNo, 'Nomor Rekening');
}

function copyTextToClipboard(text, label) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => alert(`${label} berhasil disalin!`));
  } else {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert(`${label} berhasil disalin! (Fallback)`);
  }
}

async function confirmManualTransfer() {
  closeManualOverlay();
  showSuccessScreen('Berhasil Diajukan!', 'Permintaan deposit kamu telah diteruskan ke admin. Saldo akan diupdate setelah divalidasi.');
  document.getElementById('depo-amount').value = '';
}

async function sendToTele(btnId, successMsg, extraBody = {}) {
  const btn = document.getElementById(btnId);
  const oldText = btn.innerText;
  btn.innerText = 'Mengirim...'; btn.disabled = true;
  try {
    const res = await fetch(`/api/deposit/send-bayar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: currentInitData, telegramId: String(currentUser.id), referenceId: currentCharge.referenceId, ...extraBody })
    });
    if (res.ok) alert(successMsg);
    else throw new Error();
  } catch (e) {
    alert('❌ Gagal kirim ke bot');
  }
  btn.innerText = oldText; btn.disabled = false;
}

function sendQRToTele() {
  sendToTele('btn-kirim-tele', '✅ QR berhasil dikirim ke chat Bot!');
}

function sendManualToTele() {
  sendToTele('btn-kirim-tele-manual', '✅ Instruksi Manual berhasil dikirim ke chat Bot!', { isManual: true });
}

async function checkPaymentStatusSilent() {
  if (!currentUser || !currentCharge) return;
  try {
    const res = await fetch(`/api/deposit/history?telegramId=${currentUser.id}&initData=${encodeURIComponent(currentInitData)}`);
    const data = await res.json();
    const dep = data.deposits.find(d => d.referenceId === currentCharge.referenceId);
    if (dep && dep.status === 'success') {
      onPaymentSuccess(dep.amount);
    }
  } catch (e) { }
}

async function checkPaymentStatus() {
  const btn = document.getElementById('btn-cek-bayar');
  btn.innerText = 'Mengecek...'; btn.disabled = true;
  await checkPaymentStatusSilent();
  setTimeout(() => {
    btn.innerText = '🔄 Cek Pembayaran'; btn.disabled = false;
  }, 1000);
}

function onPaymentSuccess(amountAsli) {
  if (paymentCheckInterval) clearInterval(paymentCheckInterval);
  document.getElementById('payment-success-anim').style.display = 'flex';

  // Fake update balance temporarily in UI to trick the eye instantly, it will auto load anyway next reload
  if (userInfo) userInfo.balance += amountAsli;
  const formattedBalance = Number(userInfo.balance).toFixed(2);
  document.getElementById('balance-amount').textContent = `${formattedBalance} pt`;
  document.getElementById('depo-balance-amount').textContent = `${formattedBalance} pt`;

  setTimeout(() => {
    closePaymentOverlay();
    document.getElementById('depo-amount').value = '';
    switchTab('history-depo');
  }, 2500); // 2.5 second animation
}

async function loadHistory() {
  if (!currentUser) return;
  const container = document.getElementById('bets-container');
  container.innerHTML = '<div class="loading">Memuat riwayat dadu...</div>';
  try {
    const res = await fetch(`/api/miniapp/bets?telegramId=${currentUser.id}&initData=${encodeURIComponent(currentInitData)}`);
    const data = await res.json();
    if (!data.bets || data.bets.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-weight:bold;">Belum ada taruhan dimainkan.</div>';
      return;
    }

    // ===== DAILY STATS =====
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayBets = data.bets.filter(b => new Date(b.createdAt) >= todayStart);
    
    const totalBets = todayBets.length;
    const totalWagered = todayBets.reduce((sum, b) => sum + (b.betAmount || 0), 0);
    const netPL = todayBets.reduce((sum, b) => {
      return sum + (b.isWin ? (b.profit || 0) : -(b.betAmount || 0));
    }, 0);

    const statsEl = document.getElementById('today-stats');
    if (statsEl && totalBets > 0) {
      statsEl.style.display = 'block';
      document.getElementById('stat-total-bets').textContent = totalBets;
      document.getElementById('stat-total-wagered').textContent = totalWagered.toFixed(2);
      const plEl = document.getElementById('stat-net-pl');
      plEl.textContent = (netPL >= 0 ? '+' : '') + netPL.toFixed(2);
      plEl.style.color = netPL >= 0 ? 'var(--success)' : 'var(--danger)';
    } else if (statsEl) {
      statsEl.style.display = 'none';
    }

    container.innerHTML = data.bets.map(bet => {
      const isWin = bet.isWin;
      const profitStr = isWin ? `+${bet.profit}` : `-${bet.betAmount}`;
      const colorCls = isWin ? 'text-win' : 'text-lose';
      const timeStr = new Date(bet.createdAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });

      // Source badge — purple glow for Group, orange glow for Private
      const isGroup = bet.isGroup;
      const sourceLabel = isGroup ? (bet.groupName || 'Grup') : 'PRIVATE';
      const badgeStyle = isGroup
        ? `background:rgba(168,85,247,0.15); color:#c084fc; border:1px solid rgba(168,85,247,0.4); box-shadow:0 0 7px rgba(168,85,247,0.5);`
        : `background:rgba(251,146,60,0.15); color:#fb923c; border:1px solid rgba(251,146,60,0.4); box-shadow:0 0 7px rgba(251,146,60,0.5);`;

      return `
        <div class="bet-card">
          <div class="bet-info">
            <div class="bet-title" style="display:flex; align-items:center; gap:7px; flex-wrap:wrap;">
              Dadu ${bet.betType.toUpperCase()}
              <span style="font-size:0.65rem; font-weight:700; letter-spacing:0.04em; padding:2px 7px; border-radius:999px; white-space:nowrap; ${badgeStyle}">
                ${isGroup ? '👥 ' : '💬 '}${sourceLabel}
              </span>
            </div>
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

// ===== PAGINATED INLINE HISTORIES =====
let depHistPage = 1;
let depHistTotal = 0;
const DEP_PER_PAGE = 5;

async function loadDepoHistory() {
  if (!currentUser) return;
  const container = document.getElementById('deposits-container');
  if (!container) return;
  container.innerHTML = '<div class="loading">Memuat...</div>';
  try {
    const res = await fetch(`/api/deposit/history?telegramId=${currentUser.id}&initData=${encodeURIComponent(currentInitData)}`);
    const data = await res.json();
    const all = data.deposits || [];
    window.currentHistoryDeposits = all;
    depHistTotal = all.length;
    const start = (depHistPage - 1) * DEP_PER_PAGE;
    const paged = all.slice(start, start + DEP_PER_PAGE);

    // Update page indicator
    const pageEl = document.getElementById('dep-hist-page');
    const totalPages = Math.max(1, Math.ceil(depHistTotal / DEP_PER_PAGE));
    if (pageEl) pageEl.textContent = `${depHistPage}/${totalPages}`;
    const prevBtn = document.getElementById('dep-hist-prev');
    const nextBtn = document.getElementById('dep-hist-next');
    if (prevBtn) prevBtn.disabled = depHistPage <= 1;
    if (nextBtn) nextBtn.disabled = depHistPage >= totalPages;

    if (paged.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-weight:bold;">Tidak ada riwayat deposit.</div>';
      return;
    }
    container.innerHTML = paged.map(dep => {
      let statusColor = dep.status === 'success' ? 'var(--success)' : dep.status === 'failed' ? 'var(--danger)' : 'var(--warning)';
      const timeStr = new Date(dep.createdAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
      return `
        <div class="bet-card" style="display:flex; justify-content:space-between; align-items:center;">
          <div class="bet-info" style="flex:1;">
            <div class="bet-title">DEPO via ${dep.paymentMethod}</div>
            <div class="bet-time">🕒 ${timeStr}</div>
            <div style="font-size:0.85rem;font-weight:bold;color:${statusColor}; margin-top:4px;">[ ${dep.status.toUpperCase()} ]</div>
          </div>
          <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end;">
            <div class="bet-amount" style="color:var(--primary); margin-bottom:5px;">+${dep.amount} pt</div>
            ${dep.status === 'pending' ? `<div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;"><div class="dep-timer" data-expiry="${new Date(dep.createdAt).getTime() + 5 * 60 * 1000}" data-ref="${dep.referenceId}" style="color:var(--warning); font-size:0.85rem; font-weight:bold; font-family:monospace;">⏳ 05:00</div><button onclick="openDepositDetail('${dep.referenceId}')" style="background:rgba(59,130,246,0.1); color:var(--primary); border:1px solid rgba(59,130,246,0.4); padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold; cursor:pointer;">LIHAT DETAIL</button></div>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="error-msg" style="display:block">Gagal memuat riwayat deposit.</div>`;
  }
}
function depHistPrev() { if (depHistPage > 1) { depHistPage--; loadDepoHistory(); } }
function depHistNext() { const t = Math.ceil(depHistTotal / DEP_PER_PAGE); if (depHistPage < t) { depHistPage++; loadDepoHistory(); } }

// ===== WITHDRAW HISTORY =====
let wdHistPage = 1;
let wdHistTotal = 0;
const WD_PER_PAGE = 5;

async function loadWdHistory() {
  if (!currentUser) return;
  const container = document.getElementById('wd-history-container');
  if (!container) return;
  container.innerHTML = '<div class="loading">Memuat...</div>';
  try {
    const res = await fetch(`/api/miniapp/withdraw-history?telegramId=${currentUser.id}&initData=${encodeURIComponent(currentInitData)}`);
    const data = await res.json();
    const all = data.withdraws || [];
    wdHistTotal = all.length;
    const start = (wdHistPage - 1) * WD_PER_PAGE;
    const paged = all.slice(start, start + WD_PER_PAGE);

    const pageEl = document.getElementById('wd-hist-page');
    const totalPages = Math.max(1, Math.ceil(wdHistTotal / WD_PER_PAGE));
    if (pageEl) pageEl.textContent = `${wdHistPage}/${totalPages}`;
    const prevBtn = document.getElementById('wd-hist-prev');
    const nextBtn = document.getElementById('wd-hist-next');
    if (prevBtn) prevBtn.disabled = wdHistPage <= 1;
    if (nextBtn) nextBtn.disabled = wdHistPage >= totalPages;

    if (paged.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-weight:bold;">Tidak ada riwayat withdraw.</div>';
      return;
    }
    container.innerHTML = paged.map(wd => {
      let statusColor = wd.status === 'approved' ? 'var(--success)' : wd.status === 'rejected' ? 'var(--danger)' : 'var(--warning)';
      const timeStr = new Date(wd.createdAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
      return `
        <div class="bet-card" style="display:flex; justify-content:space-between; align-items:center;">
          <div class="bet-info" style="flex:1;">
            <div class="bet-title">WD → ${wd.bankName}</div>
            <div class="bet-time">🕒 ${timeStr} | ${wd.accountNumber}</div>
            <div style="font-size:0.85rem;font-weight:bold;color:${statusColor}; margin-top:4px;">[ ${wd.status.toUpperCase()} ]${wd.adminNote ? ' — ' + wd.adminNote : ''}</div>
          </div>
          <div class="bet-amount" style="color:var(--danger);">-${wd.amount} pt</div>
        </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="error-msg" style="display:block">Gagal memuat riwayat withdraw.</div>`;
  }
}
function wdHistPrev() { if (wdHistPage > 1) { wdHistPage--; loadWdHistory(); } }
function wdHistNext() { const t = Math.ceil(wdHistTotal / WD_PER_PAGE); if (wdHistPage < t) { wdHistPage++; loadWdHistory(); } }




function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg; el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

function showSuccessScreen(title, desc) {
  document.getElementById('main-content').style.display = 'none';
  document.getElementById('success-title').innerText = title;
  document.getElementById('success-desc').innerText = desc;
  document.getElementById('success-msg').style.display = 'flex';
}

function closeSuccessMsg() {
  document.getElementById('success-msg').style.display = 'none';
  document.getElementById('main-content').style.display = 'block';
  // Clean forms
  document.getElementById('depo-amount').value = '';
  document.getElementById('wd-amount').value = '';

  // Redirect to history tab to easily check the newly submitted transaction
  switchTab('history');
}

function copyNominal() {
  if (!currentCharge || !currentCharge.amount) return;
  copyTextToClipboard((currentCharge.amount * 1000).toString(), 'Nominal');
}

window.openDepositDetail = function (refId) {
  if (!window.currentHistoryDeposits) return;
  const dep = window.currentHistoryDeposits.find(d => d.referenceId === refId);
  if (!dep) return;

  currentCharge = {
    referenceId: dep.referenceId,
    paymentData: dep.paymentData,
    amount: dep.amount,
    status: dep.status,
    createdAt: dep.createdAt,
    paymentMethod: dep.paymentMethod
  };

  try {
    JSON.parse(dep.paymentData);
    showManualOverlay();
  } catch (e) {
    showPaymentOverlay();
  }
}

// ===== AUTO CANCEL TIMER LOGIC =====
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

async function autoCancelDeposit(refId, silent = false) {
  try {
    const res = await fetch(`/api/deposit/cancel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: currentInitData, referenceId: refId })
    });
    if (res.ok) {
      if (!silent && currentCharge && currentCharge.referenceId === refId) {
        currentCharge = null;
        alert('Waktu pembayaran 5 menit habis. Deposit otomatis dibatalkan.');
      }
      loadDepoHistory();
    }
  } catch (e) {
    console.error('Auto cancel failed', e);
  }
}

// ===== LEADERBOARD LOGIC =====
async function loadLeaderboard(filter) {
  if (!currentUser) return;
  document.querySelectorAll('[id^="btn-ldb-"]').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`btn-ldb-` + filter).classList.add('active');

  const container = document.getElementById('leaderboard-container');
  container.innerHTML = '<div class="loading">Memuat leaderboard...</div>';

  try {
    const res = await fetch(`/api/leaderboard/public?filter=${filter}&initData=${encodeURIComponent(currentInitData)}`);
    const data = await res.json();

    if (!data.leaderboard || data.leaderboard.length === 0) {
      container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">Belum ada data leaderboard.</div>';
      return;
    }
    // Split data into top 3 and others
    const top3Raw = data.leaderboard.slice(0, 3);
    const others = data.leaderboard.slice(3, 50);

    let htmlOut = '';
    if (top3Raw.length > 0) {
      const t1 = top3Raw[0] || null;
      const t2 = top3Raw[1] || null;
      const t3 = top3Raw[2] || null;

      const renderPodium = (u, rank) => {
        if (!u) return `<div class="podium-block podium-${rank}" style="opacity:0;"></div>`;
        const avatar = u.photoUrl ? u.photoUrl : 'https://api.dicebear.com/9.x/adventurer/svg?seed=' + u.username;
        return `
               <div class="podium-block podium-${rank}">
                  <div class="podium-avatar-wrap">
                     <div class="podium-crown">👑</div>
                     <img src="${avatar}" class="podium-avatar">
                     <div class="podium-rank-box">NO${rank}</div>
                  </div>
                  <div class="podium-box">
                     <div class="podium-name">@${u.username}</div>
                     <div class="podium-score">${u.volume >= 1000 ? (u.volume / 1000).toFixed(1) + 'k' : u.volume} pt</div>
                  </div>
               </div>`;
      };

      htmlOut += `<div class="podium-section">
               ${renderPodium(t2, 2)}
               ${renderPodium(t1, 1)}
               ${renderPodium(t3, 3)}
            </div>`;
    }

    // Rest of list
    htmlOut += '<div style="margin-top:20px;">' + others.map((u, i) => {
      const rank = i + 4;
      const badge = `<span style="font-size:13px;color:var(--text-muted);width:22px;display:inline-block;text-align:center;font-weight:900;">${rank}</span>`;
      const avatar = u.photoUrl ? u.photoUrl : 'https://api.dicebear.com/9.x/adventurer/svg?seed=' + u.username;

      return `
            <div style="display:flex; align-items:center; background:rgba(255,255,255,0.05); padding:12px; border-radius:12px; border:1px solid var(--border); margin-bottom:10px;">
               <div style="margin-right:12px;">${badge}</div>
               <img src="${avatar}" style="width:42px; height:42px; border-radius:50%; object-fit:cover; margin-right:12px; border:2px solid var(--border);">
               <div style="flex:1; overflow:hidden;">
                 <div style="font-weight:900; font-size:15px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">@${u.username}</div>
                 <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Volume Taruhan</div>
               </div>
               <div style="text-align:right; margin-left:10px;">
                 <div style="font-weight:900; color:var(--primary); font-size:15px; letter-spacing:0.5px;">${u.volume} pt</div>
               </div>
            </div>`;
    }).join('') + '</div>';

    container.innerHTML = htmlOut;
  } catch (err) {
    container.innerHTML = '<div style="text-align:center; color:#ef4444;">Gagal memuat leaderboard.</div>';
  }
}

setInterval(() => {
  const now = Date.now();
  // 1. Update active overlays
  if (currentCharge && currentCharge.createdAt) {
    const expiry = new Date(currentCharge.createdAt).getTime() + 5 * 60 * 1000;
    const left = Math.max(0, expiry - now);
    const text = formatTime(left);

    const qrisEl = document.getElementById('overlay-timer-qris');
    if (qrisEl) qrisEl.innerText = text;

    const manEl = document.getElementById('overlay-timer-manual');
    if (manEl) manEl.innerText = text;

    if (left === 0) {
      if (document.getElementById('payment-overlay').style.display === 'flex') closePaymentOverlay();
      if (document.getElementById('manual-overlay').style.display === 'flex') closeManualOverlay();
      const refToCancel = currentCharge.referenceId;
      currentCharge = null; // Clear to prevent double loops
      autoCancelDeposit(refToCancel, false);
    }
  }

  // 2. Update deposit history items
  document.querySelectorAll('.dep-timer').forEach(el => {
    const expiry = parseInt(el.getAttribute('data-expiry') || '0');
    const refId = el.getAttribute('data-ref');
    const left = Math.max(0, expiry - now);
    el.innerText = `⏳ ${formatTime(left)}`;

    if (left === 0 && !el.hasAttribute('data-canceling')) {
      el.setAttribute('data-canceling', 'true');
      autoCancelDeposit(refId, true);
    }
  });
}, 1000);

window.addEventListener('load', init);
