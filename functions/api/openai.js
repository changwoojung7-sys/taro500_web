export async function onRequest(context) {
  const { request } = context;

  /* ===============================
     CORS Preflight
  =============================== */
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  /* ===============================
     Body Parsing
  =============================== */
  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: corsHeaders }
    );
  }

  /* ===============================
     Render Flask API 호출
  =============================== */
  try {
    const res = await fetch(
      "https://saju500.onrender.com/api/saju",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({
          error: "Render API error",
          detail: errText,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const data = await res.json();

    // 🔥 Render에서 내려준 결과 그대로 전달
    return new Response(
      JSON.stringify({
        result: data.result,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Failed to call Render API",
        detail: String(err),
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/* ===============================
   CORS Headers
=============================== */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
