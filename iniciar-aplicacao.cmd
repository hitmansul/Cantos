@echo off
setlocal

cd /d "%~dp0apps\web"

set AUTH_SECRET=local-dev-secret
set BETTER_AUTH_SECRET=local-dev-secret
set AUTH_URL=http://localhost:4000
set NEXT_PUBLIC_AUTH_URL=http://localhost:4000

echo Iniciando a aplicacao em http://localhost:4000
echo.
echo Deixe esta janela aberta enquanto estiver usando o app.
echo Para parar, feche esta janela ou pressione Ctrl+C.
echo.

set NODE_EXE=node
if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"

"%NODE_EXE%" ".\node_modules\next\dist\bin\next" dev --port 4000

pause
