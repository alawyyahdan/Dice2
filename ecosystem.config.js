module.exports = {
  apps: [
    {
      name: 'dice-api',
      script: 'server.js',
      cwd: '/root/Dice2/api',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'dice-bot',
      script: 'index.js',
      cwd: '/root/Dice2/bot',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'dice-dashboard',
      script: 'server.js',
      cwd: '/root/Dice2/dashboard',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
