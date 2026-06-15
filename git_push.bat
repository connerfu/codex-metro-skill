@echo off
REM ?????? ? ????????
git config --global http.proxy http://127.0.0.1:7897
git config --global https.proxy http://127.0.0.1:7897
cd /d "%~dp0"
git add -A
git commit -m "update"
git push
echo Done
