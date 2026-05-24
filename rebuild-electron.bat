@echo off
cd /d "d:\Full stack\Local projects\Retailer shops - pos"
echo Rebuilding for Electron...
call npx electron-rebuild
echo.
echo Starting dev server...
call npm run dev
pause
