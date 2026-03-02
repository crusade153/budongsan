import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  try {
    // 1. 프론트엔드에서 보낸 데이터(아파트명, 평형, 가격, 과거 거래내역) 받기
    const body = await request.json();
    const { apt, size, price, historyData } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API 키가 설정되지 않았습니다." }, { status: 500 });
    }

    // 2. Gemini 2.5 Flash 모델 초기화
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 3. AI에게 내릴 프롬프트(명령어) 정교하게 작성
    const hasData = historyData && historyData.length > 0;
    const historyText = hasData 
      ? JSON.stringify(historyData, null, 2) 
      : "최근 6개월간 해당 평형의 실거래 내역이 없습니다.";

    const prompt = `
      너는 전북특별자치도 부동산 시장에 정통한 데이터 분석 전문가야.
      사용자가 다음 조건의 매물을 매수하려고 해.
      
      [매수 희망 조건]
      - 아파트명: ${apt}
      - 평형: ${size}㎡
      - 현재 매물 호가: ${price}만원

      [최근 6개월 실거래가 데이터]
      ${historyText}

      위 정보를 바탕으로 사용자에게 전문적인 브리핑 리포트를 작성해줘. 다음 항목을 반드시 포함해야 해:
      
      1. 가격 적정성 평가: 
         - 실거래가가 있다면, 현재 호가(${price}만원)가 최근 실거래가 평균이나 최고/최저가 대비 적절한지, 비싼지 분석해.
         - 실거래가가 없다면, 최근 거래가 없다는 점(환금성 부족 등)을 지적하고 호가 판단에 주의를 당부해.
      2. 최근 가격 추이 요약: 거래 데이터의 상승/하락 흐름을 분석해.
      3. 매수 조언: 현재 시점에서 이 가격에 매수하는 것에 대한 너의 최종 의견(적극 매수, 보류, 네고 필수 등)을 줘.

      가독성을 위해 마크다운(Markdown) 문법을 사용해서 소제목과 글머리 기호로 깔끔하게 정리해줘.
    `;

    // 4. AI에게 분석 요청 및 결과 받기
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return NextResponse.json({ success: true, report: responseText });
    
  } catch (error) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: "AI 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}