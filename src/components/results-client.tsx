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
import { CheckCircle2, Coins, Home, Percent, Repeat, Timer } from "lucide-react";
import { Progress } from "./ui/progress";

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

  return (
    <Card className="w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
        </div>
        <CardTitle className="text-3xl font-extrabold font-headline text-primary">Session Results</CardTitle>
        <CardDescription className="text-lg">
          {subject} - {grade} - Level {level} ({difficulty})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center space-y-2">
            <div className="flex items-baseline text-6xl font-bold text-accent">
                {score}
                <span className="text-3xl text-muted-foreground">%</span>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Accuracy</p>
            <Progress value={scoreValue} className="w-3/4 h-3" />
        </div>

        <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-center items-center mb-1 text-primary">
                    <Timer className="h-6 w-6" />
                </div>
                <p className="text-2xl font-semibold">{time}s</p>
                <p className="text-sm text-muted-foreground">Time Taken</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-center items-center mb-1 text-primary">
                    <Coins className="h-6 w-6" />
                </div>
                <p className="text-2xl font-semibold">{coins}</p>
                <p className="text-sm text-muted-foreground">Bonus Coins</p>
            </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2">
        <Button variant="outline" className="w-full" onClick={() => router.push("/")}>
          <Home className="mr-2 h-4 w-4" />
          Home
        </Button>
        <Button className="w-full" onClick={() => router.back()}>
          <Repeat className="mr-2 h-4 w-4" />
          Play Again
        </Button>
      </CardFooter>
    </Card>
  );
}
