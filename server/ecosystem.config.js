/**
 * PM2 配置文件
 * 用于生产环境进程管理
 */

module.exports = {
  apps: [
    {
      name: "imagine-server",
      script: "server/server.ts",
      interpreter: "node",
      interpreter_args: "--loader tsx",
      instances: "max", // 使用所有 CPU 核心
      exec_mode: "cluster", // 集群模式
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      env_development: {
        NODE_ENV: "development",
        PORT: 3000,
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      min_uptime: "10s",
      max_restarts: 10,
      restart_delay: 4000,
    },
  ],
};
