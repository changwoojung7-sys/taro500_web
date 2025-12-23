// ===============================
// TARO 500 - tarot_ai.js
// OpenAI Proxy + IP Daily Limit
// ===============================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// 🔒 IP별 사용량 (메모리)
// 형식: { ip: { yyyy-mm-dd: count } }
const ipUsage = new Map();

// 하루 제한 횟수
const DAILY_LIMIT = 3;

/**
 * YYYY-MM-DD
 */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Cloudflare에서 IP 추출
 */
function getClientIP(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0] ||
    "unknown"
  );
}

/**
 * OpenAI 사용 가능 여부 체크
 */
function checkAndIncreaseUsage(ip) {
  const today = todayKey();

  if (!ipUsage.has(ip)) {
    ipUsage.set(ip, {});
  }

  const record = ipUsage.get(ip);
  record[today] = record[today] || 0;

  if (record[today] >= DAILY_LIMIT) {
    return false;
  }

  record[today] += 1;
  return true;
}

export async function onRequest({ request }) {
  // ✅ Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const payload = await request.json();
    const mode = payload.mode || "local";

    // ✅ OpenAI 모드만 제한
    if (mode === "openai") {
      const ip = getClientIP(request);

      const allowed = checkAndIncreaseUsage(ip);
      if (!allowed) {
        return new Response(
          JSON.stringify({
            error: "LIMIT_EXCEEDED",
            message: "오늘 OpenAI 타로 리딩은 3회까지 가능합니다.",
          }),
          { status: 429, headers: corsHeaders }
        );
      }
    }

    // 👉 Render Flask API로 그대로 전달
    const res = await fetch("https://saju500.onrender.com/api/tarot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(
        JSON.stringify({
          error: "AI_API_ERROR",
          detail: text,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "SERVER_ERROR",
        detail: String(e),
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
