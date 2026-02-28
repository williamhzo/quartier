import { Skeleton } from "@/components/ui/skeleton";

export default function DetailLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Skeleton className="h-5 w-28" />
      <div className="mt-4 flex items-center gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-5 w-14" />
      </div>
      <div className="mt-6">
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
      <div className="mt-6">
        <Skeleton className="mb-2 h-4 w-28" />
        <Skeleton className="mx-auto h-[280px] w-full max-w-md rounded-lg" />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <Skeleton className="mb-4 h-5 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <div className="mt-3 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
