// 佳乐家 · PM2 进程管理配置
module.exports = {
  apps: [{
    name: 'jialejia-v5',
    script: 'server.js',
    cwd: '/var/www/jialejia-v5',
    instances: 1,          // 单实例运行（SQLite不支持多实例）
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    // 日志配置
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    // 进程守护
    max_restarts: 10,
    min_uptime: 5000,
    restart_delay: 3000,
    // 内存限制（超过自动重启）
    max_memory_restart: '500M',
    // 停止超时
    kill_timeout: 5000,
    // 环境变量
    env_production: {
      NODE_ENV: 'production',
    },
  }],
};