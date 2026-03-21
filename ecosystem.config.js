module.exports = {
  apps: [
    {
      name: 'dice-api',
      script: 'server.js',
      cwd: './api', // Pakai ./ biar otomatis ngikut folder project
      watch: false,
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'dice-bot',
      script: 'index.js',
      cwd: './bot',
      watch: false,
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'dice-dashboard',
      script: 'server.js',
      cwd: './dashboard',
      watch: false,
      env: { NODE_ENV: 'production' }
    }
  ]
};
