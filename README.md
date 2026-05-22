# 2026 남악고 1학년 설문 결과

- **공개 URL**: https://furss123.github.io/survey/
- **배포**: GitHub Pages (`index` 브랜치, 루트)
- **파일**: `index.html`, `assets/`, `.nojekyll`

자세한 설정은 [GITHUB_PAGES.md](./GITHUB_PAGES.md) 참고.

## 로컬 CSV/Excel 분석 (진로 설문)

Google Forms 보내기 파일을 반별·전공 계열로 정리할 때:

```bash
pip install -r scripts/requirements.txt
python scripts/analyze_survey.py path/to/export.csv
```

- Excel: `survey_result_YYYYMMDD.xlsx` (`전체_요약` + 반별 시트)
- Markdown: `{파일명}_analysis.md`
- 규격·Cursor 규칙: [docs/survey_analysis_meta_prompt.md](./docs/survey_analysis_meta_prompt.md)
