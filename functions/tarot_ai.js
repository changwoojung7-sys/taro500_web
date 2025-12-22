export async function onRequest(context) {
  const { request } = context;

  // ✅ CORS + Preflight
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

  try {
    const payload = await request.json();

    const res = await fetch(
      "https://saju500.onrender.com/api/tarot",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const t = await res.text();
      return new Response(
        JSON.stringify({ error: "Render API error", detail: t }),
        { status: 500, headers: corsHeaders }
      );
    }

    const data = await res.json();

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: corsHeaders }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: corsHeaders }
    );
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
