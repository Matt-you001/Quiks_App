
"use client";

import { QuizClient } from "@/components/quiz-client";
import { SUBJECTS } from "@/lib/constants";
import { notFound, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import Link from "next/link";

interface TestPageProps {
  params: {
    subject: string;
  };
}

function TestClient({ params }: TestPageProps) {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');

  const subject = SUBJECTS.find((s) => s.slug === params.subject);

  if (!subject || (mode !== 'quiz' && mode !== 'training')) {
    notFound();
  }
  
  const { icon, ...serializableSubject } = subject;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="absolute top-4 left-4">
        <Button asChild variant="ghost" size="icon">
            <Link href="/">
                <Home className="h-6 w-6" />
                <span className="sr-only">Home</span>
            </Link>
        </Button>
      </div>
      <QuizClient subject={serializableSubject} mode={mode as 'quiz' | 'training'} />
    </main>
  );
}


export default function TestPage({ params }: TestPageProps) {
  return (
    <Suspense fallback={<div>Loading test...</div>}>
      <TestClient params={params} />
    </Suspense>
  );
}
