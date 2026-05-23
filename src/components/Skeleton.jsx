export default function Skeleton({ rows = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}
