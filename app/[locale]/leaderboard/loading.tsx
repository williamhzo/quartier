import { Skeleton } from "@/components/ui/skeleton";

export default function LeaderboardLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-5 w-96" />
      </div>
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-40 rounded-md" />
          <Skeleton className="h-9 w-40 rounded-md" />
        </div>
        <div className="overflow-hidden rounded-lg border">
          <Skeleton className="h-10 w-full rounded-none" />
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-none border-t" />
          ))}
        </div>
      </div>
    </div>
  );
}
