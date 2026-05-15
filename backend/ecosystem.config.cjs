/* global process */
const webConcurrency = Number(process.env.WEB_CONCURRENCY ?? 1);

module.exports = {
  apps: [{
    name: 'prymal-backend',
    script: 'src/index.js',
    instances: Number.isFinite(webConcurrency) && webConcurrency > 0 ? webConcurrency : 1,
    exec_mode: 'cluster',
    env_file: '.env',
    error_file: '/var/log/pm2/prymal-error.log',
    out_file: '/var/log/pm2/prymal-out.log',
    max_memory_restart: '1G',
    restart_delay: 3000,
    watch: false,
  }],
};
