# 🎲 Dice Game Bot System

Sistem game dadu (Sic Bo) berbasis Telegram — lengkap dengan:
- 🤖 **Bot Telegram** (Node.js + Telegraf v4)
- 🌐 **Backend API** (Express.js)
- 📱 **Mini App Telegram** (Withdraw dalam Telegram)
- 🖥️ **Dashboard Admin** (Next.js 14 + Tailwind CSS)
- 🗄️ **Database** (MongoDB + Mongoose)

---

## 📁 Struktur

```
Dice2/
├── bot/          # Telegram Bot
├── api/          # Express Backend API
├── miniapp/      # Telegram Mini App (Withdraw)
└── dashboard/    # Next.js Admin Dashboard
```

---

## 🚀 Quick Start

### 1. Isi .env
```bash
cp .env.example .env
# Edit .env dan isi: BOT_TOKEN, MONGODB_URI, JWT_SECRET, dll
```

### 2. Install Dependencies
```bash
cd bot && npm install && cd ..
cd api && npm install && cd ..
cd dashboard && npm install && cd ..
```

### 3. Jalankan (Development)
```bash
# Terminal 1 - API
cd api && npm run dev

# Terminal 2 - Bot
cd bot && npm run dev

# Terminal 3 - Dashboard
cd dashboard && npm run dev
```

### 4. Dashboard
Buka http://localhost:3000 → login dengan ADMIN_USERNAME dan ADMIN_PASSWORD dari .env

---

## 🎮 Format Taruhan

| Format | Artinya | Odds |
|--------|---------|------|
| `B100` | Besar (11-18) 100 poin | 1.95x |
| `K100` | Kecil (3-10) 100 poin | 1.95x |
| `GA100` | Ganjil 100 poin | 1.95x |
| `GE100` | Genap 100 poin | 1.95x |
| `BGA100` | Besar Ganjil | 3.4x |
| `BGE100` | Besar Genap | 4.4x |
| `11J100` | Jumlah 11 | 6x |
| `T100` | Triple sembarang | 32x |
| `5TS100` | Triple Spesifik 5 | 150x |
| `5DS100` | Dadu Spesifik angka 5 | 2-10x |
| `N100` | Naga (d1>d3) | 2x |
| `TR` | Klaim cashback | - |

---

## 🌐 Deploy (VPS)
```bash
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

---

## 📌 Catatan Penting
- **Triple Override**: Jika dadu triple, semua taruhan selain T & TS kalah
- **Anti-hedging**: Tidak boleh bet B+K atau GA+GE dalam ronde yang sama
- **Turnover**: Syarat withdraw = 2x total deposit
- **Cashback**: 1% per bet, klaim manual dengan ketik `TR`
