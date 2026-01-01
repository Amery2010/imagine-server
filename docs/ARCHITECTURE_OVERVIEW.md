# 架构概览

本文档提供 Imagine Server 的整体架构概览。

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Client                                │
│                    (HTTP Requests)                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Hono Framework                            │
│                  (API Router & Middleware)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  src/api/imagine.ts                          │
│              (统一 API 入口 & 请求分发)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              src/providers/registry.ts                       │
│                 (Provider 注册器)                            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Gitee AI   │  │ Hugging Face │  │ Model Scope  │     │
│  │   Provider   │  │   Provider   │  │   Provider   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              src/api/token-manager.ts                        │
│           (Token 管理 & 自动轮换)                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  src/storage.ts                              │
│              (Unstorage 统一存储层)                          │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Upstash  │  │  Redis   │  │   CF KV  │  │  Memory  │   │
│  │  Redis   │  │          │  │          │  │          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 核心模块

### 1. API 层 (`src/api/`)

#### imagine.ts

- **职责**: 统一 API 入口，请求解析和分发
- **功能**:
  - 解析请求参数（JSON / FormData）
  - 解析模型 ID（provider/model 格式）
  - 委托给对应的 Provider 处理
  - 统一错误处理和响应格式

#### token-manager.ts

- **职责**: Token 管理和自动轮换
- **功能**:
  - Token 池管理
  - 自动轮换机制
  - 配额耗尽检测
  - Token 状态持久化

### 2. Provider 层 (`src/providers/`)

#### 插件化设计

每个 Provider 都是一个独立的插件，实现统一的接口：

```typescript
interface IProvider {
  name: string; // Provider 名称
  supportedActions: string[]; // 支持的操作
  handleRequest(c, action, params); // 处理请求
  getApiModelId(model); // 获取 API 模型 ID
  getModelConfigs(); // 获取模型配置
}
```

#### base.ts

- **职责**: Provider 接口和基类定义
- **内容**:
  - `IProvider` 接口
  - `BaseProvider` 抽象基类
  - `ModelConfig` 类型定义

#### utils.ts

- **职责**: 通用工具函数
- **功能**:
  - 图片尺寸计算
  - SSE 流解析
  - Gradio 文件上传
  - 常量定义（提示词、负面提示词等）

#### registry.ts

- **职责**: Provider 注册和管理
- **功能**:
  - Provider 注册
  - Provider 查找
  - 模型 ID 解析
  - 模型配置聚合

#### 具体 Provider 实现

- **gitee.ts**: Gitee AI Provider
- **huggingface.ts**: Hugging Face Provider
- **modelscope.ts**: Model Scope Provider

### 3. 存储层 (`src/storage.ts`)

#### Unstorage 抽象

使用 Unstorage 提供统一的 KV 存储接口，支持多种后端：

1. **Upstash Redis** (Vercel KV)

   - 优先级最高
   - 通过 REST API 访问
   - 适合 Serverless 环境

2. **标准 Redis**

   - 使用 ioredis 客户端
   - 适合传统部署

3. **Cloudflare KV**

   - Cloudflare Workers 原生支持
   - 全球分布式

4. **内存存储**
   - 开发环境回退
   - 数据不持久化

## 数据流

### 1. 图片生成请求流程

```
Client Request
    │
    ▼
API Router (Hono)
    │
    ▼
imagine.ts (解析请求)
    │
    ├─ 解析 model ID
    ├─ 提取参数
    └─ 查找 Provider
    │
    ▼
Provider Registry
    │
    └─ 返回对应的 Provider
    │
    ▼
Provider.handleRequest()
    │
    ├─ 验证操作类型
    ├─ 获取 API 模型 ID
    └─ 调用具体的 handler
    │
    ▼
Token Manager
    │
    ├─ 获取可用 Token
    ├─ 检测配额状态
    └─ 自动轮换
    │
    ▼
AI Provider API
    │
    └─ 返回生成结果
    │
    ▼
Response to Client
```

### 2. Token 管理流程

```
Request with Provider
    │
    ▼
Token Manager
    │
    ├─ 从环境变量读取 Token 列表
    ├─ 从存储读取 Token 状态
    └─ 选择可用 Token
    │
    ▼
Execute Request
    │
    ├─ 成功 → 返回结果
    └─ 失败 → 检测错误类型
    │
    ▼
Error Detection
    │
    ├─ 配额耗尽 → 标记 Token 为耗尽
    ├─ 其他错误 → 重试下一个 Token
    └─ 所有 Token 耗尽 → 返回错误
    │
    ▼
Update Storage
    │
    └─ 持久化 Token 状态
```

