# Instruction: Telegram Dice Game Bot System

## Overview
Bangun sistem lengkap untuk game dadu (Sic Bo) berbasis Telegram. Sistem terdiri dari **3 komponen utama** yang saling terhubung:

1. **Bot Telegram** — game engine + menu interaktif dengan Inline Keyboard
2. **Mini App Telegram (Web App)** — halaman withdraw yang dibuka di dalam Telegram
3. **Dashboard Admin (Next.js)** — panel admin untuk monitoring & manajemen

---

## Tech Stack

| Komponen | Teknologi |
|---|---|
| Bot | Node.js + Telegraf v4 |
| Backend API | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| Dashboard Admin | Next.js 14 (App Router) + Tailwind CSS |
| Mini App | HTML + Vanilla JS (dihosting di Express) |
| Auth Admin | JWT (jsonwebtoken) |
| Deploy | Ubuntu VPS (PM2 untuk process manager) |

---

## Struktur Folder Proyek

```
/
├── bot/                        # Telegram Bot
│   ├── index.js                # Entry point bot
│   ├── handlers/
│   │   ├── menuHandler.js      # Handler tombol menu utama
│   │   ├── betHandler.js       # Handler parse & proses taruhan
│   │   ├── diceHandler.js      # Handler roll dadu & baca nilai
│   │   ├── walletHandler.js    # Handler deposit & withdraw
│   │   └── infoHandler.js      # Handler saldo & history
│   ├── utils/
│   │   ├── betParser.js        # Parse format taruhan user
│   │   ├── diceCalculator.js   # Hitung menang/kalah & odds
│   │   └── keyboard.js         # Definisi semua inline keyboard
│   └── middlewares/
│       └── userMiddleware.js   # Auto-create user jika belum ada
│
├── api/                        # Express Backend API
│   ├── server.js               # Entry point API
│   ├── routes/
│   │   ├── auth.js             # POST /api/auth/login (admin)
│   │   ├── users.js            # GET /api/users (list + saldo)
│   │   ├── bets.js             # GET /api/bets (history semua taruhan)
│   │   ├── withdraw.js         # GET/POST/PATCH /api/withdraw
│   │   └── balance.js          # PATCH /api/balance/adjust (tambah/kurang manual)
│   ├── models/
│   │   ├── User.js             # Schema user
│   │   ├── Bet.js              # Schema taruhan
│   │   └── Withdraw.js         # Schema request withdraw
│   ├── middlewares/
│   │   └── authMiddleware.js   # Verifikasi JWT
│   └── config/
│       └── db.js               # Koneksi MongoDB
│
├── miniapp/                    # Telegram Mini App (Withdraw)
│   ├── index.html              # Halaman utama mini app
│   ├── style.css
│   └── app.js                  # Logic Telegram WebApp SDK
│
└── dashboard/                  # Next.js Admin Dashboard
    ├── app/
    │   ├── layout.js
    │   ├── page.js             # Redirect ke /login
    │   ├── login/
    │   │   └── page.js         # Halaman login admin
    │   └── dashboard/
    │       ├── layout.js       # Layout dengan sidebar
    │       ├── page.js         # Overview / ringkasan
    │       ├── users/
    │       │   └── page.js     # List semua user & saldo
    │       ├── bets/
    │       │   └── page.js     # History semua taruhan
    │       ├── withdraw/
    │       │   └── page.js     # Kelola withdraw (approve/reject)
    │       └── balance/
    │           └── page.js     # Adjust saldo manual
    ├── components/
    │   ├── Sidebar.js
    │   ├── StatsCard.js
    │   ├── DataTable.js
    │   └── WithdrawCard.js
    └── lib/
        ├── api.js              # Fetch wrapper ke backend API
        └── auth.js             # JWT helper (simpan di cookie)
```

---

## 1. Database Schema (MongoDB + Mongoose)

### Model: User
```js
{
  telegramId: { type: String, unique: true, required: true },
  username: String,
  firstName: String,
  balance: { type: Number, default: 0 },           // dalam poin
  totalDeposit: { type: Number, default: 0 },
  turnover: { type: Number, default: 0 },           // akumulasi bet sejak deposit terakhir
  turnoverRequired: { type: Number, default: 0 },   // 2x deposit terakhir
  cashback: { type: Number, default: 0 },           // cashback pending (1% per bet)
  createdAt: { type: Date, default: Date.now },
  lastActive: Date
}
```

