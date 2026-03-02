"use client";

import { ProcessedTransaction } from "@/types/realestate";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface PriceChartProps {
  data: ProcessedTransaction[];
  targetPrice: number;
}

export default function PriceChart({ data, targetPrice }: PriceChartProps) {
  // 차트를 그리기 위해 과거 날짜부터 최신 날짜 순으로 배열 뒤집기
  const chartData = [...data].reverse().map((item) => ({
    name: item.거래일,
    price: item.거래금액_만원,
  }));

  const minPrice = Math.min(...chartData.map((d) => d.price), targetPrice);
  const maxPrice = Math.max(...chartData.map((d) => d.price), targetPrice);
  // 차트가 답답해 보이지 않도록 위아래 여백(버퍼)을 15% 줌
  const buffer = (maxPrice - minPrice) * 0.15; 

  return (
    // 모바일에서는 여백(p-4)과 높이(h-64)를 줄이고, PC(sm 이상)에서는 여유롭게(p-6, h-80) 설정
    <div className="w-full h-64 sm:h-80 bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm mb-6 sm:mb-8">
      <h4 className="text-base sm:text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
        📊 최근 실거래가 흐름 vs 내 매물 호가
      </h4>
      <ResponsiveContainer width="100%" height="100%">
        {/* 모바일 최적화를 위해 차트 좌우 여백 최소화 */}
        <AreaChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
          <defs>
            {/* 부드러운 파란색 그라데이션 적용 (눈의 피로도 감소) */}
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          {/* 그리드 선을 더 연하게(#f3f4f6) 변경 */}
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 11, fill: '#9ca3af' }} 
            tickFormatter={(value) => value.substring(5)} // MM-DD만 표시
            axisLine={false}
            tickLine={false}
            dy={10}
          />
          <YAxis 
            domain={[Math.max(0, Math.floor(minPrice - buffer)), Math.ceil(maxPrice + buffer)]} 
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            // ★ 모바일 최적화: 35,000 -> 3.5억으로 표기하여 Y축 공간 절약
            tickFormatter={(value) => value >= 10000 ? `${parseFloat((value / 10000).toFixed(2))}억` : value.toLocaleString()}
            axisLine={false}
            tickLine={false}
            dx={-5}
          />
          
          {/* ★ Vercel 빌드 에러 해결: value의 타입을 number | undefined로 지정하고 예외 처리 */}
          <Tooltip 
            formatter={(value: number | undefined) => {
              if (value === undefined) return ["- 만원", "실거래가"];
              return [`${value.toLocaleString()} 만원`, "실거래가"];
            }}
            labelFormatter={(label) => `계약일: ${label}`}
            contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
          />
          
          {/* 사용자 호가 선 색상을 연한 장미색(#f43f5e)으로 변경하고 투명도 적용 */}
          <ReferenceLine 
            y={targetPrice} 
            stroke="#f43f5e" 
            strokeDasharray="4 4" 
            strokeOpacity={0.7}
            label={{ 
              position: 'insideTopLeft', 
              value: `내 호가`, 
              fill: '#f43f5e', 
              fontSize: 11, 
              fontWeight: 600,
              dy: -10 
            }} 
          />
          {/* Line 대신 Area를 사용하여 하단 영역을 채움 */}
          <Area 
            type="monotone" 
            dataKey="price" 
            stroke="#3b82f6" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorPrice)" 
            activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }} 
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}