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
너는 10년 이상 경력의 전문 타로 리더다.
말투는 차분하고 신뢰감 있게, 하지만 따뜻해야 한다.

[질문]
${question}

[스프레드]
${spreadName}

[카드 결과]
${cardText}

아래 구조를 반드시 지켜서 해설해라:

1. 전체 흐름 요약
- 카드들이 공통적으로 말해주는 핵심 메시지

2. 현재 상황 해석
- 질문자가 처한 심리/환경

3. 앞으로의 가능성
- 긍정적 전개와 주의할 전개를 모두 언급

4. 실천 조언
- 지금 당장 할 수 있는 행동 2~3가지

※ 단순 나열 금지, 카드 간 연결을 설명할 것
※ 추상적 문장 금지, 현실적인 표현 사용
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
