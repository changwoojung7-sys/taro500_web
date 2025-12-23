export async function onRequest({ request }) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "METHOD_NOT_ALLOWED" }),
      { status: 405, headers: corsHeaders }
    );
  }

  // ===== IP 제한 =====
  const DAILY_LIMIT = 3;
  const today = new Date().toISOString().slice(0, 10);
  globalThis.__usage ||= {};

  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "unknown";

  const key = `${ip}_${today}`;
  globalThis.__usage[key] ||= 0;

  const payload = await request.json();

  if (payload.mode === "openai") {
    if (globalThis.__usage[key] >= DAILY_LIMIT) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: "LIMIT_EXCEEDED",
          message: "오늘 OpenAI 타로 리딩은 3회까지만 가능합니다 🌙",
          limit: DAILY_LIMIT,
        }),
        { status: 429, headers: corsHeaders }
      );
    }
    globalThis.__usage[key]++;
  }

  // ===== Render API 전달 =====
  const res = await fetch("https://saju500.onrender.com/api/tarot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  return new Response(
    JSON.stringify({
      ok: true,
      data,
      usage: globalThis.__usage[key],
      limit: DAILY_LIMIT,
    }),
    { status: 200, headers: corsHeaders }
  );
}
