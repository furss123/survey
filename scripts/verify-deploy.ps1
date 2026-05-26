# GitHub Pages 배포 반영 여부 확인 (푸시 후 자동 실행)
param(
    [int]$MaxWaitMinutes = 12,
    [int]$IntervalSeconds = 30,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$git = "C:\Program Files\Git\cmd\git.exe"
if (-not (Test-Path $git)) { $git = "git" }

$url = "https://furss123.github.io/survey/index.html"
$adminUrl = "https://furss123.github.io/survey/admin.html"
$localIndex = Join-Path $repoRoot "index.html"

function Get-BuildIdFromHtml([string]$html) {
    if ($html -match "build:([a-f0-9]{7,40})") { return $Matches[1] }
    return $null
}

function Test-LiveSite([string]$body) {
    $hasNewHint = $body -match "구글 시트로 연결"
    $hasOldHint = $body -match "학생 설문은 참여"
    $hasOldFormLink = $body -match "학생 설문 만들기"
    return @{
        Ok = $hasNewHint -and -not $hasOldHint -and -not $hasOldFormLink
        HasNewHint = $hasNewHint
        HasOldHint = $hasOldHint
        HasOldFormLink = $hasOldFormLink
    }
}

$localHtml = Get-Content -Path $localIndex -Raw -Encoding UTF8
$expectedBuild = Get-BuildIdFromHtml $localHtml
$headBuild = (& $git -C $repoRoot rev-parse --short HEAD).Trim()

if (-not $Quiet) {
    Write-Host "배포 확인: $url"
    Write-Host "로컬 HEAD: $headBuild | index.html build 태그: $(if ($expectedBuild) { $expectedBuild } else { '(없음)' })"
}

$deadline = (Get-Date).AddMinutes($MaxWaitMinutes)
$attempt = 0

while ($true) {
    $attempt++
    try {
        $res = Invoke-WebRequest -Uri $url -UseBasicParsing -Headers @{ "Cache-Control" = "no-cache" }
        $body = $res.Content
        $lastMod = $res.Headers["Last-Modified"]
        $check = Test-LiveSite $body
        $liveBuild = Get-BuildIdFromHtml $body

        if ($check.Ok) {
            if (-not $Quiet) {
                Write-Host "OK: 최신 버전이 배포되었습니다. (시도 $attempt)"
                Write-Host "Last-Modified: $lastMod"
                if ($liveBuild) { Write-Host "live build: $liveBuild" }
            }
            exit 0
        }

        if (-not $Quiet) {
            Write-Host "[시도 $attempt] 아직 예전 버전 — Last-Modified: $lastMod"
            if ($check.HasOldHint) { Write-Host "  - 예전 메인 문구(학생 설문 참여) 감지" }
            if ($check.HasOldFormLink) { Write-Host "  - 예전 관리자 링크 감지" }
            if (-not $check.HasNewHint) { Write-Host "  - 신규 메인 문구 없음" }
        }
    } catch {
        if (-not $Quiet) { Write-Host "[시도 $attempt] 요청 실패: $($_.Exception.Message)" }
    }

    if ((Get-Date) -ge $deadline) { break }
    if (-not $Quiet) { Write-Host "  ${IntervalSeconds}초 후 재확인…" }
    Start-Sleep -Seconds $IntervalSeconds
}

if (-not $Quiet) {
    Write-Host ""
    Write-Host "배포 미반영 (${MaxWaitMinutes}분 대기 후 종료)"
    Write-Host "확인: https://github.com/furss123/survey/settings/pages"
    Write-Host "  - Source: GitHub Actions 또는 Branch: main/index/gh-pages, Folder: / (root)"
    Write-Host "  - Actions: https://github.com/furss123/survey/actions"
}
exit 1
