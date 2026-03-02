import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lawdCd = searchParams.get("lawdCd");   
  const dealYmd = searchParams.get("dealYmd"); 

  if (!lawdCd || !dealYmd) {
    return NextResponse.json({ error: "법정동코드와 계약월이 필요합니다." }, { status: 400 });
  }

  const rawApiKey = process.env.DATA_GO_KR_API_KEY || "";
  const cleanApiKey = rawApiKey.replace(/['"\r\n\s]/g, "");
  const finalApiKey = cleanApiKey.includes('%') ? cleanApiKey : encodeURIComponent(cleanApiKey);

  try {
    // ★ 핵심 수정: 9999를 999로 변경! (공공데이터포털이 1000건 이상은 뱉어냅니다)
    const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${finalApiKey}&pageNo=1&numOfRows=999&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&_type=json`;
    
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store", 
    });

    const responseData = await response.text();

    return NextResponse.json({ 
      success: true, 
      requestUrl: url, 
      data: responseData 
    });
    
  } catch (error) {
    console.error("Fetch API Error 통신 실패:", error);
    return NextResponse.json(
      { error: "데이터를 가져오는 중 오류가 발생했습니다." }, 
      { status: 500 }
    );
  }
}