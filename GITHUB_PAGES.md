# GitHub Pages 배포 (`/survey/`)

공개 URL: **https://furss123.github.io/survey/**  
→ 저장소 루트의 **`index.html`** 이 메인 화면입니다.

## 한 번만 설정

1. [Settings → Pages](https://github.com/furss123/survey/settings/pages)
2. **Source** (아래 중 하나)
   - **GitHub Actions** (권장) — `index` push 시 `.github/workflows/deploy-pages.yml` 자동 배포
   - **Deploy from a branch** — Branch: `index` 또는 `main` 또는 `gh-pages`, Folder: **`/ (root)`**
3. **Save** 후 3~10분 대기

## push 후 자동 동기화

- `index` 브랜치에 push
- `main` · `gh-pages` 브랜치로 자동 동기화 (스크립트·Actions)
- 배포 확인: `.\scripts\verify-deploy.ps1`

## 배포에 포함되는 파일

- `index.html` — 메인
- `admin.html`, `admin-login.html` — 관리자
- `assets/`, `scripts/`, `.nojekyll`

## 확인

- 메인에 「구글 시트로 연결된 설문」 문구가 보이면 최신 배포
- 「학생 설문 만들기」 버튼이 **없어야** 함
