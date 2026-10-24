$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path '.venv/Scripts/python.exe')) { python -m venv .venv }
& ./.venv/Scripts/python.exe -m pip install -r requirements.lock.txt
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed' }
Push-Location frontend
try {
  npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed' }
  npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
} finally { Pop-Location }
& ./.venv/Scripts/python.exe -m backend.ml
if ($LASTEXITCODE -ne 0) { throw 'Model training failed' }
& ./.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
