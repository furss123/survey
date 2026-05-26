# GitHub Pages 배포 (`/survey/`)

공개 URL: **https://furss123.github.io/survey/**

## 한 번만 설정 (GitHub 웹)

1. [survey 저장소 → Settings → Pages](https://github.com/furss123/survey/settings/pages)
2. **Build and deployment**
   - Source: **GitHub Actions** (권장 — `index` push마다 자동 배포)
   - 또는 **Deploy from a branch** → Branch: **`index`** 또는 **`main`** (둘 다 `index`와 동기화됨) / Folder: **`/ (root)`**
3. **Save**
4. 1~5분 후 위 URL 접속 (최초 Actions 배포는 워크플로 한 번 실행 필요)

배포에 포함되는 파일(브랜치 루트):

- `index.html` — 설문 결과 앱
- `assets/` — 로고 등
- `.nojekyll` — Jekyll 없이 정적 파일 그대로 제공

## 코드 반영 후

```bash
cd survey
git add index.html assets .nojekyll GITHUB_PAGES.md
git commit -m "Pages: survey URL용 정적 배포 파일 동기화"
git push origin index
```

배포용 브랜치는 **`index`** 입니다. Pages 설정도 **`index`** / root 여야 합니다.
`main`과 히스토리가 갈라져 있으면 `git push origin index:main`은 거절될 수 있습니다. 그때는 Pages 브랜치만 `index`로 바꾸세요.

## 확인

- Settings → Pages에 초록색 “Your site is live at …” 표시
- https://furss123.github.io/survey/ 에서 설문 화면 로드
- 로고: `assets/namak-logo.png` (404면 `assets` 폴더 push 여부 확인)

## 참고

- `client/`, `server/`는 로컬 개발용이며 Pages에서 Node 서버는 동작하지 않습니다.
- 예전 주소 `/froms/`, `/school/`는 이 사이트와 별개입니다. 정본 URL은 `/survey/` 입니다.
