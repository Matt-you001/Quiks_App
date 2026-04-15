
"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams, notFound } from 'next/navigation';
import type { TestResult } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Lock, ArrowRight } from 'lucide-react';
import { SUBJECTS, SCORE_THRESHOLD } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';

function LevelSelectClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [unlockedLevels, setUnlockedLevels] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);

    const subjectSlug = searchParams.get('subject');
    const mode = searchParams.get('mode');

    const subject = SUBJECTS.find(s => s.slug === subjectSlug);

    useEffect(() => {
        if (!subjectSlug || !mode) {
            router.push('/');
            return;
        }

        const currentProfileId = localStorage.getItem('currentProfileId');
        if (!currentProfileId) {
            router.push(`/select-profile?subject=${subjectSlug}`);
            return;
        }
        
        const historyKey = `testHistory_${currentProfileId}`;
        const testHistory: TestResult[] = JSON.parse(localStorage.getItem(historyKey) || '[]');
        
        const subjectHistory = testHistory.filter(result => {
            if (subject?.slug === 'history') {
                return result.subject === subject?.name || result.subject === 'History';
            }
            return result.subject === subject?.name;
        });
        
        let maxUnlockedLevel = 1;
        subjectHistory.forEach(result => {
            if (result.score >= SCORE_THRESHOLD && result.level >= maxUnlockedLevel) {
                maxUnlockedLevel = result.level + 1;
            }
        });

        const levels = Array.from({ length: maxUnlockedLevel }, (_, i) => i + 1);
        setUnlockedLevels(levels);
        setLoading(false);

    }, [router, subjectSlug, mode, subject?.name]);

    const handleLevelSelect = (level: number) => {
        router.push(`/test/${subjectSlug}?mode=${mode}&level=${level}`);
    }
    
    if (!subject) {
        notFound();
    }

    if (loading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <Skeleton className="h-8 w-3/4 mx-auto" />
                        <Skeleton className="h-6 w-1/2 mx-auto mt-2" />
                    </CardHeader>
                    <CardContent className="grid grid-cols-3 gap-4">
                        {Array.from({length: 6}).map((_, i) => (
                             <Skeleton key={i} className="h-24 w-full" />
                        ))}
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-3xl font-extrabold font-headline text-primary">Select Level</CardTitle>
                    <CardDescription className="text-lg">You have unlocked {unlockedLevels.length} levels for {subject.name}.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4">
                    {unlockedLevels.map(level => (
                        <Button
                            key={level}
                            variant="outline"
                            className="h-24 flex-col gap-1 text-lg"
                            onClick={() => handleLevelSelect(level)}
                        >
                            <Star className="h-6 w-6 text-yellow-400" />
                            <span>Level {level}</span>
                        </Button>
                    ))}
                    {unlockedLevels.length < 20 && ( // Show a locked level as a teaser
                         <div className="h-24 flex flex-col gap-1 text-lg items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                            <Lock className="h-6 w-6" />
                            <span>Level {unlockedLevels.length + 1}</span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}


export default function LevelSelectPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LevelSelectClient />
        </Suspense>
    )
}
