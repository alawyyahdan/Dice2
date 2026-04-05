const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '../../../temp_uploads');

const Ticket = require('../models/Ticket');
const axios = require('axios');
const { getIo } = require('../socket');

function initCleanupJobs() {
  // Jalankan cron job setiap 5 menit (bersihkan folder tmp)
  cron.schedule('*/5 * * * *', () => {
    if (!fs.existsSync(uploadDir)) return;
    
    const files = fs.readdirSync(uploadDir);
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(uploadDir, file);
      const stat = fs.statSync(filePath);
      const ageMinutes = (now - stat.mtimeMs) / 1000 / 60;
      if (ageMinutes > 10) { 
        try {
          fs.unlinkSync(filePath);
          console.log(`[Cleanup] Deleted stale temp file: ${file}`);
        } catch(e) { /* ignore */ }
      }
    });
  });

  // Jalankan cron job setiap jam untuk auto-close CS Tiket (1x24 jam no response)
  cron.schedule('0 * * * *', async () => {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const staleTickets = await Ticket.find({
        status: 'open',
        lastMessageAt: { $lt: oneDayAgo }
      });
      
      const token = process.env.CS_BOT_TOKEN || process.env.BOT_TOKEN;

      for (const t of staleTickets) {
        t.status = 'closed';
        t.closedAt = new Date();
        await t.save();
        
        getIo().to('admins').emit('ticket_closed', { ticketId: t._id });

        if (token) {
           await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
              chat_id: t.telegramId,
              text: `✅ Keluhan #${t.referenceId} telah ditutup otomatis karena tidak ada respon selama 24 jam.\nTerima kasih telah menghubungi kami!`,
              parse_mode: 'HTML'
           }).catch(() => {});
        }
      }
      
      if (staleTickets.length > 0) {
        console.log(`[CS] Auto-closed ${staleTickets.length} idle ticket(s).`);
      }
    } catch (e) { 
      console.error('[Cleanup] Error auto-closing tickets', e.message); 
    }
  });
}

module.exports = initCleanupJobs;
