export default function Loading() {
  return (
    <div className="max-w-7xl space-y-6 pb-12" aria-busy="true" aria-label="Loading operational view">
      <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
    </div>
  );
}