import { QuizClient } from "@/components/quiz-client";
import { SUBJECTS } from "@/lib/constants";
import { notFound } from "next/navigation";

interface TestPageProps {
  params: {
    subject: string;
  };
}

export default function TestPage({ params }: TestPageProps) {
  const subject = SUBJECTS.find((s) => s.slug === params.subject);

  if (!subject) {
    notFound();
  }
  
  const { icon, ...serializableSubject } = subject;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <QuizClient subject={serializableSubject} />
    </main>
  );
}

export function generateStaticParams() {
  return SUBJECTS.map((subject) => ({
    subject: subject.slug,
  }));
}
