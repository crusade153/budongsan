import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ error: "검색어가 필요합니다." }, { status: 400 });
  }

  const clientId = process.env.NAVER_CLIENT_ID || "";
  const clientSecret = process.env.NAVER_CLIENT_SECRET || "";

  try {
    // 정확도를 높이기 위해 검색어에 '부동산 호재' 또는 '아파트' 키워드 결합 후 인코딩
    const searchQuery = encodeURIComponent(`${query} 부동산 OR 아파트`);
    // display=5: 최신/정확도 높은 기사 5개만 추출, sort=sim: 유사도순
    const url = `https://openapi.naver.com/v1/search/news.json?query=${searchQuery}&display=5&sort=sim`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });

    if (!response.ok) {
      throw new Error(`Naver API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data: data.items });
  } catch (error) {
    console.error("Naver News API 통신 에러:", error);
    return NextResponse.json(
      { error: "뉴스 데이터를 가져오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}