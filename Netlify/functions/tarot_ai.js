import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const handler = async (event) => {
  try {
    const { cards, question } = JSON.parse(event.body);

    const cardText = cards.map(c =>
      `${c.name_kr} (${c.is_reversed ? "역" : "정"}) : ${
        c.is_reversed ? c.reversed.meaning : c.upright.meaning
      }`
    ).join("\n");

    const prompt = `
질문: ${question}

뽑은 타로 카드:
${cardText}

위 결과를 바탕으로
1) 전체 흐름 요약
2) 조언
3) 주의점
을 한국어로 타로 리더처럼 설명해줘.
`;

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.2",
      input: prompt
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        result: response.output_text
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