### Model: Bet
```js
{
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  telegramId: String,
  roundId: String,                    // ID ronde dari bot
  betType: String,                    // 'B','K','GA','GE','BGA','BGE','KGA','KGE',
                                      // 'J','T','L','P','TB','DS','TS','N','H','S'
  betAmount: Number,
  odds: Number,
  diceResult: [Number],               // [dadu1, dadu2, dadu3]
  diceTotal: Number,
  isWin: Boolean,
  payout: Number,                     // jumlah yang diterima (0 jika kalah)
  profit: Number,                     // payout - betAmount
  cashbackAmount: Number,             // 1% dari betAmount
  rolledBy: { type: String, enum: ['user', 'bot'] },
  createdAt: { type: Date, default: Date.now }
}
```

### Model: Withdraw
```js
{
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  telegramId: String,
  amount: Number,                     // dalam poin
  bankName: String,
  accountNumber: String,
  accountName: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNote: String,                  // catatan dari admin saat reject
  processedAt: Date,
  createdAt: { type: Date, default: Date.now }
}
```

---

## 2. Bot Telegram

### Setup & Entry Point (`bot/index.js`)
- Inisialisasi Telegraf dengan `BOT_TOKEN` dari `.env`
- Koneksi ke MongoDB
- Register semua handler
- Launch bot dengan `bot.launch()`

### Menu Utama — Inline Keyboard
Setiap kali user ketik `/start` atau klik tombol "Menu", tampilkan pesan sambutan dengan **Inline Keyboard** 2 kolom:

```
[ 📊 Saldo ]        [ 📜 History Taruhan ]
[ 💸 Withdraw ]     [ 👥 Ke Grup ]
[ 📞 Kontak CS ]
```

- **Saldo**: balas dengan info saldo, total deposit, turnover saat ini vs required
- **History Taruhan**: tampilkan 10 taruhan terakhir user dalam format tabel teks
- **Withdraw**: buka Mini App Telegram via `web_app: { url: MINIAPP_URL }`
- **Ke Grup**: kirim link invite grup Telegram
- **Kontak CS**: kirim link atau username CS

### Handler Taruhan (`bot/handlers/betHandler.js`)

**Format input dari user:**
```
B100          → Besar 100 poin
K50           → Kecil 50 poin
GA200         → Ganjil 200 poin
GE100         → Genap 100 poin
BGA150        → Besar Ganjil 150 poin
BGE100        → Besar Genap 100 poin
KGA100        → Kecil Ganjil 100 poin
KGE100        → Kecil Genap 100 poin
11J100        → Jumlah 11, taruhan 100 poin
T100          → Triple (sembarang), 100 poin
L100          → Lurus, 100 poin
P100          → Pasangan, 100 poin
TB100         → Tiga Berbeda, 100 poin
5DS100        → Dadu Spesifik angka 5, 100 poin
5TS100        → Triple Spesifik angka 5, 100 poin
N100          → Naga, 100 poin
H100          → Harimau, 100 poin
S100          → Seri, 100 poin
```

**Alur setelah parse taruhan:**
1. Validasi format — jika salah, balas dengan contoh format yang benar
2. Cek saldo user mencukupi — jika tidak, balas info saldo kurang
3. Cek max bet per jenis taruhan (sesuai aturan)
4. Cek anti-hedging: tolak jika user bet B+K atau GA+GE dalam ronde yang sama
5. Simpan taruhan sementara (pending) di memory / Redis / session
6. Tanya user: **"Roll oleh siapa?"** dengan Inline Keyboard:
   ```
   [ 🎲 Saya yang Roll ]   [ 🤖 Bot yang Roll ]
   ```

### Handler Dadu (`bot/handlers/diceHandler.js`)

**Jika user pilih "Bot yang Roll":**
- Bot kirim `bot.sendDice(chatId, { emoji: '🎲' })` sebanyak 3 kali berurutan
- Delay antar kirim: 1.5 detik
- Baca `message.dice.value` dari setiap response
- Simpan `[dadu1, dadu2, dadu3]`

