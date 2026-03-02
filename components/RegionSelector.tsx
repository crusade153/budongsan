"use client";

import { useState, useEffect, useMemo } from "react";

const jeonbukRegionData: Record<string, string[]> = {
  "전주시 완산구": ["효자동1가", "효자동2가", "효자동3가", "평화동1가", "평화동2가", "삼천동1가", "삼천동2가", "서신동", "중화산동1가", "중화산동2가"],
  "전주시 덕진구": ["송천동1가", "송천동2가", "우아동1가", "우아동2가", "우아동3가", "호성동1가", "호성동2가", "인후동1가", "인후동2가", "여의동", "만성동", "장동", "중동"],
  "군산시": ["수송동", "조촌동", "미장동", "지곡동", "나운동", "산북동", "소룡동"],
  "익산시": ["모현동1가", "모현동2가", "영등동", "부송동", "어양동", "신동", "마동"],
  "완주군": ["봉동읍", "삼례읍", "이서면"],
};

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

export default function RegionSelector() {
  const [sigungu, setSigungu] = useState("");
  const [dong, setDong] = useState("");
  const [apt, setApt] = useState("");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  
  const [isFetchingApts, setIsFetchingApts] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingText, setLoadingText] = useState(""); // 사용자 피드백용 상태
  const [aiReport, setAiReport] = useState<string>("");
  const [cachedTransactions, setCachedTransactions] = useState<any[]>([]);

  const handleSigunguChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSigungu(e.target.value);
    setDong(""); setApt(""); setSize(""); setAiReport("");
    setCachedTransactions([]);
  };

  const handleDongChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDong(e.target.value);
    setApt(""); setSize(""); setAiReport("");
  };

  const handleAptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setApt(e.target.value);
    setSize(""); setAiReport("");
  };

  useEffect(() => {
    if (!dong || !sigungu) {
      setCachedTransactions([]);
      return;
    }

    let isCancelled = false;
    
    const fetchAptListForDong = async () => {
      setIsFetchingApts(true);
      const lawdCd = lawdCdMap[sigungu];
      const targetMonths = getRecentMonths(6);
      let allTransactions: any[] = [];

      for (const ym of targetMonths) {
        if (isCancelled) break;
        try {
          const response = await fetch(`/api/realestate?lawdCd=${lawdCd}&dealYmd=${ym}`);
          const result = await response.json();

          if (result.success) {
            let parsedData;
            try {
              parsedData = JSON.parse(result.data);
            } catch (e) {
              continue; 
            }
            
            const items = parsedData.response?.body?.items?.item;
            if (items) {
              const itemsArray = Array.isArray(items) ? items : [items];
              const dongItems = itemsArray.filter((item: any) => item.umdNm && item.umdNm.trim() === dong.trim());
              allTransactions = allTransactions.concat(dongItems);
            }
          }
        } catch (fetchErr) {
          console.error(`[${ym}] 통신 오류:`, fetchErr);
        }
      }

      if (!isCancelled) {
        setCachedTransactions(allTransactions);
        setIsFetchingApts(false);
      }
    };

    fetchAptListForDong();

    return () => {
      isCancelled = true;
    };
  }, [dong, sigungu]);

  const availableApts = useMemo(() => {
    const apts = cachedTransactions.map(t => t.aptNm).filter(Boolean);
    return Array.from(new Set(apts)).sort();
  }, [cachedTransactions]);

  const availableSizes = useMemo(() => {
    if (!apt) return [];
    const sizes = cachedTransactions
      .filter(t => t.aptNm === apt)
      .map(t => t.excluUseAr)
      .filter(Boolean);
    return Array.from(new Set(sizes)).sort((a, b) => Number(a) - Number(b));
  }, [apt, cachedTransactions]);

  const handleAnalyze = async () => {
    if (!sigungu || !dong || !apt || !size || !price) {
      alert("모든 항목을 입력 및 선택해 주세요.");
      return;
    }

    setIsAnalyzing(true);
    setAiReport(""); 

    try {
      // 1. 실거래가 데이터 필터링
      setLoadingText("실거래가 데이터 정리 중...");
      const targetSize = Number(size);
      const filteredList = cachedTransactions.filter((item: any) => {
        const isAptMatch = item.aptNm === apt;
        const isSizeMatch = Math.abs(Number(item.excluUseAr) - targetSize) <= 3; 
        return isAptMatch && isSizeMatch;
      });

      const processedData = filteredList.map((item: any) => ({
        아파트명: item.aptNm,
        전용면적: item.excluUseAr,
        층: item.floor,
        거래일: `${item.dealYear}-${item.dealMonth}-${item.dealDay}`,
        거래금액_만원: parseInt(String(item.dealAmount).replace(/,/g, "").trim()),
      })).sort((a, b) => new Date(b.거래일).getTime() - new Date(a.거래일).getTime());

      if (processedData.length === 0) {
        alert("선택하신 조건에 맞는 실거래 데이터가 없습니다.");
        setIsAnalyzing(false);
        return; 
      }

      // 2. 네이버 뉴스 API 호출 (지역 동향 파악)
      setLoadingText("지역 부동산 최신 뉴스 검색 중...");
      let newsData = [];
      try {
        const keyword = `${sigungu} ${dong}`; // 예: 군산시 조촌동
        const newsResponse = await fetch(`/api/news?query=${encodeURIComponent(keyword)}`);
        const newsResult = await newsResponse.json();
        
        if (newsResult.success && newsResult.data) {
          // HTML 태그(<b>, </b> 등) 정규식으로 제거하여 순수 텍스트만 추출
          newsData = newsResult.data.map((article: any) => ({
            title: article.title.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"'),
            description: article.description.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"')
          }));
        }
      } catch (newsErr) {
        console.warn("뉴스 데이터 수집 실패(분석은 계속 진행됨):", newsErr);
      }

      // 3. Gemini AI 호출 (실거래가 + 뉴스 데이터 동시 전송)
      setLoadingText("AI가 데이터를 종합하여 브리핑 작성 중...");
      const aiResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apt,
          size,
          price,
          historyData: processedData,
          newsData, // ★ 뉴스 데이터 추가
        }),
      });

      const aiResult = await aiResponse.json();
      
      if (aiResult.success) {
        setAiReport(aiResult.report);
      } else {
        alert("AI 분석 실패: " + aiResult.error);
      }
      
    } catch (error) {
      console.error(error);
      alert("데이터 분석 중 에러가 발생했습니다.");
    } finally {
      setIsAnalyzing(false);
      setLoadingText("");
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-2xl mx-auto mt-10 border border-gray-200">
      <h2 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">1. 관심 지역 및 아파트 선택</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <select disabled className="p-3 border rounded-md bg-gray-200 text-gray-700">
          <option>전북특별자치도</option>
        </select>

        <select value={sigungu} onChange={handleSigunguChange} className="p-3 border rounded-md bg-gray-50 text-black focus:ring-2 focus:ring-blue-500">
          <option value="">시/군/구 선택</option>
          {Object.keys(jeonbukRegionData).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={dong} onChange={handleDongChange} disabled={!sigungu} className="p-3 border rounded-md bg-gray-50 text-black disabled:opacity-50 focus:ring-2 focus:ring-blue-500">
          <option value="">법정동 선택</option>
          {sigungu && jeonbukRegionData[sigungu].map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        
        <select value={apt} onChange={handleAptChange} disabled={!dong || isFetchingApts} className="p-3 border rounded-md bg-gray-50 text-black disabled:opacity-50 focus:ring-2 focus:ring-blue-500">
          <option value="">
            {isFetchingApts ? "최근 거래된 아파트 목록 구성 중..." : (availableApts.length > 0 ? "아파트 선택" : (dong ? "최근 6개월 거래 내역 없음" : "아파트 선택"))}
          </option>
          {availableApts.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="mb-8">
        <select value={size} onChange={(e) => setSize(e.target.value)} disabled={!apt} className="w-full p-3 border rounded-md bg-gray-50 text-black disabled:opacity-50 focus:ring-2 focus:ring-blue-500">
          <option value="">평형(전용면적) 선택</option>
          {availableSizes.map((s) => <option key={s} value={s}>{s}㎡</option>)}
        </select>
      </div>

      <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">2. 매물 호가 입력 및 분석</h2>
      
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:w-2/3">
          <input 
            type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="현재 보신 매물 호가 입력 (예: 35000)"
            className="w-full p-4 border rounded-md bg-gray-50 text-black text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">만원</span>
        </div>
        
        <button onClick={handleAnalyze} disabled={isAnalyzing} className={`w-full md:w-1/3 text-white font-bold p-4 rounded-md transition duration-200 ${isAnalyzing ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {isAnalyzing ? loadingText : 'AI 적정가 분석하기'}
        </button>
      </div>

      {aiReport && (
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg shadow-inner">
          <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center">
            <span className="mr-2">🤖</span> 종합 분석 브리핑 리포트
          </h3>
          <div className="prose prose-blue max-w-none text-gray-800">
            <pre className="whitespace-pre-wrap font-sans text-sm md:text-base leading-relaxed">
              {aiReport}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}