
"use client";

import { QuizClient } from "@/components/quiz-client";
import { SUBJECTS } from "@/lib/constants";
import { notFound, useSearchParams } from "next/navigation";
import { Suspense } from "react";

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

