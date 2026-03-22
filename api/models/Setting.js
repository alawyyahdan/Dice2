const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  configurationKey: { type: String, default: 'global_settings', unique: true },
  
  bounds: {
    maxStandard: { type: Number, default: 25000 },
    maxKombinasi: { type: Number, default: 12500 },
    maxJ4_17: { type: Number, default: 1500 },
    maxJ5_16: { type: Number, default: 5000 },
    maxJ6_15: { type: Number, default: 5000 },
    maxT: { type: Number, default: 1500 },
    maxL: { type: Number, default: 5000 },
    maxP: { type: Number, default: 17500 },
    maxTB: { type: Number, default: 2500 },
    maxDS: { type: Number, default: 12500 },
    maxTS: { type: Number, default: 1500 },
    maxTie: { type: Number, default: 17500 } // Naga, Harimau, Seri
  },
  
  odds: {
    standard: { type: Number, default: 1.95 },
    BGA_KGE: { type: Number, default: 3.4 },
    BGE_KGA: { type: Number, default: 4.4 },
    J4_17: { type: Number, default: 56 },
    J5_16: { type: Number, default: 27 },
    J6_15: { type: Number, default: 16 },
    J7_14: { type: Number, default: 12 },
    J8_13: { type: Number, default: 8 },
    J9_12: { type: Number, default: 7 },
    J10_11: { type: Number, default: 6 },
    T: { type: Number, default: 32 },
    L: { type: Number, default: 8 },
    P: { type: Number, default: 1.9 },
    TB: { type: Number, default: 1.99 },
    DS1: { type: Number, default: 2 },
    DS2: { type: Number, default: 3 },
    DS3: { type: Number, default: 10 },
    TS: { type: Number, default: 150 },
    N_H: { type: Number, default: 2 },
    S: { type: Number, default: 5 }
  },

  admin: {
    username: { type: String, default: '' },
    password: { type: String, default: '' },
    is2FAEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: '' },
    notificationTelegramId: { type: String, default: '' }
  },

  minBet: { type: Number, default: 1 },
  roundDuration: { type: Number, default: 1 }, // dlm menit
  isBotActive: { type: Boolean, default: true },
  isGroupActive: { type: Boolean, default: true },
  isLeaderboardActive: { type: Boolean, default: true },
  botStartTime: { type: Date, default: Date.now },
  groupStartTime: { type: Date, default: Date.now },

  paymentGateway: {
    providerType: { type: String, enum: ['sitranfer', 'manual', 'none'], default: 'sitranfer' },
    minDeposit: { type: Number, default: 10000 },
    maxDeposit: { type: Number, default: 50000000 },
    sitranfer: {
      merchantId: { type: String, default: '' },
      callbackUrl: { type: String, default: '' },
      warningText: { type: String, default: '⚠️ Silakan bayar sesuai nominal untuk mempercepat otomatisasi deposit Anda.' },
      methods: { 
        type: [{
          code: String,
          name: String,
          logoUrl: String,
          isActive: { type: Boolean, default: true }
        }],
        default: [
          { code: 'QRIS', name: 'QRIS Otomatis', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_QRIS.svg', isActive: true },
          { code: 'DANA', name: 'DANA Express', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Logo_dana_blue.svg', isActive: true }
        ]
      }
    },
    manual: {
      warningText: { type: String, default: '⚠️ Harap transfer dana lalu tunggu admin memvalidasi deposit Anda maksimal 1-5 menit.' },
      methods: {
        type: [{
          code: String,
          bankName: String,
          accountNumber: String,
          accountName: String,
          logoUrl: String,
          isActive: { type: Boolean, default: true }
        }],
        default: [
          { code: 'BCA', bankName: 'BCA', accountNumber: '1234567890', accountName: 'A/N BANDAR', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Bank_Central_Asia.svg', isActive: true }
        ]
      }
    },
    
    withdraw: {
      providerType: { type: String, enum: ['sitranfer', 'manual', 'none'], default: 'sitranfer' },
      autoWdLimit: { type: Number, default: 50 }, // in points (default: 50pt = Rp50.000)
      minWithdraw: { type: Number, default: 20 }, // in points
      maxWithdraw: { type: Number, default: 10000 }, // in points
      banks: {
        type: [{ code: String, name: String, isActive: { type: Boolean, default: true } }],
        default: [
          { code: 'BCA', name: 'BCA', isActive: true },
          { code: 'BRI', name: 'BRI', isActive: true },
          { code: 'BNI', name: 'BNI', isActive: true },
          { code: 'MANDIRI', name: 'Mandiri', isActive: true },
          { code: 'CIMB', name: 'CIMB Niaga', isActive: true },
          { code: 'PERMATA', name: 'Permata', isActive: true },
          { code: 'DANAMON', name: 'Danamon', isActive: true },
          { code: 'DANA', name: 'DANA', isActive: true },
          { code: 'OVO', name: 'OVO', isActive: true },
        ]
      }
    }
  },

  updatedAt: { type: Date, default: Date.now },

  strings: {
    // deposit
    depositInvoiceQR: { type: String, default: '🧾 <b>QR Pembayaran</b>\nNominal: <b>Rp {amount}</b>\n\nSilakan pindai QR ini untuk melunasi pembayara. Pesan ini akan terhapus otomatis setelah lunas.' },
    depositInvoiceLink: { type: String, default: '🧾 <b>Tagihan Pembayaran</b>\nNominal: <b>Rp {amount}</b>\n\nSilakan klik link di bawah ini untuk melunasi pembayaran. Pesan ini akan terhapus otomatis setelah lunas.' },
    depositInvoiceManual: { type: String, default: '🏦 <b>Instruksi Transfer Manual</b>\n\nBank: <b>{bankName}</b>\nRekening: <b>{accountNumber}</b>\nA/N: <b>{accountName}</b>\n\nSilakan transfer TEPAT: <b>Rp {amount}</b>\n\nPesan ini akan dihapus saat sudah dikonfirmasi.' },
    depositSuccess: { type: String, default: '✅ <b>Deposit Berhasil</b>\n\nNominal: <b>{amount} poin</b> telah masuk ke saldo Anda!\n\nSelamat bermain!' },
    depositFailed: { type: String, default: '❌ <b>Deposit Dibatalkan</b>\n\nNominal: <b>{amount} poin</b> ditolak oleh Admin. Silakan hubungi Customer Service jika ada kendala.' },
    // menuHandler
    welcomeMessage1: { type: String, default: '🎉 <b>Selamat Datang {nama}!</b>\n\nIni adalah pesan sambutan pertama. Silakan ganti teks dan gambar ini di Dashboard Admin.' },
    welcomeImage1: { type: String, default: 'https://placehold.co/600x400.png?text=Welcome+Image+1' },
    welcomeMessage2: { type: String, default: '💎 <b>Dapatkan Bonus Menarik!</b>\n\nIni adalah pesan sambutan kedua. Silakan atur sesuai keinginan Anda.' },
    welcomeImage2: { type: String, default: 'https://placehold.co/600x400.png?text=Welcome+Image+2' },
    welcome: { type: String, default: '👋 Selamat datang, <b>{nama}</b>!\n\nSilakan pilih menu di bawah ini:' },
    // betHandler
    bet_saldo_kurang: { type: String, default: '❌ Saldo tidak cukup!\n💰 Saldo kamu: <b>{saldo} poin</b>\n🎯 Bet yang diminta: <b>{bet} poin</b>' },
    bet_max_exceeded: { type: String, default: '❌ Melebihi batas maksimal bet!\n📊 Jenis: {jenis} | Max: <b>{max} poin</b>' },
    bet_anti_hedging: { type: String, default: '⚠️ <b>Anti-hedging</b>: Kamu tidak bisa bet B+K atau GA+GE dalam ronde yang sama!' },
    bet_ditutup: { type: String, default: '🛑 <b>TARUHAN DITUTUP!</b>\nTunggu sebentar boss, ronde baru belum dibuka! Jangan nyerobot ya.' },
    bet_grup_success: { type: String, default: '✅ <b>{username}</b> bet <b>{jenis}</b> ({bet} poin)\n💰 Saldo sisa: <b>{saldo} poin</b>' },
    bet_pc_confirm: { type: String, default: '🎲 <b>Konfirmasi Taruhan</b>\n\nJenis: <b>{jenis}</b>\nNominal: <b>{bet} poin</b>\n\nSiapa yang roll dadu?' },
    cashback_claimed: { type: String, default: '✨ <b>Cashback {cashback} poin berhasil diklaim!</b>\n\n💰 Saldo kamu bertambah!' },
    cashback_empty: { type: String, default: '✨ Kamu tidak punya cashback yang bisa diklaim.' },
    // diceHandler
    roll_timeout: { type: String, default: '⏰ <b>Waktu habis!</b> Taruhan dibatalkan.' },
    roll_user_start: { type: String, default: '🎲 <b>Giliran kamu!</b>\n\nTekan tombol 🎲 di bawah <b>3 kali</b> untuk roll dadu.\n⏱ Timeout 2 Menit.' },
    result_win: { type: String, default: 'Hasil lotere ke-<code>{round_id}</code>\n{d1}+{d2}+{d3}={total} {kategori}\n\n✅ <b>MENANG! +{payout} poin</b>\n💰 Saldo: <b>{saldo} poin</b>' },
    result_lose: { type: String, default: 'Hasil lotere ke-<code>{round_id}</code>\n{d1}+{d2}+{d3}={total} {kategori}\n\n❌ <b>KALAH -{bet} poin</b>\n💰 Saldo: <b>{saldo} poin</b>' },
    // groupGameManager
    round_warning: { type: String, default: '⚠️ <b>Peringatan!</b>\nTaruhan periode <code>{round_id}</code> akan ditutup dalam <b>10 detik</b>!' },
    round_close: { type: String, default: '🛑 <b>Taruhan Ditutup!</b>\nPeriode: <code>{round_id}</code>\n\n<b>Pemain:</b>\n{players}\n🎲 <b>Bot sedang memutar dadu...</b>' },
    round_open: { type: String, default: '🟢 <b>Taruhan Dibuka!</b>\nPeriode: <code>{next_round_id}</code>\n\n<i>Ketik format taruhan di grup ini (contoh: B100)</i>' },
    // transferHandler
    tf_success: { type: String, default: '✅ <b>Transfer Berhasil!</b>\n\nNominal: {nominal} pt\nDari: {pengirim}\nKe ID: {target_id} ({penerima})' },
    tf_saldo_kurang: { type: String, default: '⚠️ Saldo tidak cukup!\nSaldo Anda: {saldo} pt' },
    // angpaoHandler
    angpao_caption: { type: String, default: '🧧 <b>ANGPAO DIBAGIKAN!</b>\n\nOleh: {creator}\nTotal Nominal: {nominal} pt\nKuota: {kuota} orang\nTipe: {tipe}\n\n<i>Siapa cepat dia dapat!</i>' },
    angpao_image: { type: String, default: 'https://img.freepik.com/foto-gratis/gadis-asia-mengenakan-gaun-qipao-tradisional-memegang-angpao-atau-hadiah-uang-paket-merah_74952-3362.jpg?semt=ais_rp_progressive&w=740&q=80' },
    angpao_claim_success: { type: String, default: '🎉 YAY! Anda mendapatkan {nominal} pt dari Angpao ini!' },
    angpao_habis: { type: String, default: '😢 Yah, Angpao sudah habis terclaim!' },
    angpao_sudah_klaim: { type: String, default: '⚠️ Anda sudah mengambil Angpao ini!' },
    maintenance_msg: { type: String, default: '⚠️ <b>Bot sedang Maintenance</b>\n\nMaaf Bos, saat ini sistem sedang dalam perbaikan untuk meningkatkan layanan. Silakan coba lagi nanti ya!' },
    group_link: { type: String, default: '' },
    cs_contact_link: { type: String, default: '' },
  }
});

module.exports = mongoose.model('Setting', settingSchema, 'system_settings');
