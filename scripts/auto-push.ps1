# survey: 변경 사항 커밋 → index/main 푸시 → 배포 확인
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$MessageParts
)

$ErrorActionPreference = "Stop"
$git = "C:\Program Files\Git\cmd\git.exe"
if (-not (Test-Path $git)) { $git = "git" }

$repoRoot = Split-Path $PSScriptRoot -Parent
$verifyScript = Join-Path $PSScriptRoot "verify-deploy.ps1"

Set-Location $repoRoot
& $git status --short
$changes = & $git status --porcelain
if (-not $changes) {
    Write-Host "변경 없음 — 푸시·배포 확인 생략"
    exit 0
}

$msg = if ($MessageParts.Count -gt 0) { $MessageParts -join " " } else { "chore: 자동 동기화" }
& $git add -A
& $git commit -m $msg
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $git push origin index
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $git push origin index:main --force-with-lease
if ($LASTEXITCODE -ne 0) {
    Write-Host "main 동기화(lease) 실패 — force로 재시도..."
    & $git push origin index:main --force
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $git push origin HEAD:refs/heads/gh-pages --force 2>$null

Write-Host "푸시 완료: https://furss123.github.io/survey/"
Write-Host "배포 반영 확인 중 (최대 12분)…"
& $verifyScript -MaxWaitMinutes 12 -IntervalSeconds 30
exit $LASTEXITCODE
