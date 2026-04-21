{
  "name": "reloj-agent",
  "script": "node_modules/tsx/dist/cli.js",
  "args": "src/index.ts",
  "cwd": "/media/vlongo/Archivos/Projectos/reloj/agent",
  "instances": 1,
  "exec_mode": "fork",
  "watch": false,
  "ignore_watch": ["node_modules", ".git"],
  "env": {
    "NODE_ENV": "production"
  },
  "max_memory_restart": "500M",
  "autorestart": true,
  "restart_delay": 1000,
  "max_restarts": 10,
  "min_uptime": "10s",
  "kill_timeout": 5000,
  "log_date_format": "YYYY-MM-DD HH:mm:ss",
  "error_file": "./logs/error.log",
  "out_file": "./logs/out.log",
  "combine_logs": true,
  "access_control": {
    "user": "vlongo"
  }
}
