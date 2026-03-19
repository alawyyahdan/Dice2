const path = require('path');

module.exports = {
  apps: [
    {
      name: 'dice-api',
      script: './api/server.js',
      cwd: __dirname,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'dice-bot',
      script: './bot/index.js',
      cwd: __dirname,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'dice-dashboard',
      script: 'npm',
      args: 'start',
      cwd: path.join(__dirname, 'dashboard'),
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
