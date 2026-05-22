# 상담 분석 (namak2026)

Google Sheets URL을 입력하고 **조회**를 누르면, 시트의 상담·응답 데이터를 읽어 요약·반별 통계·주제 키워드를 보여주는 최소 MVP입니다.

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트 | React 18, Vite, Tailwind CSS |
| 백엔드 | Node.js, Express, googleapis |
| 시트 조회 | Service Account (비공개) 또는 공개 시트 gviz 폴백 |

## 사전 요구

- [Node.js](https://nodejs.org/) 18 이상
- (비공개 시트) Google Cloud + Sheets API + Service Account JSON

---

## Google Service Account (비공개 시트)

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. **Google Sheets API** 사용 설정
3. **서비스 계정** 생성 → JSON 키 다운로드
4. 시트 **공유**에 서비스 계정 `client_email` 추가 (뷰어 이상)

`server/.env` 예시 (`server/.env.example` 참고):

```env
PORT=3001
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
```

JSON 키 파일은 `server/service-account.json`에 두면 됩니다 (`.gitignore` 처리됨).

**공개 시트**만 사용할 경우 SA 없이도 gviz로 조회를 시도합니다. 비공개 시트는 반드시 SA + 시트 공유가 필요합니다.

---

## 설치 및 실행

```bash
cd c:\Users\KIM\Documents\GitHub\forms\namak2026
npm run install:all
npm run dev
```

- 화면: http://localhost:5173  
- API: http://localhost:3001  
- Vite가 `/api`를 백엔드로 프록시합니다.

---

## 사용 방법

1. 브라우저에서 앱을 엽니다.
2. Google Sheets URL을 입력합니다.  
   예: `https://docs.google.com/spreadsheets/d/1oH3Er_9UF_A6HDQEK_1KjFxp54M_JJrU/edit`
3. **조회** 클릭 → 분석 결과 표시

### 시트 형식

- **일반 표**: 1행 = 헤더. `반`, `번호`, `이름`, `완료`/`제출` 등 열 이름을 자동 인식합니다.
- **프로필 형식**: `[1반] [1] [이름] 학생 프로필` 같은 텍스트 블록이 많은 시트도 지원합니다.

---

## API

### `POST /api/analyze`

```json
{ "url": "https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit" }
```

**응답 요약**

| 필드 | 설명 |
|------|------|
| `summary` | 총응답, 완료건수, 완료율, 학급수 등 |
| `byClass` | 반별 인원·완료·완료율 |
| `themes` | 응답 텍스트 키워드 기반 주제 (진로, 스트레스 등) |
| `columnInsights` | 열별 입력 건수·입력률 |
| `rows` | 정규화된 행 (반, 번호, 이름, 미리보기) |
| `source` | `service_account` 또는 `gviz` |

---

## 프로젝트 구조

```
namak2026/
├── package.json
├── README.md
├── .env.example
├── server/
│   ├── .env.example
│   └── src/
│       ├── index.js
│       ├── analyze.js
│       ├── sheetsClient.js
│       ├── gvizClient.js
│       ├── profileParse.js
│       └── parseUrl.js
└── client/
    └── src/
        ├── App.jsx
        ├── api.js
        └── components/AnalysisResult.jsx
```

---

## 문제 해결

| 증상 | 확인 |
|------|------|
| 인증 정보 없음 | `server/.env`, JSON 파일 경로 |
| 403 / Permission denied | 시트를 SA 이메일과 공유 |
| 공개인데 실패 | URL·시트 ID, 인터넷 연결 |
| 열 인식 오류 | 헤더에 `반`, `번호`, `이름` 등 명시 |

---

교육·프로젝트용 MVP입니다.
