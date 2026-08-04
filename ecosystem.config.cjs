module.exports = {
  apps: [
    {
      name: 'mrti-activos-api',
      cwd: './server',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
