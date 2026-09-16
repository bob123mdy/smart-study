@echo off
rem 学习系统开机自启脚本（由计划任务「smart-study-server」在登录时调用）
rem 生产模式监听 0.0.0.0:3000，日志追加到 logs\server.log
cd /d C:\Users\LIn\Desktop\smart-study
if not exist logs mkdir logs
"C:\Program Files\nodejs\node.exe" node_modules\next\dist\bin\next start -H 0.0.0.0 -p 3000 >> logs\server.log 2>&1
