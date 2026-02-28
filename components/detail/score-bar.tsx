import { cn } from "@/lib/utils";

type Props = {
  score: number | null;
  label: string;
  median?: number | null;
  className?: string;
};

export function ScoreBar({ score, label, median, className }: Props) {
  const isNull = score == null;
  const rounded = isNull ? 0 : Math.round(score);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className={cn(isNull && "text-muted-foreground")}>{label}</span>
        <span
          className={cn(
            "font-medium tabular-nums",
            isNull && "text-muted-foreground",
          )}
        >
          {isNull ? "-" : rounded}
        </span>
      </div>
      <div className="bg-secondary relative h-2 overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            isNull ? "bg-muted" : "bg-primary",
          )}
          style={{ width: isNull ? "100%" : `${rounded}%` }}
        />
        {median != null && (
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground/25"
            style={{ left: `${Math.round(median)}%` }}
          />
        )}
      </div>
    </div>
  );
}
