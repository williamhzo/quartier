import { Skeleton } from "@/components/ui/skeleton";

export default function DetailLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Skeleton className="h-5 w-28" />
      <div className="mt-4 flex items-baseline gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-5 w-14" />
      </div>
      <div className="mt-6">
        <Skeleton className="h-[200px] w-full rounded-lg" />
      </div>
      <div className="mt-6">
        <Skeleton className="mb-2 h-4 w-28" />
        <Skeleton className="h-[250px] w-full rounded-lg" />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <Skeleton className="mb-4 h-5 w-24" />
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
