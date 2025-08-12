"use client";

import { SubjectCard } from "@/components/subject-card";
import { SUBJECTS } from "@/lib/constants";
import { Logo } from "@/components/logo";

export default function Home() {

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-12 lg:p-24">
      <div className="text-center mb-8 flex flex-col items-center">
        <Logo />
        <h1 className="text-5xl font-extrabold tracking-tight text-primary font-headline mt-2">
          Quiks
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Welcome! Choose a subject to begin your training.
        </p>
      </div>
      <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {SUBJECTS.map((subject) => {
          const { icon, ...serializableSubject } = subject;
          return <SubjectCard key={subject.slug} subject={serializableSubject} iconSlug={subject.slug} />;
        })}
      </div>
    </main>
  );
}
