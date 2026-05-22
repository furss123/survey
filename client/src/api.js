/**
 * 상담 분석 API 클라이언트
 */

export async function analyzeSheet(url) {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "분석에 실패했습니다.");
  }
  return data;
}