**Jika user pilih "User yang Roll":**
- Bot kirim instruksi: *"Giliran kamu! Kirim emoji dadu 🎲 sebanyak 3 kali"*
- Bot listen `message.dice` dari user tersebut (filter by `telegramId` dan `chatId`)
- Timeout 30 detik — jika tidak ada, batalkan taruhan & kembalikan saldo
- Kumpulkan 3 nilai dadu dari user
- **PENTING**: Nilai dadu di Telegram diambil dari `message.dice.value`, bukan dari emoji yang terlihat. Telegram menentukan nilai random server-side.

**Setelah dapat 3 nilai dadu:**
1. Hitung `total = dadu1 + dadu2 + dadu3`
2. Panggil `diceCalculator.js` untuk hitung menang/kalah
3. Update saldo user di MongoDB
4. Tambah `turnover += betAmount`
5. Tambah `cashback += betAmount * 0.01`
6. Kirim hasil ke chat:
   ```
   🎲 Hasil: [dadu1] [dadu2] [dadu3]
   📊 Total: {total}
   
   ✅ MENANG! +{payout} poin   ATAU   ❌ KALAH -{betAmount} poin
   
   💰 Saldo sekarang: {balance} poin
   ```

### Aturan Game (`bot/utils/diceCalculator.js`)

Implementasikan semua odds dan kondisi menang sesuai aturan berikut:

**Aturan khusus — Triple Override:**
- Jika `dadu1 === dadu2 === dadu3`, semua taruhan SELAIN `T` (Triple) dan `TS` (Triple Spesifik) dinyatakan **KALAH**
- Jika user bet `T`: menang dengan odds 32x
- Jika user bet `5TS` dan hasil triple = 5: menang dengan odds 150x

**Odds lengkap:**
```
B (Besar 11-18):     1.95x
K (Kecil 3-10):      1.95x
GA (Ganjil):         1.95x
GE (Genap):          1.95x
BGA (Besar Ganjil):  3.4x   → hasil: 11,13,15,17
BGE (Besar Genap):   4.4x   → hasil: 12,14,16,18
KGA (Kecil Ganjil):  4.4x   → hasil: 3,5,7,9
KGE (Kecil Genap):   3.4x   → hasil: 4,6,8,10
J4 / J17:            56x
J5 / J16:            27x
J6 / J15:            16x
J7 / J14:            12x
J8 / J13:            8x
J9 / J12:            7x
J10 / J11:           6x
T (Triple):          32x
L (Lurus):           8x     → 3 angka berurutan, misal [1,2,3] [4,5,6]
P (Pasangan):        1.9x   → 2 angka sama
TB (Tiga Berbeda):   1.99x  → 3 angka berbeda dan bukan lurus
DS (Dadu Spesifik):
  1 dadu cocok:      2x
  2 dadu cocok:      3x
  3 dadu cocok:      10x
TS (Triple Spesifik): 150x  → 3 dadu sama & sesuai angka yang dipilih
N (Naga): 2x   → dadu1 > dadu3
H (Harimau): 2x → dadu3 > dadu1
S (Seri): 5x   → dadu1 === dadu3
```

**Max bet per jenis (tolak jika melebihi):**
```
B/K/GA/GE:  25000
Kombinasi:  12500
J (Jumlah 4/17): 1500 | J (5/16): 5000 | J (6-10/11-15): 5000
T:          1500
L:          5000
P:          17500
TB:         2500
DS:         12500
TS:         1500
N/H/S:      17500
```

### Cashback (`TR`)
- Jika user ketik `TR`, cek `user.cashback > 0`
- Transfer cashback ke saldo
- Reset `user.cashback = 0`
- Balas: *"✨ Cashback {amount} poin berhasil diklaim!"*

### Deposit
- User ketik `/deposit {nominal}` atau lewat menu
- Bot verifikasi minimal 10 poin
- Update `user.balance += nominal`
- Reset `user.turnover = 0`
- Set `user.turnoverRequired = nominal * 2`
- Balas konfirmasi

---

