@echo off
echo ====================================
echo Merging Remote Branch Changes
echo ====================================
echo.

echo Step 1: Checking current git status...
git status
echo.

echo Step 2: Checking current branch...
git branch --show-current
echo.

echo Step 3: Stashing any uncommitted changes...
git stash
echo.

echo Step 4: Fetching latest changes from remote...
git fetch
echo.

echo Step 5: Pulling changes from remote...
git pull
echo.

echo Step 6: Re-applying stashed changes (if any)...
git stash pop
echo.

echo Step 7: Final status check...
git status
echo.

echo ====================================
echo Merge Complete!
echo ====================================
echo.
echo If you see any merge conflicts above, please resolve them manually.
echo Then run: git add . && git commit -m "Resolved merge conflicts"
pause
