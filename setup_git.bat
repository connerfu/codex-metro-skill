@echo off
REM ???? Git ????????????
git config --global http.proxy http://127.0.0.1:7897
git config --global https.proxy http://127.0.0.1:7897
echo Git proxy configured: 127.0.0.1:7897
git ls-remote https://github.com/connerfu/codex-metro-skill.git HEAD >nul 2>&1
if %errorlevel% equ 0 (
    echo Connection OK: github.com/connerfu/codex-metro-skill
) else (
    echo Connection FAILED - check your proxy settings
)
