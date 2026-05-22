# GitHub Pages 배포 (`/survey/`)

공개 URL: **https://furss123.github.io/survey/**

## 한 번만 설정 (GitHub 웹)

1. [survey 저장소 → Settings → Pages](https://github.com/furss123/survey/settings/pages)
2. **Build and deployment**
   - Source: **Deploy from a branch**
   - Branch: **`index`** (또는 `main`) / Folder: **`/ (root)`**
3. **Save**
4. 1~10분 후 위 URL 접속

배포에 포함되는 파일(브랜치 루트):

- `index.html` — 설문 결과 앱
- `assets/` — 로고 등
- `.nojekyll` — Jekyll 없이 정적 파일 그대로 제공

## 코드 반영 후

```bash
cd survey
git add index.html assets .nojekyll GITHUB_PAGES.md
git commit -m "Pages: survey URL용 정적 배포 파일 동기화"
git push origin main
git push origin main:index
```

`main:index`는 원격 **`index`** 브랜치(기본 브랜치)를 최신 정적 파일로 맞춥니다.

## 확인

- Settings → Pages에 초록색 “Your site is live at …” 표시
- https://furss123.github.io/survey/ 에서 설문 화면 로드
- 로고: `assets/namak-logo.png` (404면 `assets` 폴더 push 여부 확인)

## 참고

- `client/`, `server/`는 로컬 개발용이며 Pages에서 Node 서버는 동작하지 않습니다.
- 예전 주소 `/froms/`, `/school/`는 이 사이트와 별개입니다. 정본 URL은 `/survey/` 입니다.
