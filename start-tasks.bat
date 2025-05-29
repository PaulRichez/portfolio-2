@echo off
echo Lancement des tâches VS Code...
code --task "Task 1"
timeout /t 2 /nobreak >nul
code --task "Task 2"
