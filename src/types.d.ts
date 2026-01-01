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
      }
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
  // Cloudflare KV (可选)
  TOKEN_STATUS_KV?: KVNamespace;
  // Unstorage 实例
  storage?: Storage;
};
