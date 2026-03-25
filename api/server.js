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
const promotionsRoute = require('./routes/promotions');
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
app.use('/api/promotions', promotionsRoute);


const dicePage = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dice API</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:'Segoe UI',sans-serif;color:#94a3b8;overflow:hidden}
  .dice-wrap{perspective:600px;margin-bottom:32px}
  .dice{width:80px;height:80px;position:relative;transform-style:preserve-3d;animation:roll 1.4s ease-in-out infinite}
  @keyframes roll{
    0%  {transform:rotateX(0deg) rotateY(0deg)}
    25% {transform:rotateX(180deg) rotateY(90deg)}
    50% {transform:rotateX(360deg) rotateY(180deg)}
    75% {transform:rotateX(180deg) rotateY(270deg)}
    100%{transform:rotateX(0deg) rotateY(360deg)}
  }
  .face{position:absolute;width:80px;height:80px;background:linear-gradient(135deg,#1e293b,#0f172a);border:2px solid rgba(99,102,241,0.5);border-radius:12px;display:grid;place-items:center;box-shadow:0 0 20px rgba(99,102,241,0.2) inset}
  .face:nth-child(1){transform:translateZ(40px)}
  .face:nth-child(2){transform:rotateY(180deg) translateZ(40px)}
  .face:nth-child(3){transform:rotateY(90deg) translateZ(40px)}
  .face:nth-child(4){transform:rotateY(-90deg) translateZ(40px)}
  .face:nth-child(5){transform:rotateX(90deg) translateZ(40px)}
  .face:nth-child(6){transform:rotateX(-90deg) translateZ(40px)}
  .dots{display:grid;width:56px;height:56px;gap:4px}
  .dot{background:radial-gradient(circle,#818cf8,#4f46e5);border-radius:50%;box-shadow:0 0 6px rgba(99,102,241,0.8)}
  .f1{grid-template-columns:1fr;place-items:center}.f1 .dot{width:14px;height:14px}
  .f2{grid-template-columns:1fr 1fr}.f2 .dot{width:12px;height:12px;align-self:start}.f2 .dot:last-child{align-self:end}
  .f3{grid-template-columns:1fr 1fr 1fr; align-items:center}.f3 .dot{width:10px;height:10px}.f3 .dot:nth-child(1){align-self:start}.f3 .dot:nth-child(2){align-self:center}.f3 .dot:nth-child(3){align-self:end}
  .f4{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}.f4 .dot{width:12px;height:12px}
  .f5{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr 1fr;position:relative}.f5 .dot{width:10px;height:10px}.f5-mid{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:10px;height:10px;background:radial-gradient(circle,#818cf8,#4f46e5);border-radius:50%;box-shadow:0 0 6px rgba(99,102,241,0.8)}
  .f6{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr 1fr}.f6 .dot{width:10px;height:10px}
  h2{font-size:1.1rem;font-weight:600;color:#e2e8f0;letter-spacing:0.05em;margin-bottom:6px}
  p{font-size:0.8rem;opacity:0.5}
  .glow{animation:pulse 2s ease-in-out infinite;color:#6366f1}
  @keyframes pulse{0%,100%{opacity:0.5}50%{opacity:1}}
</style>
</head>
<body>
<div class="dice-wrap">
  <div class="dice">
    <div class="face"><div class="dots f1"><div class="dot"></div></div></div>
    <div class="face"><div class="dots f2"><div class="dot"></div><div class="dot"></div></div></div>
    <div class="face"><div class="dots f3"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>
    <div class="face"><div class="dots f4"><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>
    <div class="face"><div class="dots f5" style="position:relative"><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="f5-mid"></div></div></div>
    <div class="face"><div class="dots f6"><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>
  </div>
</div>
<h2>🎲 Dice API Server</h2>
<p class="glow">Rolling...</p>
</body></html>`;

app.get('/', (req, res) => res.send(dicePage));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 404 catch-all — semua route tidak dikenal tampilkan dice animation
app.use((req, res) => res.status(404).send(dicePage));

// Connect DB & Start Server
connectDB().then(async () => {
  // Load Default Settings ke Memory (RAM)
  await settingsService.loadSettings();

  app.listen(PORT, () => {
    console.log(`🚀 API Server running on port ${PORT}`);
  });
});
