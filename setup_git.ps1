# Git 配置助手
# 在新对话中运行此脚本，即可正常 push 到 GitHub
$proxy = "http://127.0.0.1:7897"
git config --global http.proxy $proxy
git config --global https.proxy $proxy
Write-Host "Git proxy configured: $proxy" -ForegroundColor Green
git ls-remote https://github.com/connerfu/codex-metro-skill.git HEAD
if ($LASTEXITCODE -eq 0) { Write-Host "Connection OK" -ForegroundColor Green }
