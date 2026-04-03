# Applies pending Supabase migrations to the *linked* remote project.
# Prerequisites: npx supabase login && npx supabase link --project-ref <ref>
# Usage: .\scripts\run-migrations.ps1
# From repo root: powershell -ExecutionPolicy Bypass -File .\scripts\run-migrations.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "CashCaddies: applying pending migrations (supabase db push)..." -ForegroundColor Cyan
Write-Host "Repo root: $root"

if (-not (Test-Path "supabase\migrations")) {
  Write-Error "supabase/migrations not found. Run this script from the repository root via scripts/run-migrations.ps1"
}

# Prefer local devDependency (package.json "supabase"); falls back to npx.
$npx = Get-Command npx -ErrorAction SilentlyContinue
if (-not $npx) {
  Write-Error "npx not found. Install Node.js LTS, then retry."
}

& npx supabase db push @args
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host "Done." -ForegroundColor Green
