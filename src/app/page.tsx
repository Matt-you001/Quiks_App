"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SubjectCard } from "@/components/subject-card";
import { SUBJECTS } from "@/lib/constants";
import { Skeleton } from '@/components/ui/skeleton';
import type { UserProfile } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

function ProfileSelector({ profiles, onProfileSelect, onCreateNew }: { profiles: UserProfile[], onProfileSelect: (id: string) => void, onCreateNew: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-extrabold text-center font-headline text-primary">Select Profile</CardTitle>
          <CardDescription className="text-center text-lg">Who is playing today?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {profiles.map(profile => (
            <button
              key={profile.id}
              onClick={() => onProfileSelect(profile.id)}
              className="w-full flex items-center p-4 rounded-lg border hover:bg-accent/50 transition-colors"
            >
              <Avatar className="h-10 w-10 mr-4">
                <AvatarFallback>{profile.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-lg font-medium">{profile.name}</span>
            </button>
          ))}
        </CardContent>
        <CardFooter className="border-t pt-6">
          <Button variant="outline" className="w-full" onClick={onCreateNew}>
            <UserPlus className="mr-2 h-4 w-4" /> Create New Profile
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}


export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const storedProfiles = JSON.parse(localStorage.getItem('profiles') || '[]');
    const currentProfileId = localStorage.getItem('currentProfileId');
    setProfiles(storedProfiles);

    if (storedProfiles.length === 0) {
      router.push('/profile');
    } else if (currentProfileId) {
      const profile = storedProfiles.find((p: UserProfile) => p.id === currentProfileId);
      setCurrentProfile(profile || null);
      setLoading(false);
    } else {
      // No current profile selected, stay on profile selection
      setLoading(false);
    }
  }, [router]);
  
  const handleProfileSelect = (id: string) => {
    localStorage.setItem('currentProfileId', id);
    const profile = profiles.find(p => p.id === id);
    setCurrentProfile(profile || null);
  }
  
  const handleCreateNew = () => {
    // Clear current profile to signal creation of a new one
    localStorage.removeItem('currentProfileId');
    router.push('/profile');
  }

  if (loading) {
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

  if (!currentProfile) {
    return <ProfileSelector profiles={profiles} onProfileSelect={handleProfileSelect} onCreateNew={handleCreateNew} />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-12 lg:p-24">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-extrabold tracking-tight text-primary font-headline">
          Synapse Trainer
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Welcome back, {currentProfile.name}! Choose a subject to begin.
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
