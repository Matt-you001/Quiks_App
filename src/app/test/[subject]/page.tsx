import { QuizClient } from "@/components/quiz-client";
import { SUBJECTS } from "@/lib/constants";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface TestPageProps {
  params: {
    subject: string;
  };
  searchParams: {
    mode?: 'quiz' | 'training';
    level?: string;
  }
}

function TestPageClient({ params, searchParams }: TestPageProps) {
  const mode = searchParams?.mode;
  const level = searchParams?.level ? parseInt(searchParams.level, 10) : 1;
  const subject = SUBJECTS.find((s) => s.slug === params.subject);

  if (!subject || (mode !== 'quiz' && mode !== 'training')) {
    notFound();
  }

  const { icon, ...serializableSubject } = subject;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <QuizClient subject={serializableSubject} mode={mode} startLevel={level} />
    </main>
  );
}

function TestPageSkeleton() {
    return (
        <div className="w-full max-w-2xl text-center">
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

export default function TestPage(props: TestPageProps) {
    return (
        <Suspense fallback={<TestPageSkeleton />}>
            <TestPageClient {...props} />
        </Suspense>
    )
}
