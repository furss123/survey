# live 사이트가 최신 index 브랜치를 반영했는지 확인
$ErrorActionPreference = "Stop"
$url = "https://furss123.github.io/survey/index.html"
$html = (Invoke-WebRequest -Uri $url -UseBasicParsing).Headers
$body = (Invoke-WebRequest -Uri $url -UseBasicParsing).Content
Write-Host "Last-Modified:" $html["Last-Modified"]
$ok = $body -match "구글 시트로 연결" -and $body -notmatch "학생 설문은 참여"
if ($ok) {
    Write-Host "OK: 최신 버전이 배포되었습니다."
    exit 0
}
Write-Host "대기: 아직 예전 버전입니다. Pages 설정(브랜치 main 또는 index, GitHub Actions)을 확인하세요."
exit 1
