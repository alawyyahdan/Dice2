const rateLimit = require('express-rate-limit');
const settingsService = require('../services/settingsService');

// Karena express-rate-limit butuh waktu init yang static, kita bisa pakai function callback utk dpt limit dinamis
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // Tetap 1 menit sebagai window standar
  max: (req, res) => {
    const config = settingsService.getSettings();
    return config?.rateLimit?.globalMax || 150;
  },
  standardHeaders: true, 
  legacyHeaders: false,
  message: { error: 'Terlalu banyak request. Silakan coba lagi nanti.' }
});

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // Tetap 5 menit sbg standard window utk auth
  max: (req, res) => {
    const config = settingsService.getSettings();
    return config?.rateLimit?.authMax || 15;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login. Anda terblokir sementara, coba lagi dalam 5 menit.' }
});

module.exports = {
  globalLimiter,
  authLimiter
};
