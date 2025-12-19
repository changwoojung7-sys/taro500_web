export async function onRequestPost({ request, env }) {
  // CORS Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (!env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
      { status: 500 }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400 }
    );
  }

  const { summaryText, cards } = payload;

  if (!summaryText || !Array.isArray(cards)) {
    return new Response(
      JSON.stringify({ error: "Invalid payload" }),
      { status: 400 }
    );
  }

  const prompt = buildAIPrompt(summaryText, cards);

  // 🔥 OpenAI REST API 직접 호출
  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        { role: "system", content: "You are a professional tarot reader." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    return new Response(
      JSON.stringify({
        error: "OpenAI API error",
        detail: errText,
      }),
      { status: aiRes.status }
    );
  }

  const data = await aiRes.json();

  let result;
  try {
    result = JSON.parse(data.choices[0].message.content);
  } catch {
    return new Response(
      JSON.stringify({ error: "AI response parsing failed" }),
      { status: 500 }
    );
  }

  return new Response(
    JSON.stringify({
      card_comments: result.card_comments || [],
      overall_comment: result.overall_comment || {},
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

/* -----------------------
   Prompt Builder
------------------------ */
function buildAIPrompt(drawSummary, cards) {
  return `
당신은 숙련된 타로 리더입니다.

[리딩 요약]
${drawSummary}

[카드 목록]
${cards
  .map(
    (c, i) =>
      `${i + 1}. ${c.name_kr} (${c.is_reversed ? "역방향" : "정방향"}) - ${c.position_label}`
  )
  .join("\n")}

요구사항:
1. 각 카드마다 3~5문장 코멘트
2. 카드 위치와 정/역방향 반영
3. 마지막에 전체 흐름 종합
4. JSON 형식만 반환

형식:
{
  "card_comments": [
    { "index": 0, "title": "...", "message": "..." }
  ],
  "overall_comment": {
    "summary": "...",
    "advice": "...",
    "closing": "..."
  }
}
`;
}
