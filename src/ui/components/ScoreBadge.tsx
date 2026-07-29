export function ScoreBadge({ value }: { value: number }) {
  const color =
    value >= 80 ? 'text-emerald-400 bg-emerald-400/10' : value >= 50 ? 'text-amber-400 bg-amber-400/10' : 'text-red-400 bg-red-400/10';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
      AI Score {value}
    </span>
  );
}
