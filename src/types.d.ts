import type { Storage } from "unstorage";

// Cloudflare KV Namespace 类型定义
declare global {
  interface KVNamespace {
    get(key: string, type?: "text"): Promise<string | null>;
    get(key: string, type: "json"): Promise<any | null>;
    get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
    get(key: string, type: "stream"): Promise<ReadableStream | null>;
    put(
      key: string,
      value: string | ArrayBuffer | ReadableStream,
      options?: {
        expiration?: number;
        expirationTtl?: number;
        metadata?: any;
      },
    ): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: {
      prefix?: string;
      limit?: number;
      cursor?: string;
    }): Promise<{
      keys: { name: string; expiration?: number; metadata?: any }[];
      list_complete: boolean;
      cursor?: string;
    }>;
  }
}

export type Bindings = {
  API_TOKEN?: string;
  HUGGINGFACE_TOKENS?: string;
  GITEE_TOKENS?: string;
  MODELSCOPE_TOKENS?: string;
  A4F_TOKENS?: string;
  MODELSLAB_TOKENS?: string;
  GEMINI_TOKENS?: string;
  GROK_TOKENS?: string;
  OPENAI_TOKENS?: string;
  ALLOWED_ORIGINS?: string;
  // KV Token 加密密钥（可选，回退到 API_TOKEN）
  ENCRYPTION_KEY?: string;
  // 管理 API 鉴权（可选，回退到 API_TOKEN）
  ADMIN_TOKEN?: string;
  // 可配置的 API Base URL（可选）
  GEMINI_API_BASE?: string;
  GROK_API_BASE?: string;
  OPENAI_API_BASE?: string;
  // S3 Compatible Storage Config (可选)
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_BUCKET_NAME?: string;
  S3_CDN_URL?: string;
  // 存储配置（可选）
  KV_REST_API_URL?: string;
  KV_REST_API_TOKEN?: string;
  REDIS_URL?: string;
  // Cloudflare KV (可选)
  TOKEN_STATUS_KV?: KVNamespace;
  VIDEO_TASK_KV?: KVNamespace;
  // Unstorage 实例
  storage?: Storage;
  // Webhook 配置
  WEBHOOK_SECRET?: string;
};
