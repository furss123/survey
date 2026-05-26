# GitHub Pages 배포 (`/survey/`)

공개 URL: **https://furss123.github.io/survey/**  
→ 저장소 루트의 **`index.html`** 이 메인 화면입니다.

## 한 번만 설정

1. [Settings → Pages](https://github.com/furss123/survey/settings/pages)
2. **Source** — 아래 **A(권장)** 또는 B 중 하나만 선택
   - **A. Deploy from a branch** (가장 안정적)  
     Branch: **`index`**, Folder: **`/ (root)`** → Save  
     → `index`에 push할 때마다 `pages build and deployment`가 자동 실행됩니다.
   - **B. GitHub Actions** — `index` push 시 [Deploy GitHub Pages](https://github.com/furss123/survey/actions/workflows/deploy-pages.yml) 실행  
     → 첫 배포 전 **Actions 탭 → Deploy GitHub Pages → Run workflow** (브랜치 `index`)를 한 번 눌러야 할 수 있습니다.  
     → `github-pages` 환경 승인(Approve) 요청이 뜨면 승인합니다.
3. **Save** 후 3~10분 대기, 브라우저에서 **Ctrl+Shift+R** 새로고침

### 배포가 안 바뀔 때

- Live가 `ui-version: 20260522` / 「학생 설문은 참여」이면 **구버전**입니다.
- **Actions만** 켜 두고 `Deploy GitHub Pages` 실행이 **0회**이면, 소스를 **A(브랜치 index)** 로 바꾸거나 위 **Run workflow**를 실행하세요.
- `gh-pages`만 push해도, Pages 소스가 **GitHub Actions**이면 사이트는 갱신되지 않습니다.

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
