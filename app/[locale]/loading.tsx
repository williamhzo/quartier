import { Skeleton } from "@/components/ui/skeleton";

export default function MapLoading() {
  return (
    <div className="relative h-[calc(100dvh-3.5rem)] bg-muted/50">
      <div className="absolute top-3 left-3 z-10 flex gap-2">
        <Skeleton className="h-9 w-40 rounded-md" />
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>
      <div className="absolute right-3 bottom-3 z-10 w-48 rounded-lg border bg-white/80 p-3">
        <Skeleton className="mb-2 h-3 w-20" />
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-2 w-6" />
            <Skeleton className="h-2 w-6" />
          </div>
        </div>
      </div>
    </div>
  );
}
