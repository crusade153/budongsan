// actions/realestate-actions.ts
"use server";

import { RealEstateTransaction } from "@/types/realestate";

const lawdCdMap: Record<string, string> = {
  "전주시 완산구": "52111",
  "전주시 덕진구": "52113",
  "군산시": "52130",
  "익산시": "52140",
  "정읍시": "52180",
  "남원시": "52190",
  "김제시": "52210",
  "완주군": "52710",
};

const getRecentMonths = (count = 6) => {
  const result = [];
  const today = new Date();
  let year = today.getFullYear();
  let month = today.getMonth() + 1;

  for (let i = 0; i < count; i++) {
    const ym = `${year}${month.toString().padStart(2, "0")}`;
    result.push(ym);
    month--;
    if (month === 0) {
      month = 12;
      year--;
    }
  }
  return result;
};

export async function fetchRealEstateData(sigungu: string, dong: string): Promise<RealEstateTransaction[]> {
  if (!sigungu || !dong) return [];

  const lawdCd = lawdCdMap[sigungu];
  if (!lawdCd) return [];

  const targetMonths = getRecentMonths(6);
  let allTransactions: RealEstateTransaction[] = [];

  const rawApiKey = process.env.DATA_GO_KR_API_KEY || "";
  const cleanApiKey = rawApiKey.replace(/['"\r\n\s]/g, "");
  const finalApiKey = cleanApiKey.includes("%") ? cleanApiKey : encodeURIComponent(cleanApiKey);

  // 6개월치 데이터를 비동기 병렬로 한 번에 가져와서 속도 극대화
  const fetchPromises = targetMonths.map(async (ym) => {
    const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${finalApiKey}&pageNo=1&numOfRows=999&LAWD_CD=${lawdCd}&DEAL_YMD=${ym}&_type=json`;

    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store", 
      });

      if (!response.ok) return [];

      const responseText = await response.text();
      let parsedData;
      try {
        parsedData = JSON.parse(responseText);
      } catch (e) {
        return [];
      }

      const items = parsedData.response?.body?.items?.item;
      if (items) {
        const itemsArray = Array.isArray(items) ? items : [items];
        return itemsArray.filter((item: any) => item.umdNm && item.umdNm.trim() === dong.trim()) as RealEstateTransaction[];
      }
      return [];
    } catch (error) {
      console.error(`[${ym}] API Fetch Error:`, error);
      return [];
    }
  });

  const results = await Promise.all(fetchPromises);
  results.forEach((res) => {
    allTransactions = allTransactions.concat(res);
  });

  return allTransactions;
}