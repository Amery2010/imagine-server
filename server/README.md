# Server 目录说明

本目录包含 Node.js 服务器的启动脚本。

## 文件说明

### server.ts

**用途**: 开发环境服务器

**特点**:

- 使用 TypeScript
- 支持热重载（通过 `tsx watch`）
- 直接从源码运行

**启动命令**:

```bash
pnpm run dev
```

### server.js

**用途**: 生产环境服务器

**特点**:

- 使用 JavaScript (ES Modules)
- 从编译后的 `dist` 目录加载应用
- 性能更好

**启动命令**:

```bash
# 先构建
pnpm run build

# 启动生产服务器
pnpm run start:prod
```

## 功能

两个文件实现相同的功能：

1. **环境变量加载**

   - 从 `.env.local` 和 `.env` 加载环境变量
   - 优先级：`.env.local` > `.env`

2. **API 路由**

   - 挂载到 `/api` 路径
   - 处理所有 AI 图像生成相关的 API 请求

3. **静态文件服务**

   - 服务 `public` 目录中的前端文件
   - 支持 SPA 路由（404 返回 index.html）

4. **日志输出**
   - 服务器启动信息
   - 环境配置
   - 可用端点列表

## 架构

```
┌─────────────────────────────────────────┐
│         Node.js HTTP Server             │
│  ┌───────────────────────────────────┐  │
│  │      Hono Application             │  │
│  │  ┌─────────────┐  ┌────────────┐ │  │
│  │  │ API Routes  │  │   Static   │ │  │
│  │  │   /api/*    │  │   Files    │ │  │
│  │  │             │  │   /*       │ │  │
│  │  └─────────────┘  └────────────┘ │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## 端口配置

默认端口: `3000`

可以通过环境变量 `PORT` 自定义：

```bash
PORT=8080 pnpm run dev
```

## 环境变量

### 必需

- `HUGGINGFACE_TOKENS` - Hugging Face API tokens（逗号分隔）
- `GITEE_TOKENS` - Gitee AI API tokens（逗号分隔）
- `MODELSCOPE_TOKENS` - ModelScope API tokens（逗号分隔）

### 可选

- `API_TOKEN` - API 访问控制 tokens（逗号分隔）
- `PORT` - 服务器端口（默认: 3000）
- `NODE_ENV` - 环境（development/production）
- `REDIS_URL` - Redis 连接 URL（可选）

## 开发 vs 生产

### 开发环境 (server.ts)

```bash
pnpm run dev
```

**优势**:

- ✅ 热重载
- ✅ 快速迭代
- ✅ TypeScript 类型检查
- ✅ 源码调试

**劣势**:

- ⚠️ 性能较低
- ⚠️ 需要 tsx 运行时

### 生产环境 (server.js)

```bash
pnpm run build
pnpm run start:prod
```

**优势**:

- ✅ 性能更好
- ✅ 纯 JavaScript
- ✅ 无需额外运行时
- ✅ 更小的内存占用

**劣势**:

- ⚠️ 需要先构建
- ⚠️ 无热重载

## PM2 部署

使用 PM2 进行生产部署：

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start server/ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs imagine-server

# 重启
pm2 restart imagine-server

# 停止
pm2 stop imagine-server
```

## Docker 部署

使用 Docker 容器化部署：

```bash
# 构建镜像
docker build -t imagine-server -f docker/Dockerfile .

# 运行容器
docker run -p 3000:3000 --env-file .env imagine-server
```

## 故障排除

### 问题: 端口已被占用

```bash
Error: listen EADDRINUSE: address already in use :::3000
```

**解决方法**:

1. 更改端口: `PORT=8080 pnpm run dev`
2. 或杀死占用端口的进程: `lsof -ti:3000 | xargs kill`

### 问题: 找不到 public 目录

```bash
Error: ENOENT: no such file or directory, stat './public'
```

**解决方法**:

```bash
# 构建前端
pnpm run build:frontend
```

### 问题: 模块导入错误

```bash
Error: Cannot find module '../dist/index.js'
```

**解决方法**:

```bash
# 构建后端
pnpm run build
```

## 相关文档

- [DEPLOYMENT.md](../docs/DEPLOYMENT.md) - 完整部署指南
- [QUICKSTART.md](../docs/QUICKSTART.md) - 快速开始
- [README.md](../README.md) - 项目主文档

## 注意事项

1. ✅ **开发环境使用 server.ts** - 支持热重载
2. ✅ **生产环境使用 server.js** - 性能更好
3. ✅ **部署前先构建** - 运行 `pnpm run build`
4. ✅ **确保 public 目录存在** - 运行 `pnpm run build:frontend`
5. ✅ **配置环境变量** - 复制 `.env.example` 到 `.env`
