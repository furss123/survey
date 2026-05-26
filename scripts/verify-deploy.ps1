# GitHub Pages deploy check (run after push)
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
$localIndex = Join-Path $repoRoot "index.html"

function Get-BuildIdFromHtml([string]$html) {
    if ($html -match "build:([a-f0-9]{7,40})") { return $Matches[1] }
    return $null
}

function Test-LiveSite([string]$body, [string]$expectedBuild) {
    $liveBuild = Get-BuildIdFromHtml $body
    if ($expectedBuild -and $liveBuild -eq $expectedBuild) {
        return @{ Ok = $true; LiveBuild = $liveBuild }
    }
    $isNew = ($body -match "ui-version: 20260526-sheet-only") -or ($body -match "구글 시트로 연결")
    $isOld = ($body -match "ui-version: 20260522") -or ($body -match "학생 설문은 참여")
    return @{
        Ok = $isNew -and -not $isOld
        LiveBuild = $liveBuild
        IsNew = $isNew
        IsOld = $isOld
    }
}

$localHtml = Get-Content -Path $localIndex -Raw -Encoding UTF8
$expectedBuild = Get-BuildIdFromHtml $localHtml
$headBuild = (& $git -C $repoRoot rev-parse --short HEAD).Trim()

if (-not $Quiet) {
    Write-Host "Deploy check:" $url
    Write-Host "Local HEAD:" $headBuild "| expected build tag:" $(if ($expectedBuild) { $expectedBuild } else { "none" })
}

$deadline = (Get-Date).AddMinutes($MaxWaitMinutes)
$attempt = 0

while ($true) {
    $attempt++
    try {
        $res = Invoke-WebRequest -Uri $url -UseBasicParsing -Headers @{ "Cache-Control" = "no-cache" }
        $body = $res.Content
        $lastMod = $res.Headers["Last-Modified"]
        $check = Test-LiveSite $body $expectedBuild

        if ($check.Ok) {
            if (-not $Quiet) {
                Write-Host "OK: Live site is up to date (attempt $attempt)"
                Write-Host "Last-Modified:" $lastMod
                if ($check.LiveBuild) { Write-Host "live build:" $check.LiveBuild }
            }
            exit 0
        }

        if (-not $Quiet) {
            Write-Host "Attempt $attempt : still old. Last-Modified:" $lastMod
            if ($check.IsOld) { Write-Host "  ui-version 20260522 (old)" }
            if (-not $check.IsNew) { Write-Host "  ui-version 20260526 not found" }
            if ($expectedBuild -and $check.LiveBuild -ne $expectedBuild) {
                Write-Host "  live build:" $(if ($check.LiveBuild) { $check.LiveBuild } else { "none" }) "| want:" $expectedBuild
            }
        }
    } catch {
        if (-not $Quiet) { Write-Host "Attempt $attempt error:" $_.Exception.Message }
    }

    if ((Get-Date) -ge $deadline) { break }
    if (-not $Quiet) { Write-Host "  retry in ${IntervalSeconds}s..." }
    Start-Sleep -Seconds $IntervalSeconds
}

if (-not $Quiet) {
    Write-Host ""
    Write-Host "Deploy NOT live after ${MaxWaitMinutes} min."
    Write-Host "Pages: https://github.com/furss123/survey/settings/pages"
    Write-Host "Actions: https://github.com/furss123/survey/actions"
}
exit 1
