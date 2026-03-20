require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const authRoute = require('./routes/auth');
const usersRoute = require('./routes/users');
const betsRoute = require('./routes/bets');
const withdrawRoute = require('./routes/withdraw');
const balanceRoute = require('./routes/balance');
const miniappRoute = require('./routes/miniapp');
const depositRoute = require('./routes/deposit');
const settingsRoute = require('./routes/settings');
const angpaoRoute = require('./routes/angpao');
const adminRoute = require('./routes/admin');
const analyticsRoute = require('./routes/analytics');
const leaderboardRoute = require('./routes/leaderboard');
const settingsService = require('./services/settingsService');

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Static files untuk Mini App
app.use('/miniapp', express.static(path.join(__dirname, '../miniapp')));

// Routes
app.use('/api/auth', authRoute);
app.use('/api/users', usersRoute);
app.use('/api/bets', betsRoute);
app.use('/api/withdraw', withdrawRoute);
app.use('/api/balance', balanceRoute);
app.use('/api/miniapp', miniappRoute);
app.use('/api/deposit', depositRoute);
app.use('/api/settings', settingsRoute);
app.use('/api/angpao', angpaoRoute);
app.use('/api/admin', adminRoute);
app.use('/api/analytics', analyticsRoute);
app.use('/api/leaderboard', leaderboardRoute);

app.get('/', (req, res) => res.send('<html style="background:#0f172a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><h2>🚀 Dice API Server (V2) is Running!</h2></html>'));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Connect DB & Start Server
connectDB().then(async () => {
  // Load Default Settings ke Memory (RAM)
  await settingsService.loadSettings();

  app.listen(PORT, () => {
    console.log(`🚀 API Server running on port ${PORT}`);
  });
});
