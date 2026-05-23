# 학생 설문 (구글 폼 대체) 설정

학생은 `respond.html?s=설문ID` 에서 **명렬표 기준 반·번호**를 고른 뒤 설문에 응답합니다.  
응답은 기본적으로 **GitHub 저장소 `responses/` 폴더**에 JSON으로 저장되며, 결과 조회(`index.html`)에서 반별로 볼 수 있습니다.

## 1. Apps Script 배포

1. [응답용 스프레드시트](https://docs.google.com/spreadsheets/d/1oH3Er_9UF_A6HDQEK_1KjFxp54M_JJrU)를 열거나 새 시트를 만듭니다.
2. **확장 프로그램 → Apps Script** 에 `scripts/google-apps-script/survey-api.gs` 내용을 붙여 넣습니다.
3. **프로젝트 설정 → 스크립트 속성** (GitHub 저장용)

| 속성 | 값 |
|------|-----|
| `GITHUB_TOKEN` | GitHub Personal Access Token (`repo` 권한) |
| `GITHUB_OWNER` | `furss123` (선택, 기본값) |
| `GITHUB_REPO` | `survey` (선택, 기본값) |

4. **배포 → 새 배포 → 웹 앱**
   - 실행: 나
   - 액세스: **모든 사용자**(익명 포함) — 학생·교사 PC에서 제출 가능
5. 배포 URL (`.../exec`) 을 복사합니다.

## 2. 관리자에서 설문 등록

1. `admin-login.html` 로그인 후 **`admin-survey.html`**
2. 설문 이름, 문항, **웹 앱 URL** 입력
3. **응답 저장**: 기본값 **GitHub (`responses/{설문ID}/data.json`)**
4. **메인에 등록** → **서버에 설문 동기화**
5. 표시된 **학생 참여 링크**를 학생에게 공유합니다.

## 3. 결과 조회

메인(`index.html`)에서 등록한 설문 이름을 누르면 GitHub에 저장된 `responses/{설문ID}/data.json` 을 불러와 반별 카드로 표시합니다.

## 데이터 구조

### GitHub (기본)

```
responses/
  {설문ID}/
    data.json   ← 응답 배열
```

### Google 스프레드시트 (선택)

관리자에서 **응답 저장 → Google 스프레드시트** 를 선택한 경우:

| 시트 | 용도 |
|------|------|
| Config | 설문 ID, 이름, 문항 JSON |
| Responses | 제출시각, 설문ID, 학번, 반, 번호, 이름, 문항별 열 |

명렬표 시트 ID는 `scripts/survey-form-shared.js` 의 `ROSTER_SPREADSHEET_ID` 와 동일합니다.

## 제한

- 설문 목록은 브라우저 `localStorage` 에도 저장됩니다. **다른 PC**에서 관리하려면 동일 브라우저로 등록하거나, 메인 등록 후 백업이 필요합니다.
- GitHub 저장 모드에서는 Apps Script에 **`GITHUB_TOKEN`** 이 설정되어 있어야 제출이 됩니다.
- `scripts/google-apps-script/` 변경 후에는 Apps Script를 **재배포**해야 반영됩니다.
