@echo off
setlocal enabledelayedexpansion
cd /d "d:\Full stack\Local projects\Retailer shops - pos"

echo Cleaning up locked modules...
rmdir /s /q "node_modules\better-sqlite3\build" 2>nul
del /q "node_modules\better-sqlite3\build\Release\better_sqlite3.node" 2>nul

echo.
echo Reinstalling better-sqlite3...
call npm install better-sqlite3

echo.
echo Running seed script...
call npm run seed:dashboard

pause
