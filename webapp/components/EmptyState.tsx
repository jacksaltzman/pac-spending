interface EmptyStateProps {
  title?: string;
  message?: string;
}

export default function EmptyState({
  title = "No Data Available",
  message = "Run the pipeline first, then import data: npm run import-data",
}: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="text-4xl mb-4 opacity-30">&#9671;</div>
        <h2
          className="text-xl text-[#111111] mb-2 uppercase tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h2>
        <p className="text-sm text-stone-600 max-w-md mx-auto">
          {message}
        </p>
        <div className="mt-4 bg-white border border-[#C8C1B6]/50 rounded-lg p-3 inline-block">
          <code className="text-xs text-[#FE4F40]">
            cd .. && python scripts/run_all.py<br />
            cd webapp && npm run import-data
          </code>
        </div>
      </div>
    </div>
  );
}
