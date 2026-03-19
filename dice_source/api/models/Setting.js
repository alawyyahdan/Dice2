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

  minBet: { type: Number, default: 1 },
  roundDuration: { type: Number, default: 1 }, // dlm menit
  isBotActive: { type: Boolean, default: true },
  isGroupActive: { type: Boolean, default: true },
  botStartTime: { type: Date, default: Date.now },
  groupStartTime: { type: Date, default: Date.now },

  updatedAt: { type: Date, default: Date.now },

  strings: {
    // menuHandler
    welcome: { type: String, default: '👋 Selamat datang, <b>{nama}</b>!\n\nSilakan pilih menu di bawah ini:' },
    saldo_info: { type: String, default: '💰 <b>Informasi Saldo Kamu</b>\n\n👤 Nama: {nama}\n🆔 ID: {id}\n\n💵 Saldo: <b>{saldo} poin</b>\n📥 Total Deposit: {total_deposit} poin\n🎯 Sisa Turnover: {sisa_to}\n✨ Cashback Pending: {cashback} poin (ketik TR untuk klaim)' },
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
    angpao_claim_success: { type: String, default: '🎉 YAY! Anda mendapatkan {nominal} pt dari Angpao ini!' },
    angpao_habis: { type: String, default: '😢 Yah, Angpao sudah habis terclaim!' },
    angpao_sudah_klaim: { type: String, default: '⚠️ Anda sudah mengambil Angpao ini!' },
    // infoHandler
    cs_contact: { type: String, default: '📞 <b>Pusat Bantuan (CS)</b>\n\nJika deposit telat masuk, withdraw bermasalah, atau terjadi error bot, silakan hubungi Customer Service kami:\n\n👤 Telegram CS: @AdminDice\n🕒 Operasional: 24 Jam Non-Stop' },
    maintenance_msg: { type: String, default: '⚠️ <b>Bot sedang Maintenance</b>\n\nMaaf Bos, saat ini sistem sedang dalam perbaikan untuk meningkatkan layanan. Silakan coba lagi nanti ya!' },
  }
});

module.exports = mongoose.model('Setting', settingSchema, 'system_settings');
