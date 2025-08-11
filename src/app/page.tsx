"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SubjectCard } from "@/components/subject-card";
import { SUBJECTS } from "@/lib/constants";
import { Skeleton } from '@/components/ui/skeleton';

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    const profile = localStorage.getItem('userProfile');
    if (!profile) {
      router.push('/profile');
    }
  }, [router]);

  // Prevent flash of content before redirect
  if (typeof window !== 'undefined' && !localStorage.getItem('userProfile')) {
    return (
       <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-12 lg:p-24">
        <div className="text-center mb-12">
          <Skeleton className="h-12 w-80 mx-auto" />
          <Skeleton className="h-6 w-96 mx-auto mt-4" />
        </div>
         <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
         </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-12 lg:p-24">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-extrabold tracking-tight text-primary font-headline">
          Synapse Trainer
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Train your brain to think faster and smarter. Choose a subject to begin.
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
