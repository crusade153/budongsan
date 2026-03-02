"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchRealEstateData } from "@/actions/realestate-actions";
import { ProcessedTransaction, AiReport } from "@/types/realestate";
import toast from "react-hot-toast";
import { Search, TrendingUp, Newspaper, CheckCircle, MapPin, Building, Ruler, Coins } from "lucide-react";
import PriceChart from "./PriceChart";

const jeonbukRegionData: Record<string, string[]> = {
  "전주시 완산구": ["효자동1가", "효자동2가", "효자동3가", "평화동1가", "평화동2가", "삼천동1가", "삼천동2가", "서신동", "중화산동1가", "중화산동2가"],
  "전주시 덕진구": ["송천동1가", "송천동2가", "우아동1가", "우아동2가", "우아동3가", "호성동1가", "호성동2가", "인후동1가", "인후동2가", "여의동", "만성동", "장동", "중동"],
  "군산시": ["수송동", "조촌동", "미장동", "지곡동", "나운동", "산북동", "소룡동"],
  "익산시": ["모현동1가", "모현동2가", "영등동", "부송동", "어양동", "신동", "마동"],
  "완주군": ["봉동읍", "삼례읍", "이서면"],
};

export default function RegionSelector() {
  const [sigungu, setSigungu] = useState("");
  const [dong, setDong] = useState("");
  const [apt, setApt] = useState("");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  
  const [aiReport, setAiReport] = useState<AiReport | null>(null);
  const [chartData, setChartData] = useState<ProcessedTransaction[] | null>(null);

  const handleSigunguChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSigungu(e.target.value);
    setDong(""); setApt(""); setSize(""); setAiReport(null); setChartData(null);
  };

  const handleDongChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDong(e.target.value);
    setApt(""); setSize(""); setAiReport(null); setChartData(null);
  };

  const handleAptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setApt(e.target.value);
    setSize(""); setAiReport(null); setChartData(null);
  };

  const { data: cachedTransactions = [], isLoading: isFetchingApts } = useQuery({
    queryKey: ["realestate", sigungu, dong],
    queryFn: () => fetchRealEstateData(sigungu, dong),
    enabled: !!sigungu && !!dong,
  });

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
      toast.error("모든 항목을 빠짐없이 입력해주세요.");
      return;
    }

    setIsAnalyzing(true);
    setAiReport(null);
    setChartData(null);

    try {
      setLoadingText("데이터 정리 중...");
      const targetSize = Number(size);
      const filteredList = cachedTransactions.filter((item) => {
        const isAptMatch = item.aptNm === apt;
        const isSizeMatch = Math.abs(Number(item.excluUseAr) - targetSize) <= 3; 
        return isAptMatch && isSizeMatch;
      });

      const processedData: ProcessedTransaction[] = filteredList.map((item) => ({
        아파트명: item.aptNm,
        전용면적: item.excluUseAr,
        층: item.floor,
        거래일: `${item.dealYear}-${String(item.dealMonth).padStart(2, '0')}-${String(item.dealDay).padStart(2, '0')}`,
        거래금액_만원: parseInt(String(item.dealAmount).replace(/,/g, "").trim()),
      })).sort((a, b) => new Date(b.거래일).getTime() - new Date(a.거래일).getTime());

      if (processedData.length === 0) {
        toast.error("조건에 맞는 실거래 데이터가 없습니다.");
        setIsAnalyzing(false);
        return; 
      }

      setLoadingText("뉴스 검색 중...");
      let newsData = [];
      try {
        const keyword = `${sigungu} ${dong}`;
        const newsResponse = await fetch(`/api/news?query=${encodeURIComponent(keyword)}`);
        const newsResult = await newsResponse.json();
        
        if (newsResult.success && newsResult.data) {
          newsData = newsResult.data.map((article: any) => ({
            title: article.title.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"'),
            description: article.description.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"')
          }));
        }
      } catch (newsErr) {
        console.warn("뉴스 데이터 수집 실패:", newsErr);
      }

      setLoadingText("AI 브리핑 작성 중...");
      const aiResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apt,
          size,
          price,
          historyData: processedData,
          newsData,
        }),
      });

      const aiResult = await aiResponse.json();
      
      if (aiResult.success) {
        setAiReport(aiResult.report);
        setChartData(processedData); 
        toast.success("분석이 완료되었습니다!");
      } else {
        toast.error("AI 분석 실패: " + aiResult.error);
      }
      
    } catch (error) {
      console.error(error);
      toast.error("분석 중 에러가 발생했습니다.");
    } finally {
      setIsAnalyzing(false);
      setLoadingText("");
    }
  };

  return (
    // 모바일에서는 px-4, my-4 로 여백을 좁히고, PC에서는 px-8, my-10 으로 쾌적하게 렌더링
    <div className="p-4 sm:p-8 bg-white sm:rounded-3xl shadow-xl max-w-3xl mx-auto my-4 sm:my-10 border-y sm:border border-gray-100">
      <div className="mb-6 sm:mb-8">
        <h2 className="text-lg sm:text-xl font-extrabold mb-4 text-gray-800 flex items-center gap-2">
          <MapPin className="text-blue-500 w-5 h-5 sm:w-6 sm:h-6" />
          1. 관심 지역 및 아파트
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
          <div className="relative">
            <select disabled className="w-full p-3 sm:p-4 pl-10 border rounded-xl bg-gray-100 text-gray-700 appearance-none text-sm sm:text-base">
              <option>전북특별자치도</option>
            </select>
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
          </div>

          <select value={sigungu} onChange={handleSigunguChange} className="w-full p-3 sm:p-4 border rounded-xl bg-white text-black focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-sm sm:text-base cursor-pointer">
            <option value="">시/군/구 선택</option>
            {Object.keys(jeonbukRegionData).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <select value={dong} onChange={handleDongChange} disabled={!sigungu} className="w-full p-3 sm:p-4 border rounded-xl bg-white text-black disabled:bg-gray-50 disabled:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-sm sm:text-base cursor-pointer">
            <option value="">법정동 선택</option>
            {sigungu && jeonbukRegionData[sigungu].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          
          <div className="relative">
            <select value={apt} onChange={handleAptChange} disabled={!dong || isFetchingApts} className="w-full p-3 sm:p-4 pl-10 border rounded-xl bg-white text-black disabled:bg-gray-50 disabled:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-sm sm:text-base cursor-pointer">
              <option value="">
                {isFetchingApts ? "목록 로딩 중..." : (availableApts.length > 0 ? "아파트 선택" : (dong ? "최근 거래 없음" : "아파트 선택"))}
              </option>
              {availableApts.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="relative">
          <select value={size} onChange={(e) => setSize(e.target.value)} disabled={!apt} className="w-full p-3 sm:p-4 pl-10 border rounded-xl bg-white text-black disabled:bg-gray-50 disabled:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-sm sm:text-base cursor-pointer">
            <option value="">평형(전용면적) 선택</option>
            {availableSizes.map((s) => <option key={s} value={s}>{s}㎡</option>)}
          </select>
          <Ruler className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      <div className="mb-6 sm:mb-8">
        <h2 className="text-lg sm:text-xl font-extrabold mb-4 text-gray-800 flex items-center gap-2">
          <Coins className="text-blue-500 w-5 h-5 sm:w-6 sm:h-6" />
          2. 매물 호가 입력
        </h2>
        
        <div className="flex flex-col md:flex-row gap-3 sm:gap-4 items-center">
          <div className="relative w-full md:w-2/3 shadow-sm">
            <input 
              type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="호가 입력 (예: 35000)"
              className="w-full p-3 sm:p-4 pl-10 border rounded-xl bg-white text-black text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold text-sm sm:text-base">만원</span>
          </div>
          
          <button 
            onClick={handleAnalyze} 
            disabled={isAnalyzing} 
            className={`w-full md:w-1/3 text-white font-bold p-3 sm:p-4 rounded-xl transition duration-200 flex items-center justify-center gap-2 shadow-md text-sm sm:text-base
              ${isAnalyzing ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'}`}
          >
            {isAnalyzing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {loadingText}
              </>
            ) : 'AI 분석하기'}
          </button>
        </div>
      </div>

      {isAnalyzing && (
        <div className="mt-8 space-y-4 sm:space-y-6 animate-pulse">
          <div className="h-6 sm:h-8 bg-gray-200 rounded w-1/2 sm:w-1/3"></div>
          <div className="h-48 sm:h-64 bg-gray-100 rounded-2xl border border-gray-200"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div className="h-32 sm:h-40 bg-gray-100 rounded-2xl border border-gray-200"></div>
            <div className="h-32 sm:h-40 bg-gray-100 rounded-2xl border border-gray-200"></div>
          </div>
        </div>
      )}

      {aiReport && chartData && !isAnalyzing && (
        <div className="mt-8 sm:mt-10 animate-fade-in-up">
          <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2 border-b pb-3 sm:pb-4">
            <span className="text-2xl sm:text-3xl">✨</span> 브리핑 리포트
          </h3>
          
          <PriceChart data={chartData} targetPrice={Number(price)} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-blue-100 shadow-sm hover:shadow-md transition">
              <h4 className="font-bold text-blue-800 flex items-center gap-2 mb-2 sm:mb-3 text-base sm:text-lg">
                <Search className="w-4 h-4 sm:w-5 sm:h-5" /> 가격 적정성 평가
              </h4>
              <p className="text-gray-700 leading-relaxed text-sm sm:text-base">{aiReport.evaluation}</p>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-green-100 shadow-sm hover:shadow-md transition">
              <h4 className="font-bold text-green-800 flex items-center gap-2 mb-2 sm:mb-3 text-base sm:text-lg">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" /> 최근 가격 추이
              </h4>
              <p className="text-gray-700 leading-relaxed text-sm sm:text-base">{aiReport.trend}</p>
            </div>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-purple-100 shadow-sm hover:shadow-md transition mb-4 sm:mb-6">
            <h4 className="font-bold text-purple-800 flex items-center gap-2 mb-2 sm:mb-3 text-base sm:text-lg">
              <Newspaper className="w-4 h-4 sm:w-5 sm:h-5" /> 지역 뉴스 및 동향
            </h4>
            <p className="text-gray-700 leading-relaxed text-sm sm:text-base">{aiReport.newsSummary}</p>
          </div>

          <div className="bg-gradient-to-r from-indigo-500 to-blue-600 p-6 sm:p-8 rounded-2xl shadow-lg text-white">
            <h4 className="font-extrabold flex items-center gap-2 mb-3 sm:mb-4 text-lg sm:text-xl">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-200" /> Action Plan (결론)
            </h4>
            <p className="text-indigo-50 leading-relaxed text-base sm:text-lg whitespace-pre-wrap">
              {aiReport.actionPlan}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}