## 部署架构

### Vercel 部署

```
┌─────────────────────────────────────────┐
│         Vercel Edge Network             │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   Serverless Functions            │ │
│  │   (Node.js Runtime)               │ │
│  │                                   │ │
│  │   ┌─────────────────────────┐    │ │
│  │   │  Imagine Server         │    │ │
│  │   │  (Hono + Providers)     │    │ │
│  │   └──────────┬──────────────┘    │ │
│  │              │                    │ │
│  │              ▼                    │ │
│  │   ┌─────────────────────────┐    │ │
│  │   │  Vercel KV              │    │ │
│  │   │  (Upstash Redis)        │    │ │
│  │   └─────────────────────────┘    │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Cloudflare Workers 部署

```
┌─────────────────────────────────────────┐
│      Cloudflare Global Network          │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   Workers Runtime                 │ │
│  │   (V8 Isolates)                   │ │
│  │                                   │ │
│  │   ┌─────────────────────────┐    │ │
│  │   │  Imagine Server         │    │ │
│  │   │  (Hono + Providers)     │    │ │
│  │   └──────────┬──────────────┘    │ │
│  │              │                    │ │
│  │              ▼                    │ │
│  │   ┌─────────────────────────┐    │ │
│  │   │  Cloudflare KV          │    │ │
│  │   │  (Global KV Store)      │    │ │
│  │   └─────────────────────────┘    │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Node.js 部署

```
┌─────────────────────────────────────────┐
│         Server / Container              │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   Node.js Process                 │ │
│  │                                   │ │
│  │   ┌─────────────────────────┐    │ │
│  │   │  Imagine Server         │    │ │
│  │   │  (Hono + Providers)     │    │ │
│  │   └──────────┬──────────────┘    │ │
│  │              │                    │ │
│  │              ▼                    │ │
│  │   ┌─────────────────────────┐    │ │
│  │   │  Redis                  │    │ │
│  │   │  (Self-hosted)          │    │ │
│  │   └─────────────────────────┘    │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## 扩展性

### 添加新 Provider

插件化架构使得添加新 Provider 非常简单：

1. **创建 Provider 类**

   ```typescript
   export class MyProvider extends BaseProvider {
     readonly name = "myprovider";
     readonly supportedActions = ["generate"];
     // 实现接口方法
   }
   ```

2. **注册 Provider**

   ```typescript
   providerRegistry.register(new MyProvider());
   ```

3. **配置环境变量**
   ```bash
   MYPROVIDER_TOKENS=token1,token2
   ```

### 添加新存储后端

Unstorage 支持多种存储后端，可以轻松添加：

```typescript
import { createStorage } from "unstorage";
import myDriver from "unstorage/drivers/my-driver";

const storage = createStorage({
  driver: myDriver({
    // 配置选项
  }),
});
```

## 性能优化

### 1. Token 池管理

- 多 Token 并发使用
- 自动负载均衡
- 配额耗尽自动切换

### 2. 存储优化

- KV 存储用于 Token 状态
- 最小化存储读写
- 内存缓存（开发环境）

### 3. 请求优化

- 统一错误处理
- 自动重试机制
- 超时控制

## 安全性

### 1. 认证

- Bearer Token 认证
- 支持多个 API Token
- 可选的访问控制

### 2. Token 保护

- Token 存储在环境变量
- 不在日志中暴露
- 状态持久化到安全存储

### 3. 输入验证

- 参数类型检查
- 模型 ID 验证
- 文件大小限制

## 监控和调试

### 1. 日志

- 请求日志
- 错误日志
- Token 切换日志

### 2. 健康检查

```bash
GET /api/health
```

### 3. Token 统计

```bash
GET /api/v1/token-stats/all
```

## 相关文档

- [Provider 插件开发指南](./PROVIDER_PLUGIN_GUIDE.md)
- [Provider 架构说明](./PROVIDER_ARCHITECTURE.md)
- [快速参考](./QUICK_REFERENCE.md)
- [部署指南](./DEPLOYMENT.md)
- [贡献指南](../CONTRIBUTING.md)

---

**版本**: 1.1.0  
**更新日期**: 2024-12-30
