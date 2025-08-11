import { QuizClient } from "@/components/quiz-client";
import { SUBJECTS } from "@/lib/constants";
import { notFound } from "next/navigation";

interface TestPageProps {
  params: {
    subject: string;
  };
  searchParams: {
    mode?: 'quiz' | 'training';
  }
}

export default function TestPage({ params, searchParams }: TestPageProps) {
  const mode = searchParams?.mode;
  const subject = SUBJECTS.find((s) => s.slug === params.subject);

  if (!subject || (mode !== 'quiz' && mode !== 'training')) {
    notFound();
  }

  const { icon, ...serializableSubject } = subject;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <QuizClient subject={serializableSubject} mode={mode} />
    </main>
  );
}
