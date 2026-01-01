#!/usr/bin/env node

/**
 * 本地打包脚本
 * 创建可直接在 Node.js 环境下运行的发布包
 */

import { execSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  cpSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
const releaseDir = join(rootDir, "release");
const distDir = join(rootDir, "dist");

console.log("📦 Starting package process...\n");

// 1. 清理旧的 release 目录
if (existsSync(releaseDir)) {
  console.log("🧹 Cleaning old release directory...");
  rmSync(releaseDir, { recursive: true, force: true });
}

// 2. 构建 TypeScript
console.log("🔨 Building TypeScript...");
try {
  execSync("pnpm run build", { cwd: rootDir, stdio: "inherit" });
} catch (error) {
  console.error("❌ Build failed");
  process.exit(1);
}

// 3. 创建 release 目录
console.log("📁 Creating release directory...");
mkdirSync(releaseDir, { recursive: true });

// 4. 复制必要文件
console.log("📋 Copying files...");

const filesToCopy = [
  { src: "dist", dest: "dist", isDir: true },
  { src: "server", dest: "server", isDir: true },
  { src: "package.json", dest: "package.json" },
  { src: "README.md", dest: "README.md" },
  { src: "LICENSE", dest: "LICENSE" },
  { src: ".env.example", dest: ".env.example" },
];

filesToCopy.forEach(({ src, dest, isDir }) => {
  const srcPath = join(rootDir, src);
  const destPath = join(releaseDir, dest);

  if (existsSync(srcPath)) {
    if (isDir) {
      cpSync(srcPath, destPath, { recursive: true });
    } else {
      cpSync(srcPath, destPath);
    }
    console.log(`  ✓ ${src}`);
  } else {
    console.log(`  ⚠ ${src} not found, skipping`);
  }
});

// 5. 安装生产依赖
console.log("\n📦 Installing production dependencies...");
try {
  execSync("pnpm install --prod --no-optional", {
    cwd: releaseDir,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });
} catch (error) {
  console.error("❌ Failed to install dependencies");
  process.exit(1);
}

// 6. 创建启动脚本 (Unix)
console.log("📝 Creating startup scripts...");

const startShScript = `#!/bin/bash

# Imagine Server Startup Script

echo "🚀 Starting Imagine Server..."

# Check if .env file exists
if [ ! -f .env ]; then
  echo "⚠️  Warning: .env file not found"
  echo "📝 Please copy .env.example to .env and configure it"
  echo ""
  read -p "Do you want to continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! \\$REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Check if node is installed
if ! command -v node &> /dev/null; then
  echo "❌ Error: Node.js is not installed"
  echo "Please install Node.js 18 or higher from https://nodejs.org/"
  exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Error: Node.js version must be 18 or higher"
  echo "Current version: $(node -v)"
  exit 1
fi

# Start the server
NODE_ENV=production node server/server.js
`;

writeFileSync(join(releaseDir, "start.sh"), startShScript, { mode: 0o755 });
console.log("  ✓ start.sh");

// 7. 创建启动脚本 (Windows)
const startBatScript = `@echo off

echo Starting Imagine Server...

REM Check if .env file exists
if not exist .env (
  echo Warning: .env file not found
  echo Please copy .env.example to .env and configure it
  echo.
  set /p continue="Do you want to continue anyway? (y/N) "
  if /i not "%continue%"=="y" exit /b 1
)

REM Check if node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Error: Node.js is not installed
  echo Please install Node.js 18 or higher from https://nodejs.org/
  exit /b 1
)

REM Start the server
set NODE_ENV=production
node server/server.js
`;

writeFileSync(join(releaseDir, "start.bat"), startBatScript);
console.log("  ✓ start.bat");

// 8. 创建发布说明
const releaseReadme = `# Imagine Server - Standalone Release

This is a standalone release package of Imagine Server that can run directly on Node.js.

## Requirements

- Node.js >= 18.0.0
- Redis (optional, for token state management)

## Quick Start

### 1. Configure Environment Variables

Copy \`.env.example\` to \`.env\` and configure:

\`\`\`bash
cp .env.example .env
\`\`\`

Edit \`.env\` file:

\`\`\`bash
# API Access Control (optional)
API_TOKEN=your-secret-token

# AI Provider Tokens (comma-separated)
HUGGINGFACE_TOKENS=hf_token1,hf_token2
GITEE_TOKENS=gitee_token1,gitee_token2
MODELSCOPE_TOKENS=ms_token1,ms_token2

# Storage Configuration (choose one)
# Vercel KV (Upstash Redis)
KV_REST_API_URL=https://your-redis.upstash.io
KV_REST_API_TOKEN=your-upstash-token

# Or Standard Redis
REDIS_URL=redis://localhost:6379
\`\`\`

### 2. Start the Server

**Linux/macOS:**

\`\`\`bash
./start.sh
\`\`\`

**Windows:**

\`\`\`cmd
start.bat
\`\`\`

**Or manually:**

\`\`\`bash
NODE_ENV=production node server/server.js
\`\`\`

### 3. Verify

\`\`\`bash
# Health check
curl http://localhost:3000/api/health

# List available models
curl http://localhost:3000/api/v1/models
\`\`\`

## Configuration

### Port

Default port is 3000. Change it by setting \`PORT\` environment variable:

\`\`\`bash
PORT=8080 node server/server.js
\`\`\`

### Storage

The server will automatically select storage backend in this order:

1. Upstash Redis (if \`KV_REST_API_URL\` is set)
2. Standard Redis (if \`REDIS_URL\` is set)
3. Memory (development fallback, not persistent)

### API Authentication

If \`API_TOKEN\` is configured, all \`/api/v1/*\` endpoints require authentication:

\`\`\`bash
curl -H "Authorization: Bearer your-secret-token" \\
  http://localhost:3000/api/v1/models
\`\`\`

## Production Deployment

### Using PM2

\`\`\`bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server/server.js --name imagine-server

# View logs
pm2 logs imagine-server

# Restart
pm2 restart imagine-server

# Stop
pm2 stop imagine-server
\`\`\`

### Using systemd (Linux)

Create \`/etc/systemd/system/imagine-server.service\`:

\`\`\`ini
[Unit]
Description=Imagine Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/imagine-server
ExecStart=/usr/bin/node server/server.js
Restart=on-failure
Environment=NODE_ENV=production
EnvironmentFile=/path/to/imagine-server/.env

[Install]
WantedBy=multi-user.target
\`\`\`

Enable and start:

\`\`\`bash
sudo systemctl enable imagine-server
sudo systemctl start imagine-server
sudo systemctl status imagine-server
\`\`\`

## Troubleshooting

### Port already in use

Change the port:

\`\`\`bash
PORT=8080 ./start.sh
\`\`\`

### Redis connection failed

Check Redis is running:

\`\`\`bash
redis-cli ping
\`\`\`

Or use Upstash Redis (serverless):

1. Create account at https://upstash.com/
2. Create Redis database
3. Copy REST API URL and Token to \`.env\`

### Module not found

This release includes all dependencies. If you see this error, the package may be corrupted.

## Documentation

- Full documentation: https://amery2010.github.io/imagine-server/
- GitHub repository: https://github.com/Amery2010/imagine-server

## License

MIT License - see LICENSE file for details
`;

writeFileSync(join(releaseDir, "RELEASE_README.md"), releaseReadme);
console.log("  ✓ RELEASE_README.md");

// 9. 读取版本号
const packageJson = JSON.parse(
  readFileSync(join(rootDir, "package.json"), "utf-8")
);
const version = packageJson.version;

// 10. 创建压缩包
console.log("\n📦 Creating archive...");

const platform = process.platform;
const archiveName = `imagine-server-v${version}-${platform}-${process.arch}`;

try {
  if (platform === "win32") {
    // Windows: 使用 PowerShell 压缩
    execSync(
      `powershell Compress-Archive -Path "${releaseDir}\\*" -DestinationPath "${join(
        rootDir,
        archiveName
      )}.zip" -Force`,
      { stdio: "inherit" }
    );
    console.log(`✅ Created: ${archiveName}.zip`);
  } else {
    // Unix: 使用 tar
    execSync(
      `tar -czf "${join(rootDir, archiveName)}.tar.gz" -C "${releaseDir}" .`,
      { stdio: "inherit" }
    );
    console.log(`✅ Created: ${archiveName}.tar.gz`);
  }
} catch (error) {
  console.error("❌ Failed to create archive");
  console.error("You can manually compress the release directory");
}

console.log("\n✨ Package complete!");
console.log(`\n📁 Release directory: ${releaseDir}`);
console.log(
  `📦 Archive: ${archiveName}.${platform === "win32" ? "zip" : "tar.gz"}`
);
console.log("\n💡 To test the release:");
console.log(`   cd release`);
console.log(`   cp .env.example .env`);
console.log(`   # Edit .env with your configuration`);
if (platform === "win32") {
  console.log(`   start.bat`);
} else {
  console.log(`   ./start.sh`);
}
console.log("");
