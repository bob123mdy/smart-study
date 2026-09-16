# syntax=docker/dockerfile:1
# 个人智能学习系统 · 多阶段构建（standalone 输出，最小运行镜像）

# ============ 1) 安装依赖 ============
FROM node:24-slim AS deps
WORKDIR /app
# .npmrc 指向国内镜像（npmmirror）+ better-sqlite3 预编译二进制镜像源
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# ============ 2) 构建（output: standalone）============
FROM node:24-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ============ 3) 运行 ============
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# 非 root 运行
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# standalone 最小产物 + 静态资源（PWA：manifest / sw.js / icons）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# better-sqlite3 原生绑定：显式复制，规避 nft 对动态 require(bindings) 的漏追踪
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

# SQLite 数据目录（docker-compose 卷挂载点）
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
