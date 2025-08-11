
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dumbbell, Brain, ArrowRight } from "lucide-react";
import { SUBJECTS } from "@/lib/constants";
import { notFound } from "next/navigation";
import { Suspense } from "react";

function ModeSelectClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const subjectSlug = searchParams.get('subject');

    const subject = SUBJECTS.find(s => s.slug === subjectSlug);

    if (!subject) {
        notFound();
    }

    const handleModeSelect = (mode: 'training' | 'quiz') => {
        router.push(`/test/${subjectSlug}?mode=${mode}`);
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-3xl font-extrabold font-headline text-primary">Choose Your Mode</CardTitle>
                    <CardDescription className="text-lg">How would you like to practice {subject.name}?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button
                        onClick={() => handleModeSelect('training')}
                        className="w-full h-24 text-lg justify-start p-6 bg-blue-500 hover:bg-blue-600 text-white shadow-lg"
                        variant="default"
                    >
                        <Dumbbell className="h-8 w-8 mr-4" />
                        <div>
                            <p className="font-bold text-left">Training</p>
                            <p className="font-normal text-sm text-left">Learn at your own pace.</p>
                        </div>
                        <ArrowRight className="ml-auto h-6 w-6" />
                    </Button>
                    <Button
                        onClick={() => handleModeSelect('quiz')}
                        className="w-full h-24 text-lg justify-start p-6 bg-purple-500 hover:bg-purple-600 text-white shadow-lg"
                        variant="default"
                    >
                        <Brain className="h-8 w-8 mr-4" />
                        <div>
                            <p className="font-bold text-left">Quiz</p>
                            <p className="font-normal text-sm text-left">Test your knowledge under pressure.</p>
                        </div>
                        <ArrowRight className="ml-auto h-6 w-6" />
                    </Button>
                </CardContent>
            </Card>
        </main>
    )
}

export default function ModeSelectPage() {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <ModeSelectClient />
      </Suspense>
    );
}
