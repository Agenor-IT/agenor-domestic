[CmdletBinding()]
param(
  [string]$CommitSha = '',
  [switch]$SkipTests,
  [switch]$Watch
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent

Push-Location $repoRoot
try {
  $status = git status --porcelain
  if ($status) {
    Write-Warning "El repositorio tiene cambios pendientes sin commitear:"
    Write-Warning $status
  }

  if (-not $SkipTests) {
    Write-Host "Ejecutando pruebas locales..." -ForegroundColor Cyan
    npm run test
    if ($LASTEXITCODE -ne 0) { throw "Pruebas fallidas." }
  }

  if ([string]::IsNullOrWhiteSpace($CommitSha)) {
    $CommitSha = (git rev-parse HEAD).Trim()
  }

  Write-Host "Desplegando SHA: $CommitSha" -ForegroundColor Green

  # Verificar si gh CLI esta disponible
  $gh = Get-Command gh -ErrorAction SilentlyContinue
  if ($null -eq $gh) {
    Write-Warning "GitHub CLI ('gh') no esta instalado o no se encuentra en el PATH."
    Write-Host "Puedes disparar el workflow manualmente desde GitHub Actions en:" -ForegroundColor Yellow
    Write-Host "https://github.com/Agenor-IT/agenor-domestic/actions/workflows/deploy-hostinger.yml" -ForegroundColor Yellow
    Write-Host "Ingresando como 'expected_sha': $CommitSha" -ForegroundColor Yellow
    return
  }

  Write-Host "Disparando workflow en GitHub Actions..." -ForegroundColor Cyan
  gh workflow run deploy-hostinger.yml --repo Agenor-IT/agenor-domestic -f expected_sha=$CommitSha

  if ($Watch) {
    Write-Host "Esperando ejecucion..." -ForegroundColor Cyan
    Start-Sleep -Seconds 3
    gh run watch --repo Agenor-IT/agenor-domestic
  }
}
finally {
  Pop-Location
}
