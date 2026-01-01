# Server 目录

本目录包含 Imagine Server 的本地服务器相关文件。

## 文件说明

- `server.ts` - Node.js 服务器入口文件
- `ecosystem.config.js` - PM2 进程管理配置

## 开发模式

```bash
# 在项目根目录运行
pnpm run dev
```

这会启动开发服务器，支持热重载。

## 生产模式

### 直接运行

```bash
pnpm start
```

### 使用 PM2

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start server/ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs imagine-server

# 停止服务
pm2 stop imagine-server

# 重启服务
pm2 restart imagine-server
```

## 环境变量

服务器会自动加载以下环境变量文件（优先级从高到低）：

1. `.env.local` - 本地开发环境变量（不提交到 Git）
2. `.env` - 默认环境变量

## 端口配置

默认端口为 `3000`，可通过环境变量 `PORT` 修改：

```bash
PORT=8080 pnpm start
```

## 健康检查

服务启动后，访问健康检查端点：

```bash
curl http://localhost:3000/api/health
```
