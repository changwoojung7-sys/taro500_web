import OpenAI from "openai";

// function createOpenAIClient() {
//   const apiKey =
//     process.env.OPENAI_API_KEY ||
//     globalThis?.OPENAI_API_KEY || // (일부 런타임 대비)
//     "";

//   if (!apiKey) throw new Error("OPENAI_API_KEY is not defined");
//   return new OpenAI({ apiKey });
// }

//clodeflare workers 버전
function createOpenAIClient(env) {
  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not defined");
  }

  return new OpenAI({ apiKey });
}

function buildAIPrompt(drawSummary, cards) {
  const list = (cards || [])
    .map(
      (c, i) =>
        `${i + 1}. ${c?.name_kr || ""} (${c?.is_reversed ? "역방향" : "정방향"}) - ${
          c?.position_label || ""
        }`
    )
    .join("\n");

  return `
당신은 숙련된 타로 리더입니다.
아래는 실제 카드 리딩 결과입니다.

[리딩 요약]
${drawSummary || ""}

[카드 목록]
${list}

요구사항:
1) 각 카드마다 타로 리더 말투로 3~5문장 코멘트를 작성하세요.
2) 카드 위치와 정/역방향 의미를 반드시 반영하세요.
3) 마지막에는 전체 흐름을 종합한 코멘트를 작성하세요.
4) 반드시 JSON 형식으로만 응답하세요. (설명/마크다운 금지)

응답 형식:
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
`.trim();
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // 필요하면 CORS 열기 (같은 도메인이면 없어도 됨)
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(obj),
  };
}

export async function handler(event) {
  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed. Use POST." });
  }

  let payload;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const summaryText = payload.summaryText || payload.summary || "";
  const cards = Array.isArray(payload.cards) ? payload.cards : [];

  if (!summaryText || cards.length === 0) {
    return json(400, { error: "summaryText and cards are required" });
  }

  let client;
  try {
    client = createOpenAIClient();
  } catch (err) {
    return json(500, {
      error: "OpenAI API Key not configured",
      detail: err?.message || String(err),
    });
  }

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        { role: "system", content: "You are a professional tarot reader." },
        { role: "user", content: buildAIPrompt(summaryText, cards) },
      ],
    });

    const raw = completion?.choices?.[0]?.message?.content || "";

    // 모델이 JSON 앞뒤로 글을 섞는 경우 대비: 첫 { ~ 마지막 }만 추출
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    const jsonText = first >= 0 && last > first ? raw.slice(first, last + 1) : raw;

    let result;
    try {
      result = JSON.parse(jsonText);
    } catch (e) {
      return json(500, {
        error: "AI 응답 파싱 실패",
        raw: raw.slice(0, 2000), // 디버깅용 (너무 길면 잘라줌)
      });
    }

    return json(200, {
      card_comments: Array.isArray(result.card_comments) ? result.card_comments : [],
      overall_comment: result.overall_comment || {},
    });
  } catch (e) {
    return json(500, {
      error: "OpenAI 호출 실패",
      detail: e?.message || String(e),
    });
  }
}
