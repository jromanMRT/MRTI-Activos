module.exports = {
  apps: [
    {
      name: 'mrti-activos-api',
      cwd: './server',
      script: 'src/index.js',
      interpreter: process.env.MRTI_NODE_INTERPRETER || 'node',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
