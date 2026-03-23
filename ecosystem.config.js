module.exports = {
  apps: [
    {
      name: 'dice-api',
      script: 'server.js',
      cwd: './api',
      watch: false,
      env: { NODE_ENV: 'production' },
      env_file: '../.env'
    },
    {
      name: 'dice-bot',
      script: 'index.js',
      cwd: './bot',
      watch: false,
      env: { NODE_ENV: 'production' },
      env_file: '../.env'
    },
    {
      name: 'dice-dashboard',
      script: 'server.js',
      cwd: './dashboard',
      watch: false,
      env: { NODE_ENV: 'production' },
      env_file: '../.env'
    }
  ]
};
