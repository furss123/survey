# 학생 설문 (구글 폼 대체) 설정

학생은 `respond.html?s=설문ID` 에서 **명렬표 기준 반·번호**를 고른 뒤 설문에 응답합니다.  
응답은 **고정 열 구조**의 스프레드시트에 쌓여, 결과 조회(`index.html`)에서 기존과 비슷하게 반별로 볼 수 있습니다.

## 1. Apps Script 배포

1. [응답용 스프레드시트](https://docs.google.com/spreadsheets/d/1oH3Er_9UF_A6HDQEK_1KjFxp54M_JJrU)를 열거나 새 시트를 만듭니다.
2. **확장 프로그램 → Apps Script** 에 `scripts/google-apps-script/survey-api.gs` 내용을 붙여 넣습니다.
3. **배포 → 새 배포 → 웹 앱**
   - 실행: 나
   - 액세스: **모든 사용자**(익명 포함) — 학생·교사 PC에서 제출 가능
4. 배포 URL (`.../exec`) 을 복사합니다.

## 2. 관리자에서 설문 등록

1. `admin-login.html` 로그인 후 **`admin-survey.html`** (또는 관리 화면의 「학생 설문 만들기」)
2. 설문 이름, 문항, **웹 앱 URL** 입력 → **메인에 등록**
3. **서버에 설문 동기화** — Config 시트에 설문 정의 저장, Responses 시트 헤더 갱신
4. 표시된 **학생 참여 링크**를 학생에게 공유합니다.

## 3. 결과 조회

메인(`index.html`)에서 등록한 설문 이름을 누르면, 응답 시트를 읽어 반별 카드로 표시합니다.  
시트 공유: **링크가 있는 모든 사용자 → 보기** (gviz 조회용).

## 데이터 구조

| 시트 | 용도 |
|------|------|
| Config | 설문 ID, 이름, 문항 JSON |
| Responses | 제출시각, 설문ID, 학번, 반, 번호, 이름, 문항별 열 |

명렬표 시트 ID는 `scripts/survey-form-shared.js` 의 `ROSTER_SPREADSHEET_ID` 와 동일합니다.

## 제한

- 설문 목록은 브라우저 `localStorage` 에도 저장됩니다. **다른 PC**에서 관리하려면 동일 브라우저로 등록하거나, 메인 등록 후 백업이 필요합니다.
- 제출·조회는 **웹 앱 URL + 공개 응답 시트** 가 있어야 동작합니다.
