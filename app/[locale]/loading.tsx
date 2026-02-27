import { Skeleton } from "@/components/ui/skeleton";

export default function MapLoading() {
  return (
    <div className="relative h-[calc(100vh-3.5rem)]">
      <div className="absolute top-3 left-3 z-10 flex gap-2">
        <Skeleton className="h-9 w-40 rounded-md" />
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>
      <Skeleton className="h-full w-full rounded-none" />
    </div>
  );
}
