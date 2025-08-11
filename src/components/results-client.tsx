
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Award, Coins, Home, Repeat, Timer, Trophy } from "lucide-react";
import { Progress } from "./ui/progress";
import { generateFeedback, textToSpeech } from "@/ai/flows";
import { useEffect, useRef, useState } from "react";
import type { TestResult } from "@/types";

export default function ResultsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const score = searchParams.get("score") || "0";
  const time = searchParams.get("time") || "0";
  const coins = searchParams.get("coins") || "0";
  const subject = searchParams.get("subject") || "Unknown Subject";
  const level = searchParams.get("level") || "1";
  const difficulty = searchParams.get("difficulty") || "Beginner";
  const grade = searchParams.get("grade") || "Not specified";

  const scoreValue = parseInt(score, 10);
  
  const [feedback, setFeedback] = useState("");
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasSavedResult = useRef(false);

  useEffect(() => {
    if (hasSavedResult.current) return;
    
    const newResult: TestResult = {
        date: new Date().toISOString(),
        subject,
        level: parseInt(level),
        difficulty,
        grade,
        score: scoreValue,
        timeTaken: parseInt(time),
        coinsEarned: parseInt(coins),
    };

    const existingHistory = JSON.parse(localStorage.getItem('testHistory') || '[]');
    const updatedHistory = [newResult, ...existingHistory];
    localStorage.setItem('testHistory', JSON.stringify(updatedHistory));
    hasSavedResult.current = true;
  }, [scoreValue, subject, grade, level, difficulty, time, coins]);


  useEffect(() => {
    async function getFeedback() {
      setIsGeneratingFeedback(true);
      try {
        const { feedback: feedbackText } = await generateFeedback({
          score: scoreValue,
          subject,
          grade,
        });
        setFeedback(feedbackText);
        const { media } = await textToSpeech(feedbackText);
        if (audioRef.current) {
          audioRef.current.src = media;
          audioRef.current.play().catch(e => console.error("Error playing feedback audio:", e));
        }
      } catch (error) {
        console.error("Failed to generate feedback:", error);
        setFeedback("Great job on completing the level!");
      } finally {
        setIsGeneratingFeedback(false);
      }
    }
    getFeedback();
  }, [scoreValue, subject, grade]);

  return (
    <Card className="w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95">
      <CardHeader className="text-center p-6">
        <div className="flex justify-center mb-4">
          {scoreValue >= 70 ? (
             <Trophy className="h-16 w-16 text-yellow-400" />
          ) : (
            <Award className="h-16 w-16 text-orange-400" />
          )}
        </div>
        <CardTitle className="text-3xl font-extrabold font-headline text-primary">
            {grade} Level {level} Complete!
        </CardTitle>
        <CardDescription className="text-lg">
          Here are your results for {subject} ({difficulty})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-6 pb-6">
        <div className="flex flex-col items-center space-y-2">
            <div className="flex items-baseline text-6xl font-bold text-accent">
                {score}
                <span className="text-3xl text-muted-foreground">%</span>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Accuracy</p>
            <Progress value={scoreValue} className="w-3/4 h-3" />
        </div>

        {isGeneratingFeedback ? (
           <div className="p-4 bg-muted rounded-lg text-center">
             <p className="text-sm animate-pulse">Generating feedback...</p>
           </div>
        ) : (
           <div className="p-4 bg-muted rounded-lg text-center">
              <p className="font-semibold text-foreground italic">"{feedback}"</p>
           </div>
        )}
        <audio ref={audioRef} className="hidden" />


        <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex justify-center items-center mb-1 text-primary">
                    <Timer className="h-6 w-6" />
                </div>
                <p className="text-2xl font-semibold">{time}s</p>
                <p className="text-sm text-muted-foreground">Time Taken</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex justify-center items-center mb-1 text-primary">
                    <Coins className="h-6 w-6" />
                </div>
                <p className="text-2xl font-semibold">{coins}</p>
                <p className="text-sm text-muted-foreground">Bonus Coins</p>
            </div>
        </div>
      </CardContent>
      <CardFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-6 bg-muted/50 border-t">
        <Button variant="outline" onClick={() => router.push("/")}>
          <Home className="mr-2 h-4 w-4" />
          Home
        </Button>
        <Button onClick={() => router.back()}>
          <Repeat className="mr-2 h-4 w-4" />
          Play Again
        </Button>
      </CardFooter>
    </Card>
  );
}
