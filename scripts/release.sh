#!/bin/bash

# 版本发布脚本
# 用法: ./scripts/release.sh <version>
# 示例: ./scripts/release.sh 1.1.0

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查参数
if [ -z "$1" ]; then
  echo -e "${RED}❌ Error: Version number is required${NC}"
  echo -e "${YELLOW}Usage: ./scripts/release.sh <version>${NC}"
  echo -e "${YELLOW}Example: ./scripts/release.sh 1.1.0${NC}"
  exit 1
fi

VERSION=$1
TAG="v${VERSION}"

# 验证版本号格式
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
  echo -e "${RED}❌ Error: Invalid version format${NC}"
  echo -e "${YELLOW}Expected format: X.Y.Z or X.Y.Z-prerelease${NC}"
  echo -e "${YELLOW}Examples: 1.0.0, 1.2.3, 2.0.0-beta.1${NC}"
  exit 1
fi

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo -e "${RED}❌ Error: Not a git repository${NC}"
  exit 1
fi

# 检查是否有未提交的更改
if ! git diff-index --quiet HEAD --; then
  echo -e "${RED}❌ Error: You have uncommitted changes${NC}"
  echo -e "${YELLOW}Please commit or stash your changes first${NC}"
  git status --short
  exit 1
fi

# 检查是否在 main 分支
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo -e "${YELLOW}⚠️  Warning: You are not on the main branch (current: ${CURRENT_BRANCH})${NC}"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}ℹ️  Release cancelled${NC}"
    exit 0
  fi
fi

# 检查标签是否已存在
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo -e "${RED}❌ Error: Tag ${TAG} already exists${NC}"
  echo -e "${YELLOW}Use a different version number or delete the existing tag:${NC}"
  echo -e "${YELLOW}  git tag -d ${TAG}${NC}"
  echo -e "${YELLOW}  git push origin :refs/tags/${TAG}${NC}"
  exit 1
fi

echo -e "${BLUE}🚀 Preparing release ${TAG}...${NC}"
echo

# 确认发布
echo -e "${YELLOW}This will:${NC}"
echo -e "  1. Update package.json to version ${VERSION}"
echo -e "  2. Commit the changes"
echo -e "  3. Create and push tag ${TAG}"
echo -e "  4. Trigger automatic deployment to:"
echo -e "     - GitHub Container Registry (ghcr.io)"
echo -e "     - Cloudflare Workers"
echo -e "     - Vercel"
echo
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${BLUE}ℹ️  Release cancelled${NC}"
  exit 0
fi

echo

# 更新 package.json 版本号
echo -e "${BLUE}📝 Updating package.json...${NC}"
npm version ${VERSION} --no-git-tag-version

# 提交更改
echo -e "${BLUE}💾 Committing changes...${NC}"
git add package.json
git commit -m "chore: bump version to ${VERSION}"

# 推送到远程
echo -e "${BLUE}⬆️  Pushing to remote...${NC}"
git push origin ${CURRENT_BRANCH}

# 创建标签
echo -e "${BLUE}🏷️  Creating tag ${TAG}...${NC}"
git tag -a ${TAG} -m "Release version ${VERSION}"

# 推送标签
echo -e "${BLUE}⬆️  Pushing tag...${NC}"
git push origin ${TAG}

echo
echo -e "${GREEN}✅ Release ${TAG} created successfully!${NC}"
echo
echo -e "${BLUE}📦 GitHub Actions will now build and deploy automatically:${NC}"
echo -e "   - Docker image: ghcr.io/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/' | tr '[:upper:]' '[:lower:]')"
echo -e "   - Cloudflare Workers"
echo -e "   - Vercel"
echo
echo -e "${BLUE}🔗 Check progress at:${NC}"
echo -e "   https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"
echo
echo -e "${YELLOW}📋 Next steps:${NC}"
echo -e "   1. Monitor GitHub Actions workflows"
echo -e "   2. Verify deployments"
echo -e "   3. Create GitHub Release (optional)"
echo -e "   4. Update CHANGELOG.md if not done yet"
echo
