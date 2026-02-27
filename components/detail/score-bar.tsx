import { cn } from "@/lib/utils";

type Props = {
  score: number;
  label: string;
  className?: string;
};

export function ScoreBar({ score, label, className }: Props) {
  const rounded = Math.round(score);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums font-medium">{rounded}</span>
      </div>
      <div className="bg-secondary h-2 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${rounded}%` }}
        />
      </div>
    </div>
  );
}
