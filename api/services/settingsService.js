const Setting = require('../models/Setting');

class SettingsService {
  constructor() {
    this.cache = null;
    this.lastUpdated = null;
  }

  async loadSettings() {
    try {
      let config = await Setting.findOne({ configurationKey: 'global_settings' });
      if (!config) {
        config = await Setting.create({ configurationKey: 'global_settings' });
        console.log('[SettingsService] Default settings created in DB.');
      }
      this.cache = config.toObject({ defaults: true });
      this.lastUpdated = Date.now();
      return this.cache;
    } catch (err) {
      console.error('[SettingsService] Error loading settings:', err);
      return null;
    }
  }

  getSettings() {
    // 5 seconds background refresh untuk sync antar service (API & Bot)
    if (this.cache && (Date.now() - this.lastUpdated > 5000)) {
      this.loadSettings(); // fetch async di background tanpa await (non-blocking)
    }
    return this.cache;
  }

  async updateSettings(newData) {
    try {
      let config = await Setting.findOne({ configurationKey: 'global_settings' });
      if (!config) config = new Setting({ configurationKey: 'global_settings' });
      
      if (newData.bounds) config.bounds = { ...config.bounds, ...newData.bounds };
      if (newData.odds) config.odds = { ...config.odds, ...newData.odds };
      if (newData.strings) config.strings = { ...config.strings, ...newData.strings };
      if (newData.paymentGateway) config.paymentGateway = newData.paymentGateway;
      
      // Top level fields
      if (newData.minBet !== undefined) config.minBet = newData.minBet;
      if (newData.roundDuration !== undefined) config.roundDuration = newData.roundDuration;
      if (newData.isBotActive !== undefined) {
        if (!config.isBotActive && newData.isBotActive) config.botStartTime = Date.now();
        config.isBotActive = newData.isBotActive;
      }
      if (newData.isGroupActive !== undefined) {
        if (!config.isGroupActive && newData.isGroupActive) config.groupStartTime = Date.now();
        config.isGroupActive = newData.isGroupActive;
      }
      if (newData.isLeaderboardActive !== undefined) {
        config.isLeaderboardActive = newData.isLeaderboardActive;
      }
      if (newData.forceSub !== undefined) {
        config.forceSub = {
          isActive: newData.forceSub.isActive === true,
          channelUsername: newData.forceSub.channelUsername || '',
          channelUrl: newData.forceSub.channelLink || newData.forceSub.channelUrl || ''
        };
      }
      
      config.updatedAt = Date.now();
      await config.save();
      
      // Update cache
      this.cache = config.toObject({ defaults: true });
      this.lastUpdated = Date.now();
      
      return this.cache;
    } catch (err) {
      console.error('[SettingsService] Error updating settings:', err);
      throw err;
    }
  }

  // Get a string template by key, replace {vars}
  getString(key, vars = {}) {
    const settings = this.getSettings();
    let template = settings?.strings?.[key];
    if (!template) {
      // Fallback default from schema
      const Setting = require('../models/Setting');
      const field = Setting.schema.paths['strings.' + key];
      template = field?.defaultValue || key;
    }
    // Replace all {var} tokens
    return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] !== undefined ? vars[k] : `{${k}}`);
  }
}

// Export a robust singleton
const settingsService = new SettingsService();
module.exports = settingsService;
