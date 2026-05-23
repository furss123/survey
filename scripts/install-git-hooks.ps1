# 로컬 저장소에 post-commit 자동 푸시 훅 설치
$ErrorActionPreference = "Stop"
$git = "C:\Program Files\Git\cmd\git.exe"
if (-not (Test-Path $git)) { $git = "git" }

$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot
& $git config core.hooksPath .githooks
Write-Host "설치됨: core.hooksPath = .githooks (index 브랜치 커밋 시 자동 push)"
