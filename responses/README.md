# 설문 응답 저장 (GitHub)

학생 설문 응답은 이 폴더 아래에 JSON으로 저장됩니다.

```
responses/
  {설문ID}/
    data.json    ← 응답 배열 (자동 갱신)
```

## Apps Script 설정 (제출 시 GitHub에 저장)

1. GitHub → Settings → Developer settings → Personal access tokens  
   - `repo` 권한 포함 토큰 발급
2. Apps Script → 프로젝트 설정 → 스크립트 속성

| 속성 | 값 |
|------|-----|
| `GITHUB_TOKEN` | 발급한 토큰 |
| `GITHUB_OWNER` | `furss123` (기본값) |
| `GITHUB_REPO` | `survey` (기본값) |

3. 설문 등록 시 **응답 저장: GitHub (responses 폴더)** 선택

제출할 때마다 `responses/{설문ID}/data.json` 이 갱신·커밋됩니다.

## 결과 조회

`index.html`에서 설문을 열면 GitHub에 올라간 `data.json`을 불러와 반별로 표시합니다.

## data.json 형식

```json
[
  {
    "submittedAt": "2026-05-23T12:00:00.000Z",
    "surveyId": "form-xxx",
    "학번": "1101",
    "반": "1반",
    "번호": 1,
    "이름": "홍길동",
    "answers": { "q1": "답변" }
  }
]
```