## 3. Mini App Telegram (Withdraw)

File: `miniapp/index.html`

**Alur:**
1. Buka via tombol Withdraw di bot → terbuka sebagai Telegram Web App
2. Ambil data user dari `Telegram.WebApp.initDataUnsafe.user`
3. Fetch saldo user dari API: `GET /api/miniapp/user-info?telegramId=xxx`
4. Tampilkan form withdraw:
   - Input nominal (minimal 20 poin, harus punya turnover cukup)
   - Input nama bank
   - Input nomor rekening
   - Input nama pemilik rekening
5. Validasi client-side sebelum submit
6. Submit ke `POST /api/miniapp/withdraw`
7. Bot API endpoint verifikasi `initData` dari Telegram untuk keamanan
8. Tampilkan status sukses / error
9. Panggil `Telegram.WebApp.close()` setelah sukses

**UI Mini App:**
- Gunakan Telegram Web App CSS variables (`--tg-theme-bg-color`, `--tg-theme-text-color`, dll) agar menyesuaikan tema Telegram user
- Tombol submit gunakan `Telegram.WebApp.MainButton`
- Tampilkan saldo saat ini dan info turnover (apakah sudah cukup untuk WD)
- Jika turnover belum cukup, tampilkan peringatan dengan info kekurangan turnover

---

## 4. Express API

### Endpoints

**Auth Admin:**
```
POST /api/auth/login
  body: { username, password }
  response: { token }
```

**Users (Auth required):**
```
GET  /api/users?page=1&limit=20&search=xxx
  response: { users: [...], total, page }

GET  /api/users/:telegramId
  response: { user detail + recent bets }

PATCH /api/balance/adjust
  body: { telegramId, amount, note }   // amount bisa negatif
  response: { updatedBalance }
```

**Bets (Auth required):**
```
GET  /api/bets?page=1&limit=20&telegramId=xxx&betType=xxx&dateFrom=xxx&dateTo=xxx
  response: { bets: [...], total, stats: { totalBet, totalWin, totalLose, totalProfit } }
```

**Withdraw (Auth required untuk admin):**
```
GET  /api/withdraw?status=pending&page=1
  response: { requests: [...], total }

PATCH /api/withdraw/:id/approve
  body: { adminNote? }
  → update status ke 'approved', kurangi saldo user, kirim notif ke user via bot

PATCH /api/withdraw/:id/reject
  body: { adminNote }
  → update status ke 'rejected', kembalikan saldo, kirim notif ke user via bot
```

**Mini App (No auth, tapi verifikasi Telegram initData):**
```
GET  /api/miniapp/user-info?telegramId=xxx
POST /api/miniapp/withdraw
  body: { initData, telegramId, amount, bankName, accountNumber, accountName }
```

### Notifikasi Bot ke User
Saat admin approve/reject withdraw, API memanggil Telegram Bot API langsung:
```
POST https://api.telegram.org/bot{TOKEN}/sendMessage
  body: { chat_id: telegramId, text: "pesan notifikasi" }
```

---

## 5. Dashboard Admin (Next.js)

### Halaman Login (`/login`)
- Form username + password
- Submit ke `POST /api/auth/login`
- Simpan JWT ke httpOnly cookie
- Redirect ke `/dashboard`

### Layout Dashboard
Sidebar kiri dengan navigasi:
- 📊 Overview
- 👥 Users
- 🎲 History Taruhan
- 💸 Withdraw
- 💰 Adjust Saldo

### Halaman Overview (`/dashboard`)
Tampilkan stats card:
- Total user terdaftar
- Total taruhan hari ini
- Total volume bet hari ini (dalam poin)
- Withdraw pending (jumlah request)
- Grafik taruhan 7 hari terakhir (gunakan Recharts)

### Halaman Users (`/dashboard/users`)
- Tabel dengan kolom: Telegram ID, Username, Nama, Saldo, Total Deposit, Turnover, Last Active, Aksi
- Search by username / telegramId
- Tombol per row: "Lihat Detail" + "Adjust Saldo"
- Modal Adjust Saldo: input nominal (bisa negatif), keterangan

