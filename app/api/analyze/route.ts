// app/api/analyze/route.ts
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apt, size, price, historyData, newsData } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API 키가 설정되지 않았습니다." }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // JSON 구조화 출력을 강제하기 위한 설정 추가
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const hasData = historyData && historyData.length > 0;
    const historyText = hasData 
      ? JSON.stringify(historyData, null, 2) 
      : "최근 6개월간 해당 평형의 실거래 내역이 없습니다.";

    const hasNews = newsData && newsData.length > 0;
    const newsText = hasNews
      ? JSON.stringify(newsData, null, 2)
      : "현재 수집된 지역 최신 부동산 관련 뉴스가 없습니다.";

    const prompt = `
      너는 대한민국 최고의 부동산 시장 분석가이자 프롭테크 AI야.
      사용자가 다음 조건의 매물을 매수하려고 해.
      
      [매수 희망 조건]
      - 아파트명: ${apt}
      - 평형: ${size}㎡
      - 현재 매물 호가: ${price}만원

      [최근 6개월 실거래가 데이터]
      ${historyText}

      [해당 지역 최신 부동산 뉴스 및 동향]
      ${newsText}

      위 정보를 바탕으로 사용자에게 매우 입체적이고 전문적인 매수 브리핑 리포트를 작성해줘.
      결과는 반드시 아래 JSON 스키마(형식)에 맞춰서 작성해줘. (마크다운 없이 순수 JSON 객체만 반환할 것)

      {
        "evaluation": "가격 적정성 평가: 실거래가가 있다면, 현재 호가가 최근 실거래가 평균, 최고가, 최저가 대비 적절한지 분석. 실거래가가 없다면 주의 당부.",
        "trend": "최근 가격 추이 요약: 거래 데이터의 상승/하락/보합 흐름 분석",
        "newsSummary": "지역 뉴스 및 동향 분석: 뉴스 데이터를 바탕으로 개발 호재나 악재 요약",
        "actionPlan": "종합 매수 조언: 최종 의견(적극 매수, 보류, 네고 필수 등)과 구체적인 행동 지침"
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // AI가 반환한 JSON 텍스트를 파싱
    const parsedReport = JSON.parse(responseText);

    return NextResponse.json({ success: true, report: parsedReport });
    
  } catch (error) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}