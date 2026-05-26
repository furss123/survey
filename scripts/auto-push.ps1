# survey: 변경 사항 커밋 후 origin/index 로 푸시
$ErrorActionPreference = "Stop"
$git = "C:\Program Files\Git\cmd\git.exe"
if (-not (Test-Path $git)) { $git = "git" }

$repoRoot = Split-Path $PSScriptRoot -Parent

Set-Location $repoRoot
& $git status --short
$changes = & $git status --porcelain
if (-not $changes) {
    Write-Host "변경 없음 — 푸시 생략"
    exit 0
}

$msg = if ($args.Count -gt 0) { $args -join " " } else { "chore: 자동 동기화" }
& $git add -A
& $git commit -m $msg
& $git push origin index
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Pages가 main 브랜치를 쓰는 경우에도 즉시 반영
& $git push origin index:main --force-with-lease
if ($LASTEXITCODE -ne 0) {
    Write-Host "main 동기화(lease) 실패 — force로 재시도..."
    & $git push origin index:main --force
}
Write-Host "푸시 완료: https://furss123.github.io/survey/"
