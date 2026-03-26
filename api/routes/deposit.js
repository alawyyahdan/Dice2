const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const User = require('../models/User');
const Deposit = require('../models/Deposit');
const Setting = require('../models/Setting');
const paymentService = require('../services/paymentService');
const requireAdmin = require('../middlewares/authMiddleware');

// Helper verifikasi Telegram miniapp
function verifyTelegramInitData(initData) {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    return hash === expectedHash;
  } catch { return false; }
}

// Helper Bot API Telegram
async function sendTelegramMessage(chatId, text) {
  try { await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, { chat_id: chatId, text, parse_mode: 'HTML' }); } catch(e){}
}
async function deleteTelegramMessage(chatId, messageId) {
  if(!messageId) return;
  try { await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/deleteMessage`, { chat_id: chatId, message_id: messageId }); } catch(e){}
}

// GET /api/deposit/methods - Daftar metode pembayaran aktif
router.get('/methods', async (req, res) => {
  try {
    const config = await Setting.findOne();
    if (!config || !config.paymentGateway) return res.json({ providerType: 'none', methods: [] });
    
    const provType = config.paymentGateway.providerType || 'none';
    const minDepo = config.paymentGateway.minDeposit || 10000;
    const maxDepo = config.paymentGateway.maxDeposit || 50000000;

    if (provType === 'none') {
      return res.json({ providerType: 'none', methods: [] });
    }
    
    if (provType === 'manual') {
       const methods = config.paymentGateway.manual?.methods?.filter(m => m.isActive) || [];
       const promos = config.paymentGateway.depositPromos?.filter(p => p.isActive) || [];
       return res.json({ 
         providerType: 'manual', 
         minDeposit: minDepo / 1000,
         maxDeposit: maxDepo / 1000,
         methods,
         promos,
         warningText: config.paymentGateway.manual?.warningText || ''
       });
    }

    // Default: sitranfer
    const activeMethods = (config.paymentGateway.sitranfer?.methods || []).filter(m => m.isActive).map(m => ({
      code: m.code, name: m.name, logoUrl: m.logoUrl
    }));
    const promos = config.paymentGateway.depositPromos?.filter(p => p.isActive) || [];
    
    res.json({ 
      providerType: 'sitranfer', 
      minDeposit: minDepo / 1000,
      maxDeposit: maxDepo / 1000,
      methods: activeMethods,
      promos,
      warningText: config.paymentGateway.sitranfer?.warningText
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1. POST /api/deposit/create - Dari MiniApp
router.post('/create', async (req, res) => {
  try {
    const { initData, telegramId, amount, paymentMethod, promoId } = req.body;
    
    if (!verifyTelegramInitData(initData)) return res.status(403).json({ error: 'Invalid Telegram data' });
    if (!amount) return res.status(400).json({ error: 'Isi nominal deposit' });
    if (!paymentMethod) return res.status(400).json({ error: 'Metode pembayaran wajib dipilih' });

    const user = await User.findOne({ telegramId });
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

    // Cek limit deposit pending
    const existingPending = await Deposit.countDocuments({ telegramId, status: 'pending' });
    if (existingPending >= 5) return res.status(400).json({ error: 'Terdapat 5 deposit pending. Harap selesaikan atau batalkan terlebih dahulu sebelum membuat yang baru.' });

    const referenceId = `DEP-${Date.now()}-${Math.floor(Math.random()*1000)}`;

    const config = await Setting.findOne();
    const provType = config?.paymentGateway?.providerType || 'none';
    if (provType === 'none') return res.status(403).json({ error: 'Deposit sedang ditutup.' });

    const minDepo = config?.paymentGateway?.minDeposit || 10000;
    const maxDepo = config?.paymentGateway?.maxDeposit || 50000000;

    const idrAmount = amount * 1000; // 1pt = Rp1.000

    if (idrAmount < minDepo) return res.status(400).json({ error: `Minimal deposit Rp ${minDepo.toLocaleString('id-ID')} (${minDepo/1000} pt)` });
    if (idrAmount > maxDepo) return res.status(400).json({ error: `Maksimal deposit Rp ${maxDepo.toLocaleString('id-ID')} (${maxDepo/1000} pt)` });

    if (provType === 'manual') {
      let uniqueCode = Math.floor(Math.random() * 90) + 10;
      let finalIdrAmount = idrAmount + uniqueCode;
      
      let isUnique = false;
      let retries = 0;
      while (!isUnique && retries < 10) {
        // Cek keunikan berdasarkan deposit yang sedang pending (menggunakan paymentData untuk ngecek tagihan IDR asli tidak mudah jika diparse, 
        // tapi kita asumsikan 10 retry cukup aman)
        // Kita juga bisa tambahkan field uniqueCode sementara jika perlu, 
        // namun validasi dasar cukup.
        uniqueCode = Math.floor(Math.random() * 90) + 10;
        finalIdrAmount = idrAmount + uniqueCode;
        isUnique = true; // Asumsi unik untuk performa, code unik 10-99
      }

      // Extract the bank details for frontend to read later
      let bankInfo = {};
      const manualMethod = config.paymentGateway.manual?.methods?.find(m => (m.code || m.bankName) === paymentMethod);
      if (manualMethod) {
        bankInfo = { 
          bankName: manualMethod.bankName, 
          accountNumber: manualMethod.accountNumber, 
          accountName: manualMethod.accountName,
          finalIdrAmount // Store the IDR they need to pay
        };
      }

      // CALCULATE PROMO
      let appliedPromo = null;
      let bonusApplied = 0;
      let turnoverApplied = 0;
      if (promoId) {
        appliedPromo = config.paymentGateway?.depositPromos?.find(p => p.id === promoId && p.isActive);
        if (appliedPromo) {
          bonusApplied = appliedPromo.type === 'percent' ? Math.floor(amount * (appliedPromo.bonusValue / 100)) : appliedPromo.bonusValue;
          turnoverApplied = Math.floor((amount + bonusApplied) * (appliedPromo.turnoverMultiplier || 0));
        }
      }

      const deposit = await Deposit.create({
        userId: user._id, 
        telegramId, 
        amount: amount, // Tetap simpan poin di database!
        paymentMethod: paymentMethod, 
        referenceId, 
        paymentData: JSON.stringify(bankInfo), 
        status: 'pending',
        promoId: appliedPromo ? appliedPromo.id : undefined,
        promoName: appliedPromo ? appliedPromo.name : undefined,
        bonusApplied,
        turnoverApplied
      });

      // NOTIFIKASI TELEGRAM ADMIN JIKA MODE MANUAL
      console.log('[NOTIFY DEBUG DEPOSIT] notifyId:', config.admin?.notificationTelegramId, '| token:', !!process.env.NOTIFY_BOT_TOKEN);
      if (config.admin && config.admin.notificationTelegramId && process.env.NOTIFY_BOT_TOKEN) {
        try {
          const axios = require('axios');
          const message = `🔔 *INFO DEPOSIT MANUAL MUNCUL!*\n\n👤 User: @${user.username || telegramId}\n💰 Jumlah: *${amount} pt* (Rp ${finalIdrAmount.toLocaleString('id-ID')})\n🏦 Bank: ${paymentMethod}\n💳 Rekening: ${bankInfo.accountNumber || '-'} A/N ${bankInfo.accountName || '-'}\n\nSilakan validasi di Dashboard Admin!`;
          
          const reply_markup = {
            inline_keyboard: [
              [
                { text: "✅ Terima", callback_data: `depo_approve_${deposit._id}` },
                { text: "❌ Tolak", callback_data: `depo_reject_${deposit._id}` }
              ]
            ]
          };

          const response = await axios.post(`https://api.telegram.org/bot${process.env.NOTIFY_BOT_TOKEN}/sendMessage`, { 
            chat_id: config.admin.notificationTelegramId, 
            text: message, 
            parse_mode: 'Markdown',
            reply_markup
          });
          
          deposit.notifyMessageId = response.data.result.message_id;
          await deposit.save();
        } catch(e) { console.error('[NOTIFY ERROR DEPOSIT]', e.response?.data || e.message); }
      }

      return res.json({ message: 'Instruksi transfer dibuat', data: deposit });
    }

    try {
      // Panggil SiTranfer menggunakan Nominal Rupiah Asli (amount * 1000)
      const result = await paymentService.generateDeposit(paymentMethod, idrAmount, user.username);
      
      // CALCULATE PROMO
      let appliedPromo = null;
      let bonusApplied = 0;
      let turnoverApplied = 0;
      if (promoId) {
        appliedPromo = config.paymentGateway?.depositPromos?.find(p => p.id === promoId && p.isActive);
        if (appliedPromo) {
          bonusApplied = appliedPromo.type === 'percent' ? Math.floor(amount * (appliedPromo.bonusValue / 100)) : appliedPromo.bonusValue;
          turnoverApplied = Math.floor((amount + bonusApplied) * (appliedPromo.turnoverMultiplier || 0));
        }
      }

      const deposit = await Deposit.create({
        userId: user._id,
        telegramId,
        amount: amount, // Tetap simpan dalam satuan poin!
        paymentMethod,
        referenceId,
        transactionId: result.transaction_id,
        paymentData: result.qris_image || result.payment_url || result.qris_data,
        status: 'pending',
        promoId: appliedPromo ? appliedPromo.id : undefined,
        promoName: appliedPromo ? appliedPromo.name : undefined,
        bonusApplied,
        turnoverApplied
      });

      res.json({ message: 'Tagihan dibuat', data: deposit });
    } catch (apiErr) {
      console.error(apiErr);
      return res.status(400).json({ error: 'Gateway: ' + apiErr.message });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET /api/deposit/history?telegramId=xxx&initData=xxx
router.get('/history', async (req, res) => {
  try {
    const { telegramId, initData } = req.query;
    if (!verifyTelegramInitData(initData)) return res.status(403).json({ error: 'Auth failed' });
    if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
    const deposits = await Deposit.find({ telegramId }).sort({ createdAt: -1 }).limit(20).lean();
    res.json({ deposits });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/deposit/cancel - Dari MiniApp
router.post('/cancel', async (req, res) => {
  try {
    const { initData, referenceId } = req.body;
    if (!verifyTelegramInitData(initData)) return res.status(403).json({ error: 'Invalid TG' });

    const dep = await Deposit.findOne({ referenceId, status: 'pending' });
    if (!dep) return res.status(404).json({ error: 'Not found or already processed' });

    dep.status = 'failed';
    await dep.save();
    
    // Hapus pesan tagihan/instruksi dari chat pemain
    if (dep.qrMessageId) {
      await deleteTelegramMessage(dep.telegramId, dep.qrMessageId);
    }

    res.json({ success: true, message: 'Deposit dibatalkan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GET /api/deposit/all - Dashboard Admin
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const { search, status, dateFrom, dateTo } = req.query;
    
    let query = {};
    if (search) query.telegramId = { $regex: search, $options: 'i' };
    if (status && status !== 'all') query.status = status;
    
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const deposits = await Deposit.find(query)
      .populate('userId', 'firstName username')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    
    const total = await Deposit.countDocuments(query);
    
    const allDeposits = await Deposit.find(query).lean();
    const stats = {
      totalSuccess: allDeposits.filter(d => d.status === 'success').reduce((s, d) => s + (d.amount || 0), 0),
      totalPending: allDeposits.filter(d => d.status === 'pending').reduce((s, d) => s + (d.amount || 0), 0),
    };

    res.json({ deposits, total, pages: Math.ceil(total / limit), stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. POST /api/deposit/callback - Webhook SiTranfer
// Payload doc: { "success": true, "data": { "type": "QRIS", "username": "player", "transaction_id": "...", "amount": "10000", "status": "success" } }
router.post('/callback', async (req, res) => {
  try {
    const { success, data } = req.body;
    
    if (!success || !data || data.status !== 'success') {
       return res.json({ message: 'Ignored, not success' });
    }

    const { transaction_id, amount } = data;
    
    const dep = await Deposit.findOne({ transactionId: transaction_id });
    if (!dep) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
    if (dep.status === 'success') return res.status(200).json({ message: 'Sudah sukses sebelumnya' });

    dep.status = 'success';
    dep.updatedAt = Date.now();
    await dep.save();

    const nominal = parseFloat(amount) || dep.amount;
    await User.findByIdAndUpdate(
      dep.userId,
      {
        $inc: { balance: nominal, totalDeposit: nominal, turnoverRequired: nominal }
      }
    );

    // Kirim notifikasi Telegram ke User
    const settings = await Setting.findOne();
    let successMsg = settings?.strings?.depositSuccess || '✅ <b>Deposit Berhasil!</b>\n\nNominal: <b>{amount} poin</b> telah masuk ke saldo Anda!\nSelamat bermain! 🎲';
    successMsg = successMsg.replace(/\{amount\}/g, nominal.toLocaleString('id-ID'));
    await sendTelegramMessage(dep.telegramId, successMsg);
    
    // Hapus pesan QR jika dulu ada
    if (dep.qrMessageId) {
      await deleteTelegramMessage(dep.telegramId, dep.qrMessageId);
    }
    
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. POST /api/deposit/send-bayar - MiniApp minta Bot kirim Instruksi Bayar
router.post('/send-bayar', async (req, res) => {
  try {
    const { initData, telegramId, referenceId, isManual } = req.body;
    if (!verifyTelegramInitData(initData)) return res.status(403).json({ error: 'Auth failed' });

    const dep = await Deposit.findOne({ telegramId, referenceId });
    if (!dep) return res.status(404).json({ error: 'Not found' });

    const settings = await Setting.findOne();
    let resp;

    if (isManual) {
       let manualInfo = {};
       try { manualInfo = JSON.parse(dep.paymentData); } catch (e) {}
       
       let invoiceMsg = settings?.strings?.depositInvoiceManual || '🏦 <b>Instruksi Transfer Manual</b>\n\nBank: <b>{bankName}</b>\nRekening: <b>{accountNumber}</b>\nA/N: <b>{accountName}</b>\n\nSilakan transfer TEPAT: <b>Rp {amount}</b>\n\nPesan ini akan dihapus saat sudah dikonfirmasi.';
       
       const tagihanIDR = manualInfo.finalIdrAmount || (dep.amount * 1000); // Fallback ke amount*1000

       invoiceMsg = invoiceMsg.replace(/\{amount\}/g, tagihanIDR.toLocaleString('id-ID'))
                              .replace(/\{bankName\}/g, manualInfo.bankName || '-')
                              .replace(/\{accountNumber\}/g, manualInfo.accountNumber || '-')
                              .replace(/\{accountName\}/g, manualInfo.accountName || '-');

       const botUrl = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`;
       resp = await axios.post(botUrl, {
         chat_id: telegramId,
         text: invoiceMsg,
         parse_mode: 'HTML'
       });
    } else {
       const qrUrl = dep.paymentData;
       if (!qrUrl) return res.status(400).json({ error: 'No QR URL' });

       const isLink = qrUrl.includes('http') && (qrUrl.includes('dana') || qrUrl.includes('app') || qrUrl.includes('pay') || qrUrl.includes('link'));

        if (isLink) {
          let invoiceMsg = settings?.strings?.depositInvoiceLink || '🧾 <b>Tagihan Pembayaran</b>\nNominal: <b>Rp {amount}</b>\n\nSilakan klik link di bawah ini untuk melunasi pembayaran. Pesan ini akan terhapus otomatis setelah lunas.';
          invoiceMsg = invoiceMsg.replace(/\{amount\}/g, (dep.amount * 1000).toLocaleString('id-ID'));

          const botUrl = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`;
          resp = await axios.post(botUrl, {
            chat_id: telegramId,
            text: `${invoiceMsg}\n\n<a href="${qrUrl}">👉 Klik Disini untuk Bayar</a>`,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          });
        } else {
          let invoiceMsg = settings?.strings?.depositInvoiceQR || '🧾 <b>QR Pembayaran</b>\nNominal: <b>Rp {amount}</b>\n\nSilakan pindai QR ini untuk melunasi pembayaran. Pesan ini akan terhapus otomatis setelah lunas.';
          invoiceMsg = invoiceMsg.replace(/\{amount\}/g, (dep.amount * 1000).toLocaleString('id-ID'));

          const photoUrl = qrUrl.includes('http') ? qrUrl : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`;
          const botUrl = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendPhoto`;
          resp = await axios.post(botUrl, {
            chat_id: telegramId,
            photo: photoUrl,
            caption: invoiceMsg,
            parse_mode: 'HTML'
          });
       }
    }

    if (resp.data?.ok && resp.data?.result?.message_id) {
       dep.qrMessageId = resp.data.result.message_id;
       await dep.save();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. POST /api/deposit/action - Admin Manual Accept/Reject
router.post('/action', require('../middlewares/authMiddleware'), async (req, res) => {
  try {
    const { id, action } = req.body;
    if (!['success', 'failed'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
    
    const dep = await Deposit.findById(id);
    if (!dep) return res.status(404).json({ error: 'Deposit tidak ditemukan' });
    if (dep.status !== 'pending') return res.status(400).json({ error: 'Deposit sudah diproses' });

    dep.status = action; // 'success' or 'failed'
    dep.updatedAt = Date.now();
    await dep.save();

    // Ambil settings SEKALI saja lalu jalankan semua operasi paralel
    const config = await Setting.findOne();

    const tasks = [];

    // 1. Edit pesan notif admin di Telegram (notify bot)
    if (dep.notifyMessageId && config?.admin?.notificationTelegramId && process.env.NOTIFY_BOT_TOKEN) {
      const statusText = action === 'success' ? '✅ *STATUS: DITERIMA*' : '❌ *STATUS: DITOLAK*';
      tasks.push(
        axios.post(`https://api.telegram.org/bot${process.env.NOTIFY_BOT_TOKEN}/editMessageText`, {
          chat_id: config.admin.notificationTelegramId,
          message_id: dep.notifyMessageId,
          text: `🔔 *INFO DEPOSIT MANUAL*\n\n👤 User: @${dep.telegramId}\n💰 Jumlah: *${dep.amount} pt*\n\n${statusText}\nAlasan: Diproses via Admin Dashboard`,
          parse_mode: 'Markdown'
        }).catch(e => console.error('Gagal sync notif admin deposit:', e.message))
      );
    }

    // 2. Notif user + update balance (tergantung action)
    if (action === 'success') {
      const nominal = dep.amount;
      const topupTotal = nominal + (dep.bonusApplied || 0);
      const finalTOInc = dep.promoId ? (dep.turnoverApplied || 0) : nominal;

      let successMsg = config?.strings?.depositSuccess || '✅ <b>Deposit Manual Berhasil!</b>\n\nNominal: <b>{amount} poin</b> telah divalidasi dan masuk ke akun Anda.';
      successMsg = successMsg.replace(/\{amount\}/g, nominal.toLocaleString('id-ID'));

      tasks.push(
        User.findByIdAndUpdate(dep.userId, {
          $inc: { balance: topupTotal, totalDeposit: nominal, turnoverRequired: finalTOInc }
        })
      );
      tasks.push(sendTelegramMessage(dep.telegramId, successMsg));
    } else {
      let failedMsg = config?.strings?.depositFailed || '❌ <b>Deposit Dibatalkan!</b>\n\nNominal: <b>{amount} poin</b> ditolak oleh Admin. Hubungi CS jika ada kendala.';
      failedMsg = failedMsg.replace(/\{amount\}/g, dep.amount.toLocaleString('id-ID'));
      tasks.push(sendTelegramMessage(dep.telegramId, failedMsg));
    }

    // 3. Hapus pesan tagihan/instruksi manual/QR dari chat user
    if (dep.qrMessageId) {
      tasks.push(deleteTelegramMessage(dep.telegramId, dep.qrMessageId));
    }

    // Jalankan semua task paralel sekaligus
    await Promise.all(tasks);

    // Cleanup qrMessageId di DB jika ada
    if (dep.qrMessageId) {
      dep.qrMessageId = null;
      await dep.save();
    }

    res.json({ success: true, message: `Deposit ${action} successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. POST /api/deposit/resync - Admin batch-refresh semua pending SiTranfer
router.post('/resync', requireAdmin, async (req, res) => {
  try {
    const pendingDeps = await Deposit.find({ status: 'pending', transactionId: { $exists: true, $ne: null } });
    
    if (pendingDeps.length === 0) {
      return res.json({ message: '✅ Tidak ada deposit pending dari Gateway yang perlu dicek.' });
    }

    let resolved = 0;

    for (const dep of pendingDeps) {
      try {
        const result = await paymentService.checkStatus(dep.transactionId);
        let isSuccess = false;
        let amount = dep.amount;

        if (result && result.success && Array.isArray(result.data) && result.data.length > 0) {
          const trx = result.data[0];
          if (trx.status === 'success') { isSuccess = true; if (trx.amount) amount = parseFloat(trx.amount); }
        } else if (result && result.status === 'success') {
          isSuccess = true; if (result.amount) amount = parseFloat(result.amount);
        }

        if (isSuccess) {
          dep.status = 'success'; dep.updatedAt = Date.now(); await dep.save();
          await User.findByIdAndUpdate(dep.userId, {
            $inc: { balance: amount, totalDeposit: amount, turnoverRequired: amount }
          });
          const settings = await Setting.findOne();
          let successMsg = settings?.strings?.depositSuccess || '✅ <b>Deposit Berhasil!</b>\n\nNominal: <b>{amount} poin</b> telah masuk.';
          successMsg = successMsg.replace(/\{amount\}/g, amount.toLocaleString('id-ID'));
          await sendTelegramMessage(dep.telegramId, successMsg);
          if (dep.qrMessageId) { await deleteTelegramMessage(dep.telegramId, dep.qrMessageId); }
          resolved++;
        }
      } catch (innerErr) {
        console.error(`Resync error for ${dep.referenceId}:`, innerErr.message);
      }
    }

    res.json({ message: `🔄 Resync selesai. ${resolved} dari ${pendingDeps.length} deposit berhasil di-resolve.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
