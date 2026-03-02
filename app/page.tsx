import RegionSelector from "@/components/RegionSelector";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-extrabold text-center text-gray-900 mb-8">
          부동산 AI 적정가 분석기
        </h1>
        
        {/* 방금 만든 드릴다운 컴포넌트 불러오기 */}
        <RegionSelector />
        
      </div>
    </main>
  );
}