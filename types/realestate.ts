// types/realestate.ts
export interface RealEstateTransaction {
  aptNm: string;
  excluUseAr: number;
  floor: number;
  dealYear: number;
  dealMonth: number;
  dealDay: number;
  dealAmount: string;
  umdNm: string;
}

export interface ProcessedTransaction {
  아파트명: string;
  전용면적: number;
  층: number;
  거래일: string;
  거래금액_만원: number;
}

// 신규 추가: AI 리포트 구조화 타입
export interface AiReport {
  evaluation: string;
  trend: string;
  newsSummary: string;
  actionPlan: string;
}