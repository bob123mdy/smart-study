# 局域网访问 + 平板/手机安装到主屏（PWA）

目标：让**华为平板 / iPhone** 通过家里 WiFi 访问本系统，并可「添加到主屏」像 App 一样使用。

本系统是服务端渲染网页 + 服务端数据库，部署一次后，**多台设备访问同一网址，学习数据天然实时互通**，无需额外同步。

## 一、立即可用：局域网 HTTP 直连

1. 启动服务（Docker 已绑定 `0.0.0.0:3000`）：

   ```bash
   docker compose up -d --build
   ```

   （不用 Docker 时：`npm run build && npm run start:lan`，即 `next start -H 0.0.0.0`）

2. 查电脑局域网 IP：

   ```bash
   ipconfig   # 找「无线局域网适配器 WLAN」下的 IPv4 地址，例如 192.168.1.10
   ```

3. 平板/手机连同一 WiFi，浏览器访问 `http://<局域网IP>:3000`。

4. **Windows 防火墙**：首次访问若打不开，需放行入站 TCP 3000
   （Docker Desktop 首次映射端口通常会弹窗「允许访问」，点允许即可）。

5. 安装到主屏：
   - **iPhone Safari**：分享按钮 → 「添加到主屏」→ 得到主屏图标 + 全屏打开。
   - **华为平板 / Android Chrome**：菜单 → 「添加到主屏幕」。

> 此模式下主页图标/全屏已可用，但 **Service Worker 不注册**（无离线、无后台自动更新提示）。
> 网页本身每次打开都是最新版；若要完整的 PWA 能力，按下一节配 HTTPS。

## 二、完整 PWA：局域网 HTTPS（Service Worker / 离线 / 自动更新 / 安装提示）

浏览器只在 **HTTPS（或 localhost）** 下启用 Service Worker，所以局域网要完整 PWA 需要自签受信证书。用 `mkcert` + `Caddy` 最省事，每台设备只需一次性信任一次证书。

### 1. 电脑上安装工具（Windows）

```powershell
# 用 winget / scoop / choco 任选其一
winget install FiloSottile.mkcert
winget install CaddyServer.Caddy

# 生成本地 CA（一次即可）
mkcert -install
```

### 2. 生成局域网证书

```powershell
cd deploy
# 把 192.168.1.10 换成你的局域网 IP（可同时带上 localhost / 127.0.0.1）
mkcert 192.168.1.10 localhost 127.0.0.1
# 生成 192.168.1.10.pem 与 192.168.1.10-key.pem
```

把 `deploy/Caddyfile` 里的 `<LAN-IP>` 换成同一 IP，然后启动：

```powershell
caddy run --config deploy/Caddyfile
```

平板/手机访问 `https://<局域网IP>:8443`。

### 3. 设备上信任本地 CA（每台一次）

- **iPhone**：把 `mkcert` 的根证书 `rootCA.pem`（`mkcert -CAROOT` 查看路径）传到手机 → 设置里安装描述文件 → 「设置 → 通用 → 关于本机 → 证书信任设置」开启对该 CA 的完全信任。
- **Android/华为平板**：把 `rootCA.pem` 拷到设备 → 设置 → 安全 → 加密与凭据 → 安装证书（CA 证书）。

信任后，`https://<IP>:8443` 即被视为安全来源，Service Worker 正常注册，随后在浏览器「添加到主屏 / 安装」即为完整 PWA。

## 三、应用版本自动更新

- 网页天然每次打开都是最新版。
- 配了 Service Worker 后：改 `public/sw.js` 顶部的 `VERSION` 再重新构建部署，浏览器检测到新 SW 会自动 `skipWaiting + claim`，设备下次访问即切换到新版本，无需手动重装。

## 四、图标与配色

- 图标源文件 `public/icons/icon.svg`；改图标后运行 `npm run icons` 重新生成各尺寸 PNG（192 / 512 / maskable / apple-touch-icon）。
- 主色在 `tailwind.config.ts` 与 `public/manifest.webmanifest` 的 `theme_color`，改动时保持两处一致。
