const express = require('express');
const router = express.Router();
const settingsService = require('../services/settingsService');
const requireAdmin = require('../middlewares/authMiddleware');

// GET /api/settings - For Admin Dashboard
router.get('/', requireAdmin, async (req, res) => {
  try {
    const settings = settingsService.getSettings();
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings - For Admin Dashboard (Update limits, odds, messages)
router.put('/', requireAdmin, async (req, res) => {
  try {
    const updated = await settingsService.updateSettings(req.body);
    res.json({ message: 'Settings successfully updated', settings: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/public - For MiniApp Web Frontend Guide
router.get('/public', (req, res) => {
  try {
    const settings = settingsService.getSettings();
    if (!settings) return res.status(503).json({ error: 'Settings booting up' });
    
    // HIDE message templates from public, only expose odds and bounds
    res.json({
      bounds: settings.bounds,
      odds: settings.odds
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/status - Uptime & Process Info
router.get('/status', requireAdmin, (req, res) => {
  const settings = settingsService.getSettings();
  const now = Date.now();
  
  const botUptime = settings.isBotActive ? Math.floor((now - new Date(settings.botStartTime).getTime()) / 1000) : 0;
  const groupUptime = settings.isGroupActive ? Math.floor((now - new Date(settings.groupStartTime).getTime()) / 1000) : 0;

  res.json({
    uptime: process.uptime(), // system uptime
    botUptime,
    groupUptime,
    isBotActive: settings.isBotActive,
    isGroupActive: settings.isGroupActive,
    nodeVersion: process.version,
    timestamp: now
  });
});

module.exports = router;