### Halaman History Taruhan (`/dashboard/bets`)
- Tabel: Waktu, User, Jenis Bet, Nominal, Dadu, Total, Menang/Kalah, Payout
- Filter by: user, jenis bet, tanggal, menang/kalah
- Stats di atas: total bet, total menang, total kalah, house edge

### Halaman Withdraw (`/dashboard/withdraw`)
- Tab: Pending | Approved | Rejected
- Card per request dengan info: user, nominal, bank, rekening, waktu request
- Tombol Approve (hijau) dan Reject (merah)
- Modal Reject: input alasan penolakan
- Real-time atau auto-refresh setiap 30 detik untuk pending

### Halaman Adjust Saldo (`/dashboard/balance`)
- Form: cari user (autocomplete by username/telegramId)
- Input nominal (+ untuk tambah, - untuk kurang)
- Input keterangan
- Riwayat adjustment terbaru

---

## 6. Environment Variables

Buat file `.env` di root setiap service:

**Bot & API (bisa 1 file jika monorepo):**
```env
BOT_TOKEN=your_telegram_bot_token
MONGODB_URI=mongodb://localhost:27017/dicegame
JWT_SECRET=your_jwt_secret_random_string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
MINIAPP_URL=https://yourdomain.com/miniapp
GROUP_LINK=https://t.me/your_group
CS_USERNAME=@your_cs_username
PORT=3001
```

**Dashboard Next.js:**
```env
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
API_SECRET=same_jwt_secret
```

---

## 7. Deployment (Ubuntu VPS)

### Struktur Deploy
```
/var/www/dicegame/
├── bot/          → pm2 start index.js --name "dice-bot"
├── api/          → pm2 start server.js --name "dice-api"
├── miniapp/      → dihosting via Express (static files di /api/public/miniapp)
└── dashboard/    → next build → pm2 start npm --name "dice-dashboard" -- start
```

### Nginx Config
```nginx
# API + Mini App
server {
    server_name yourdomain.com;
    location /api { proxy_pass http://localhost:3001; }
    location /miniapp { proxy_pass http://localhost:3001; }
}

# Dashboard
server {
    server_name admin.yourdomain.com;
    location / { proxy_pass http://localhost:3000; }
}
```

### PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 8. Catatan Penting untuk Implementasi

1. **Keamanan Mini App**: Selalu verifikasi `initData` dari Telegram menggunakan HMAC-SHA256 dengan `BOT_TOKEN` sebelum proses request withdraw dari mini app.

2. **Race Condition Bet**: Gunakan MongoDB transaction atau atomic update (`findOneAndUpdate` dengan `$inc`) untuk update saldo agar tidak ada double-spend.

3. **Session Taruhan**: Simpan state taruhan yang sedang berlangsung (menunggu roll dadu) di Map JavaScript in-memory per `telegramId`, bukan di database, untuk performa.

4. **Timeout Roll**: Jika user pilih roll sendiri tapi tidak kirim emoji dadu dalam 30 detik, batalkan otomatis dan kembalikan saldo dengan `setTimeout`.

5. **Anti-Hedging**: Cek sebelum simpan taruhan — jika user sudah ada taruhan B dalam ronde yang sama, tolak taruhan K, dan sebaliknya. Sama untuk GA/GE.

6. **Turnover Reset**: Setiap kali ada deposit, reset `turnover = 0` dan set `turnoverRequired = depositAmount * 2`.

7. **Notifikasi Withdraw**: Saat admin approve atau reject, langsung kirim pesan ke user via Telegram Bot API (bukan lewat bot instance, tapi HTTP langsung ke Telegram API agar tidak tergantung bot sedang running).

8. **Dashboard Auth**: Semua route `/dashboard/*` di Next.js harus cek JWT dari cookie di middleware. Jika tidak valid, redirect ke `/login`.

9. **Triple Override**: Implementasi dengan benar — saat hasil triple, SEMUA taruhan non-triple dalam ronde tersebut kalah, termasuk Besar/Kecil/Ganjil/Genap yang secara teori "harusnya menang".

10. **Cashback Akumulasi**: Cashback 1% tidak langsung masuk saldo — dikumpulkan dulu di field `user.cashback` dan hanya cair saat user ketik `TR`.
