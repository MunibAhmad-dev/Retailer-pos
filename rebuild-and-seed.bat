@echo off
cd /d "d:\Full stack\Local projects\Retailer shops - pos"
echo Rebuilding native modules...
call npm rebuild
echo.
echo Running seed script...
call npm run seed:dashboard
pause
