import ResultsClient from "@/components/results-client";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function ResultsSkeleton() {
    return (
        <div className="w-full max-w-md space-y-4">
            <Skeleton className="h-12 w-3/4 mx-auto" />
            <Skeleton className="h-8 w-1/2 mx-auto" />
            <div className="space-y-6 pt-6">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        </div>
    )
}

export default function ResultsPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <Suspense fallback={<ResultsSkeleton />}>
        <ResultsClient />
      </Suspense>
    </main>
  );
}
