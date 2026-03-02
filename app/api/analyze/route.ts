import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  try {
    // 1. 프론트엔드에서 보낸 데이터(아파트명, 평형, 가격, 과거 거래내역, 뉴스 데이터) 받기
    const body = await request.json();
    const { apt, size, price, historyData, newsData } = body;

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

    // ★ 추가된 로직: 뉴스 데이터가 있는지 확인하고 텍스트화
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

      위 정보를 바탕으로 사용자에게 매우 입체적이고 전문적인 매수 브리핑 리포트를 작성해줘. 다음 항목을 반드시 포함해야 해:
      
      1. 가격 적정성 평가: 
         - 실거래가가 있다면, 현재 호가(${price}만원)가 최근 실거래가 평균, 최고가, 최저가 대비 적절한지 객관적인 수치를 바탕으로 분석해.
         - 호가가 비싸다면 얼마 정도 비싼지, 싸다면 메리트가 있는지 명시해.
         - 실거래가가 없다면, 최근 거래가 없다는 점(환금성 부족 등)을 지적하고 호가 판단에 주의를 당부해.
         
      2. 최근 가격 추이 요약: 
         - 거래 데이터의 상승/하락/보합 흐름을 분석해.
         
      3. 지역 뉴스 및 동향 분석 (핵심): 
         - 함께 제공된 최신 뉴스 데이터를 바탕으로 해당 지역의 개발 호재, 인프라 확충, 혹은 부정적 이슈(악재)를 요약해줘.
         - 뉴스가 없다면 이 부분은 "현재 뚜렷한 지역 뉴스 특이사항 없음"으로 간략히 언급해.
         
      4. 종합 매수 조언 (Action Plan): 
         - [실거래가 기반의 가격 평가]와 [뉴스 기반의 미래 가치 기대감]을 융합하여 결론을 내려줘.
         - 현재 시점에서 이 가격에 매수하는 것에 대한 너의 최종 의견(적극 매수 권장, 보류 추천, 최소 OO만원 이하로 네고 필수 등)과 구체적인 행동 지침을 제시해.

      가독성을 위해 마크다운(Markdown) 문법을 사용해서 소제목과 글머리 기호로 깔끔하고 세련되게 정리해줘.
    `;

    // 4. AI에게 분석 요청 및 결과 받기
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return NextResponse.json({ success: true, report: responseText });
    
  } catch (error) {
    console.error("Gemini API Error:", error);
    // 에러 발생 시 서버가 죽지 않도록 안전한 응답 반환 (2계명: 실패에 대비하라)
    return NextResponse.json({ error: "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}