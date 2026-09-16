# 放行局域网访问 3000 端口（需管理员运行一次；已存在同名规则会自动更新）
New-NetFirewallRule -DisplayName "smart-study-3000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -ErrorAction SilentlyContinue
