type Props = {
  x: number;
  y: number;
  name: string;
  score: number | null;
  dimensionLabel: string;
};

export function MapTooltip({ x, y, name, score, dimensionLabel }: Props) {
  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{ left: x + 12, top: y - 12 }}
    >
      <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 shadow-md">
        <p className="text-sm font-medium">{name}</p>
        {score != null && (
          <p className="text-muted-foreground text-xs">
            {dimensionLabel}: {Math.round(score)}
          </p>
        )}
      </div>
    </div>
  );
}
