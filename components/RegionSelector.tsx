"use client";

import { useState } from "react";

// 1. 전북특별자치도 전용 지역 및 법정동 데이터
const jeonbukRegionData: Record<string, string[]> = {
  "전주시 완산구": ["효자동1가", "효자동2가", "효자동3가", "평화동1가", "평화동2가", "삼천동1가", "삼천동2가", "서신동", "중화산동1가", "중화산동2가"],
  "전주시 덕진구": ["송천동1가", "송천동2가", "우아동1가", "우아동2가", "우아동3가", "호성동1가", "호성동2가", "인후동1가", "인후동2가", "여의동", "만성동", "장동", "중동"],
  "군산시": ["수송동", "조촌동", "미장동", "지곡동", "나운동", "산북동", "소룡동"],
  "익산시": ["모현동1가", "모현동2가", "영등동", "부송동", "어양동", "신동", "마동"],
  "완주군": ["봉동읍", "삼례읍", "이서면"],
};

// 2. 전북 주요 시/군/구 법정동코드 매핑 사전
const lawdCdMap: Record<string, string> = {
  "전주시 완산구": "45111",
  "전주시 덕진구": "45113",
  "군산시": "45130",
  "익산시": "45140",
  "정읍시": "45180",
  "남원시": "45190",
  "김제시": "45210",
  "완주군": "45710",
};

const defaultSizes = ["59", "74", "84", "102", "114"];

// 최근 N개월의 년월(YYYYMM) 배열 생성 함수
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
  
  const [isLoading, setIsLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string>("");

  const handleSigunguChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSigungu(e.target.value);
    setDong(""); setApt(""); setSize(""); setAiReport("");
  };

  const handleDongChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDong(e.target.value);
    setApt(""); setSize(""); setAiReport("");
  };

  const handleAnalyze = async () => {
    if (!sigungu || !dong || !apt || !size || !price) {
      alert("모든 항목을 입력 및 선택해 주세요.");
      return;
    }

    const lawdCd = lawdCdMap[sigungu];
    setIsLoading(true);
    setAiReport(""); 

    try {
      const targetMonths = getRecentMonths(6);
      console.log(`조회 대상 월:`, targetMonths);
      
      let allTransactions: any[] = [];

      // ★ 공공데이터포털 동시 차단 방지를 위한 순차 호출 (for...of)
      for (const ym of targetMonths) {
        try {
          console.log(`[${ym}] 공공데이터 포털에 데이터 요청 중...`);
          const response = await fetch(`/api/realestate?lawdCd=${lawdCd}&dealYmd=${ym}`);
          const result = await response.json();

if (result.success) {
            const parsedData = JSON.parse(result.data);
            console.log(`[${ym}] 공공데이터 원본 확인:`, parsedData); // ★ 추가된 감시자
            
            // 공공데이터포털 서버 에러(트래픽 초과 등) 추적기
            const header = parsedData.response?.header;
            if (header && header.resultCode !== "00" && header.resultCode !== "000") {
              console.warn(`⚠️ [${ym}] 포털 응답 에러: ${header.resultMsg} (코드: ${header.resultCode})`);
              continue; // 에러가 나더라도 앱이 뻗지 않고 다음 달로 넘어갑니다.
            }

            const items = parsedData.response?.body?.items?.item;
            if (items) {
              allTransactions = allTransactions.concat(Array.isArray(items) ? items : [items]);
            }
          }
        } catch (fetchErr) {
          console.error(`[${ym}] 통신 오류 발생:`, fetchErr);
        }
      }

      console.log("============= [1. 원본 데이터 총 건수 (필터링 전)] =============");
      console.log(`최근 6개월 치 전체 데이터: 총 ${allTransactions.length}건 수집됨`);

      // 2. 조건 필터링 (±3㎡ 오차 범위 허용)
      const targetSize = parseInt(size); 
      const filteredList = allTransactions.filter((item: any) => {
        if (!item || !item.umdNm || !item.aptNm || !item.excluUseAr) return false;
        
        const isDongMatch = item.umdNm.trim() === dong.trim();
        
        const cleanItemAptNm = item.aptNm.replace(/\s/g, "");
        const cleanSearchApt = apt.replace(/\s/g, "");
        const isAptMatch = cleanItemAptNm.includes(cleanSearchApt);
        
        const actualSize = Number(item.excluUseAr);
        const isSizeMatch = Math.abs(actualSize - targetSize) <= 3; 

        return isDongMatch && isAptMatch && isSizeMatch;
      });

      // 3. 데이터 가공 및 정렬
      const processedData = filteredList.map((item: any) => ({
        아파트명: item.aptNm,
        전용면적: item.excluUseAr,
        층: item.floor,
        거래일: `${item.dealYear}-${item.dealMonth}-${item.dealDay}`,
        거래금액_만원: parseInt(String(item.dealAmt).replace(/,/g, "").trim()),
      })).sort((a, b) => new Date(b.거래일).getTime() - new Date(a.거래일).getTime());

      console.log("============= [2. 조건 일치 실거래가 (필터링 후)] =============");
      console.log(processedData);

      // ★ 4. 토큰 낭비 방지 로직 (데이터가 없으면 여기서 즉시 종료)
      if (processedData.length === 0) {
        alert(`[${apt} ${size}㎡] 조건에 맞는 최근 6개월 실거래 데이터가 없습니다.\n\nAI 토큰 절약을 위해 분석을 중단합니다.\nF12 콘솔창을 열어 공공데이터포털에서 원본 데이터가 정상적으로 수집되었는지 확인해 주세요.`);
        setIsLoading(false);
        return; 
      }

      // 5. 데이터가 존재할 때만 Gemini API 호출
      console.log("AI 분석 호출을 시작합니다...");
      const aiResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apt,
          size,
          price,
          historyData: processedData,
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
      alert("데이터 분석 중 에러가 발생했습니다. 콘솔창을 확인해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-2xl mx-auto mt-10 border border-gray-200">
      <h2 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">1. 관심 지역 및 아파트 검색 (전북 권역)</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <input 
          type="text" 
          value={apt} 
          onChange={(e) => setApt(e.target.value)} 
          disabled={!dong}
          placeholder="아파트명 (예: 우미린, 스위첸, 에코시티)"
          className="p-3 border rounded-md bg-gray-50 text-black disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <select value={size} onChange={(e) => setSize(e.target.value)} disabled={!apt} className="p-3 border rounded-md bg-gray-50 text-black disabled:opacity-50 focus:ring-2 focus:ring-blue-500">
          <option value="">평형(전용면적) 선택</option>
          {defaultSizes.map((s) => <option key={s} value={s}>{s}㎡</option>)}
        </select>
      </div>

      <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">2. 매물 가격 입력 및 분석</h2>
      
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:w-2/3">
          <input 
            type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="현재 호가 입력 (예: 50000)"
            className="w-full p-4 border rounded-md bg-gray-50 text-black text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">만원</span>
        </div>
        
        <button onClick={handleAnalyze} disabled={isLoading} className={`w-full md:w-1/3 text-white font-bold p-4 rounded-md transition duration-200 ${isLoading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {isLoading ? '순차적 데이터 수집 및 분석 중...' : 'AI 적정가 분석하기'}
        </button>
      </div>

      {aiReport && (
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg shadow-inner">
          <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center">
            <span className="mr-2">🤖</span> Gemini AI 매수 브리핑 리포트
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