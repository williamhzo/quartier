import { Skeleton } from "@/components/ui/skeleton";

export default function LeaderboardLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-5 w-96" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <div className="overflow-hidden rounded-lg border">
          <div className="space-y-0">
            <Skeleton className="h-10 w-full rounded-none" />
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-none border-t" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
