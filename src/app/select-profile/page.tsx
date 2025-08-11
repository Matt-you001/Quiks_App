
"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { UserProfile } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

export default function SelectProfileClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    const subject = searchParams.get('subject');

    useEffect(() => {
        if (!subject) {
            router.push('/');
            return;
        }

        const storedProfiles = JSON.parse(localStorage.getItem('profiles') || '[]');
        setProfiles(storedProfiles);
        setLoading(false);

        if (storedProfiles.length === 0) {
            router.push(`/profile?subject=${subject}&redirect=true`);
        }
    }, [router, subject]);

    const handleProfileSelect = (id: string) => {
        localStorage.setItem('currentProfileId', id);
        router.push(`/mode-select?subject=${subject}`);
    }

    const handleCreateNew = () => {
        localStorage.removeItem('currentProfileId');
        router.push(`/profile?subject=${subject}&redirect=true`);
    }

    if (loading) {
        return (
            <div className="w-full max-w-md space-y-4">
                <Skeleton className="h-12 w-3/4 mx-auto" />
                <Skeleton className="h-8 w-1/2 mx-auto" />
                <div className="space-y-3 pt-6">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-12 w-full mt-4" />
                </div>
            </div>
        )
    }

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
                            onClick={() => handleProfileSelect(profile.id)}
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
                    <Button variant="outline" className="w-full" onClick={handleCreateNew}>
                        <UserPlus className="mr-2 h-4 w-4" /> Create New Profile
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
