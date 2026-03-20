const axios = require('axios');
const Setting = require('../models/Setting');

class PaymentService {
  constructor() {
    this.baseUrl = 'https://rest.sitranfer.com/payment/api';
  }

  async getConfig() {
    const config = await Setting.findOne();
    const bgConfig = config?.paymentGateway?.sitranfer;
    if (!bgConfig || !bgConfig.merchantId) {
      throw new Error('Payment Gateway belum dikonfigurasi di Pengaturan.');
    }
    return bgConfig;
  }

  async generateDeposit(channel, nominal, username) {
    const config = await this.getConfig();
    const url = `${this.baseUrl}/generate`;
    const payload = {
      key: config.merchantId,
      channel: channel,
      amount: nominal,
      player_username: username
    };

    try {
      const resp = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (resp.data && resp.data.success) {
        return resp.data.data;
      } else {
        throw new Error(resp.data?.message || 'Gagal generate pembayaran.');
      }
    } catch (e) {
      console.error('SiTranfer API Error:', e.response?.data || e.message);
      throw new Error(e.response?.data?.message || e.message || 'Gagal koneksi ke provider.');
    }
  }

  async checkBalance(tempKey = null) {
    let key = tempKey;
    if (!key) {
      const config = await this.getConfig();
      key = config.merchantId;
    }
    const url = `${this.baseUrl}/merchantbalance`;
    try {
      const resp = await axios.post(url, { key: key }, { headers: { 'Content-Type': 'application/json' } });
      if (resp.data && resp.data.success) {
        return resp.data.data;
      }
      return null;
    } catch (e) {
      console.error('SiTranfer Balance Check Error:', e.message);
      return null;
    }
  }

  async checkStatus(transactionId) {
    const config = await this.getConfig();
    const url = `${this.baseUrl}/status`;
    const payload = {
      key: config.merchantId,
      transaction_id: transactionId
    };

    try {
      const resp = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
      if (resp.data && resp.data.success) {
        return resp.data.data;
      }
      return null;
    } catch (e) {
      console.error('SiTranfer Status Check Error:', e.message);
      return null;
    }
  }

  async processPayout(username, accountName, accountNumber, bankTarget, amount) {
    const config = await this.getConfig();
    const url = `${this.baseUrl}/payout`;
    const payload = {
      key: config.merchantId,
      player_username: username,
      account_name: accountName,
      account_number: accountNumber,
      bank_target: bankTarget,
      amount: amount
    };

    try {
      const resp = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
      if (resp.data && resp.data.success) {
        return resp.data.data;
      } else {
        throw new Error(resp.data?.message || 'Gagal generate payout.');
      }
    } catch (e) {
      console.error('SiTranfer Payout API Error:', e.response?.data || e.message);
      throw new Error(e.response?.data?.message || e.message || 'Gagal koneksi ke provider.');
    }
  }
}

module.exports = new PaymentService();
