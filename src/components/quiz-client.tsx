"use client";

import type { Question, SerializableSubject } from "@/types";
import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateTestQuestions,
  adaptiveDifficultyAdjustment,
} from "@/ai/flows/index";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Coins,
  Cpu,
  Repeat,
  Sparkles,
  Timer,
  XCircle,
} from "lucide-react";
import {
  QUESTIONS_PER_LEVEL,
  SCORE_THRESHOLD,
  SUBJECTS,
  TIME_PER_QUESTION,
} from "@/lib/constants";

type QuizState = "CONFIG" | "LOADING" | "ACTIVE" | "LEVEL_COMPLETE";

export function QuizClient({ subject }: { subject: SerializableSubject }) {
  const [quizState, setQuizState] = useState<QuizState>("CONFIG");
  const [level, setLevel] = useState(1);
  const [difficulty, setDifficulty] = useState("Beginner");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(
    QUESTIONS_PER_LEVEL * TIME_PER_QUESTION
  );
  const [levelResult, setLevelResult] = useState<{
    score: number;
    newDifficulty: string;
    reasoning: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const Icon = SUBJECTS.find(s => s.slug === subject.slug)!.icon;
  
  const totalTimeForLevel = QUESTIONS_PER_LEVEL * TIME_PER_QUESTION;

  useEffect(() => {
    if (quizState !== "ACTIVE" || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [quizState, timeLeft]);

  useEffect(() => {
    if (timeLeft === 0 && quizState === "ACTIVE") {
      finishLevel();
    }
  }, [timeLeft, quizState]);

  const fetchQuestions = async (currentDifficulty: string) => {
    setQuizState("LOADING");
    try {
      const { questions: generatedQuestions } = await generateTestQuestions({
        subject: subject.name,
        difficultyLevel: currentDifficulty,
        numberOfQuestions: QUESTIONS_PER_LEVEL,
      });
      setQuestions(generatedQuestions);
      setQuizState("CONFIG");
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to generate new questions. Please try again.",
        variant: "destructive",
      });
      router.push("/");
    }
  };
  
  useEffect(() => {
    fetchQuestions(difficulty);
  }, []);

  const startLevel = () => {
    setCurrentQuestionIndex(0);
    setUserAnswers(Array(questions.length).fill(null));
    setTimeLeft(totalTimeForLevel);
    setQuizState("ACTIVE");
  };

  const handleAnswerSelect = (answer: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setUserAnswers(newAnswers);
  };

  const finishLevel = () => {
    setQuizState("LEVEL_COMPLETE");
    let correctAnswers = 0;
    questions.forEach((q, i) => {
      if (userAnswers[i] === q.correctAnswer) {
        correctAnswers++;
      }
    });
    const score = (correctAnswers / questions.length) * 100;
    
    startTransition(async () => {
      try {
        const adjustment = await adaptiveDifficultyAdjustment({
          currentScore: score,
          currentDifficulty: difficulty,
          subject: subject.name,
        });
        setLevelResult({ score, ...adjustment });
      } catch (error) {
        console.error(error);
        toast({
            title: "AI Error",
            description: "Could not get difficulty adjustment from AI.",
            variant: "destructive",
        });
        // Fallback logic
        const newDifficulty = score >= SCORE_THRESHOLD ? "next level" : difficulty;
        setLevelResult({ score, newDifficulty, reasoning: "AI adjustment failed, using standard progression." });
      }
    });
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      finishLevel();
    }
  };

  const handleProceed = () => {
    if (!levelResult) return;
    const passed = levelResult.score >= SCORE_THRESHOLD;
    if (passed) {
      setLevel(level + 1);
      setDifficulty(levelResult.newDifficulty);
      fetchQuestions(levelResult.newDifficulty);
    } else {
      fetchQuestions(difficulty);
    }
    setLevelResult(null);
  };

  const handleEndSession = () => {
    if (!levelResult) return;
    const timeTaken = totalTimeForLevel - timeLeft;
    const coins = Math.max(0, timeLeft * 10);
    router.push(
      `/results?score=${Math.round(levelResult.score)}&time=${timeTaken}&coins=${coins}&subject=${subject.name}&level=${level}&difficulty=${difficulty}`
    );
  };

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  if (quizState === "LOADING") {
    return (
      <Card className="w-full max-w-2xl text-center">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Loading Questions...</CardTitle>
          <CardDescription>The AI is preparing your next challenge!</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-10">
            <div className="flex justify-center">
                <Cpu className="h-16 w-16 animate-pulse text-primary" />
            </div>
            <Skeleton className="h-8 w-3/4 mx-auto" />
            <div className="space-y-4 pt-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        </CardContent>
      </Card>
    );
  }

  if (quizState === "CONFIG") {
     return (
        <Card className="w-full max-w-2xl text-center shadow-lg">
          <CardHeader>
            <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-primary/10 text-primary">
                    <Icon className="h-10 w-10" />
                </div>
            </div>
            <CardTitle className="text-3xl font-extrabold font-headline text-primary">{subject.name} Test</CardTitle>
            <CardDescription className="text-lg">Level {level} - {difficulty}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>You have <span className="font-bold text-accent">{totalTimeForLevel} seconds</span> to answer <span className="font-bold text-accent">{QUESTIONS_PER_LEVEL} questions</span>.</p>
            <p>Ready to test your knowledge?</p>
          </CardContent>
          <CardFooter>
            <Button className="w-full text-lg py-6" onClick={startLevel} size="lg">
              Start Level {level}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardFooter>
        </Card>
     );
  }
  
  if (quizState === "ACTIVE" && currentQuestion) {
    return (
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader>
          <div className="flex justify-between items-center mb-2">
            <CardTitle className="text-xl font-bold font-headline">{subject.name} - Level {level}</CardTitle>
            <div className="flex items-center gap-2 text-lg font-semibold text-destructive">
                <Timer className="h-6 w-6" />
                <span>{timeLeft}s</span>
            </div>
          </div>
          <CardDescription>Question {currentQuestionIndex + 1} of {questions.length}</CardDescription>
          <Progress value={progress} className="w-full mt-2" />
        </CardHeader>
        <CardContent>
          <p className="text-lg font-medium mb-6 text-center h-24 flex items-center justify-center">
            {currentQuestion.question}
          </p>
          <RadioGroup onValueChange={handleAnswerSelect} value={userAnswers[currentQuestionIndex]}>
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <Label key={index} htmlFor={`option-${index}`} className="flex items-center p-4 rounded-lg border cursor-pointer has-[:checked]:bg-accent/20 has-[:checked]:border-accent transition-all">
                  <RadioGroupItem value={option} id={`option-${index}`} className="h-5 w-5 mr-4" />
                  <span>{option}</span>
                </Label>
              ))}
            </div>
          </RadioGroup>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleNextQuestion} disabled={!userAnswers[currentQuestionIndex]}>
            {currentQuestionIndex < questions.length - 1 ? "Next Question" : "Finish Level"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <>
      <AlertDialog open={quizState === "LEVEL_COMPLETE"} onOpenChange={(open) => !open && setQuizState("CONFIG")}>
        <AlertDialogContent>
          {isPending || !levelResult ? (
             <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <Sparkles className="h-12 w-12 text-primary animate-pulse" />
                <p className="text-lg font-medium text-muted-foreground">Calculating your results...</p>
             </div>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-center text-3xl font-extrabold font-headline">
                  Level {level} Complete!
                </AlertDialogTitle>
                <AlertDialogDescription className="text-center text-lg">
                  You scored <span className="font-bold text-primary">{Math.round(levelResult.score)}%</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4 text-center">
                  <div className="flex items-center justify-center mb-4">
                      {levelResult.score >= SCORE_THRESHOLD ? (
                          <CheckCircle2 className="h-16 w-16 text-green-500" />
                      ) : (
                          <XCircle className="h-16 w-16 text-destructive" />
                      )}
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                      <p className="font-semibold text-sm text-foreground">
                        <span className="font-bold text-primary">AI Coach:</span> "{levelResult.reasoning}"
                      </p>
                  </div>
              </div>
              <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={handleEndSession}>
                  End Session
                </Button>
                {levelResult.score >= SCORE_THRESHOLD ? (
                   <Button onClick={handleProceed}>
                      Next Level: {levelResult.newDifficulty}
                      <ArrowRight className="ml-2 h-4 w-4" />
                   </Button>
                ) : (
                  <Button onClick={handleProceed}>
                      Try Again
                      <Repeat className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
      
      <Button onClick={() => router.push('/')}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Home
      </Button>
    </>
  );
}
