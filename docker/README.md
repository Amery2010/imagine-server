# Docker 部署指南

本目录包含 Imagine Server 的 Docker 配置文件。

## 文件说明

- `Dockerfile` - Docker 镜像构建配置（已优化）
- `docker-compose.yml` - Docker Compose 编排配置

## 镜像特性

- **镜像体积**: ~150-180MB（优化后）
- **三阶段构建**: 分离构建、依赖和运行环境
- **安全性**: 使用非 root 用户（nodejs:nodejs）运行
- **性能**: 直接运行编译后的 JavaScript，无运行时开销

## 快速开始

### 使用 Docker Compose（推荐）

```bash
# 在项目根目录下运行
cd docker
docker-compose up -d

# 查看日志
docker-compose logs -f app

# 停止服务
docker-compose down
```

### 使用 Docker

```bash
# 构建镜像
docker build -f docker/Dockerfile -t imagine-server .

# 运行容器
docker run -d \
  -p 3000:3000 \
  -e API_TOKEN=your-token \
  -e HUGGINGFACE_TOKENS=hf_token1,hf_token2 \
  -e GITEE_TOKENS=gitee_token1,gitee_token2 \
  -e MODELSCOPE_TOKENS=ms_token1,ms_token2 \
  --name imagine-server \
  imagine-server
```

## 优化措施

Dockerfile 包含以下优化：

1. **三阶段构建**: 分离构建、依赖和运行环境
2. **仅复制必要文件**: 不包含源代码和开发依赖
3. **直接运行 JS**: 使用 Node.js 运行编译后的代码，无需 tsx
4. **非 root 用户**: 使用 nodejs 用户运行应用，提高安全性
5. **最小化层**: 合并命令减少镜像层数
6. **Alpine Linux**: 使用轻量级基础镜像

## 环境变量

在 `docker-compose.yml` 中配置或通过 `.env` 文件设置：

```bash
# API 访问控制
API_TOKEN=your-secret-token

# AI 提供商 Token
HUGGINGFACE_TOKENS=hf_token1,hf_token2
GITEE_TOKENS=gitee_token1,gitee_token2
MODELSCOPE_TOKENS=ms_token1,ms_token2
```

## 健康检查

容器启动后，可以通过以下端点检查服务状态：

```bash
curl http://localhost:3000/api/health
```

## 性能优化建议

```bash
# 限制资源使用
docker run -d -p 3000:3000 \
  --memory="512m" \
  --cpus="1.0" \
  imagine-server

# 使用卷挂载持久化日志
docker run -d -p 3000:3000 \
  -v $(pwd)/logs:/app/logs \
  imagine-server
```

## 注意事项

- Docker Compose 配置包含 Redis 服务，用于 Token 状态管理
- 数据持久化通过 Docker volume 实现
- 默认端口为 3000，可在 `docker-compose.yml` 中修改
- 镜像使用非 root 用户（nodejs:nodejs）运行，符合安全最佳实践
