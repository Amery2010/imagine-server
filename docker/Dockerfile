# Imagine Server - Docker 配置
# 多阶段构建，最小化镜像体积

# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 安装必要的构建工具（git 和 bash 用于前端构建脚本）
RUN apk add --no-cache git bash

# 构建前端（注入服务器模式环境变量）
RUN VITE_SERVICE_MODE=server pnpm run build:frontend

# 构建 TypeScript
RUN pnpm run build

# 依赖阶段 - 只安装生产依赖
FROM node:18-alpine AS deps

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 仅安装生产依赖
RUN pnpm install --prod --frozen-lockfile

# 生产阶段 - 最小化镜像
FROM node:18-alpine

WORKDIR /app

# 只复制 node 和 pnpm 必要的文件
COPY --from=deps /usr/local/bin/pnpm /usr/local/bin/pnpm
COPY --from=deps /usr/local/bin/pnpx /usr/local/bin/pnpx

# 复制依赖文件
COPY package.json ./

# 从依赖阶段复制 node_modules
COPY --from=deps /app/node_modules ./node_modules

# 从构建阶段只复制必要的文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/server/server.js ./server/server.js

# 创建非 root 用户运行应用
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用
CMD ["node", "server/server.js"]
