@echo off
cd /d "c:\Users\John Restauro\OneDrive\Documents\GitHub\CESI-3.1.worktrees\copilot-worktree-2026-03-27T07-53-46"

echo === GIT STATUS ===
git status

echo.
echo === CURRENT BRANCH ===
git branch --show-current

echo.
echo === CHECKING FOR UNCOMMITTED CHANGES ===
git diff --stat
git diff --cached --stat

echo.
echo === REMOTE BRANCHES ===
git branch -r

echo.
echo === RECENT COMMITS ===
git log --oneline -5
