
"use client";

import type { Question, SerializableSubject, TestMode } from "@/types";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  generateTestQuestions,
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
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight,
  Check,
  CheckCircle,
  ChevronLeft,
  Coins,
  Cpu,
  Library,
  Repeat,
  Timer,
  X,
  XCircle,
} from "lucide-react";
import {
  GRADES,
  QUESTIONS_PER_LEVEL,
  SCORE_THRESHOLD,
  SUBJECTS,
} from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { cn } from "@/lib/utils";


type QuizState = "GRADE_SELECT" | "LOADING" | "ACTIVE" | "REVIEW" | "LEVEL_COMPLETE";

const CALCULATION_SUBJECTS = ['arithmetic', 'physics', 'chemistry', 'sciences', 'computer', 'electricity', 'economics'];

// Fisher-Yates (aka Knuth) Shuffle algorithm
const shuffleArray = (array: any[]) => {
    let currentIndex = array.length, randomIndex;
    
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    
    return array;
}

export function QuizClient({ subject, mode }: { subject: SerializableSubject, mode: TestMode }) {
  const [quizState, setQuizState] = useState<QuizState>("GRADE_SELECT");
  const [level, setLevel] = useState(1);
  const [difficulty, setDifficulty] = useState("Beginner");
  const [grade, setGrade] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(string | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [levelResult, setLevelResult] = useState<{ score: number } | null>(null);
  const [totalTimeForLevel, setTotalTimeForLevel] = useState(0);

  const router = useRouter();
  const { toast } = useToast();
  const Icon = SUBJECTS.find(s => s.slug === subject.slug)!.icon;
  
  const reviewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (reviewTimeoutRef.current) {
        clearTimeout(reviewTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (quizState !== "ACTIVE") return;

    const timer = setInterval(() => {
        if (mode === 'quiz') {
            if (timeLeft > 0) {
                setTimeLeft((prev) => prev - 1);
            }
        } else if (mode === 'training') {
            setTimeElapsed((prev) => prev + 1);
        }
    }, 1000);

    return () => clearInterval(timer);
  }, [quizState, timeLeft, mode]);

  useEffect(() => {
    if (timeLeft === 0 && quizState === "ACTIVE" && mode === 'quiz') {
      finishLevel(userAnswers);
    }
  }, [timeLeft, quizState, mode, userAnswers]);


  const fetchQuestions = async (currentDifficulty: string, currentLevel: number) => {
    if (!grade) return;
    setQuizState("LOADING");
    try {
      const { questions: generatedQuestions, recommendedTime } = await generateTestQuestions({
        subject: subject.name,
        difficultyLevel: currentDifficulty,
        numberOfQuestions: QUESTIONS_PER_LEVEL,
        grade: grade,
      });

      // Shuffle options for each question
      const shuffledQuestions = generatedQuestions.map(q => ({
        ...q,
        options: shuffleArray([...q.options])
      }));

      setQuestions(shuffledQuestions);
      setUserAnswers(Array(shuffledQuestions.length).fill(null));

      let time = 0;
      if (mode === 'quiz') {
        const baseTime = Math.floor(recommendedTime * 0.81);
        const levelBonus = (currentLevel - 1) * (CALCULATION_SUBJECTS.includes(subject.slug) ? 10 : 5);
        time = baseTime + levelBonus;
      }

      setTotalTimeForLevel(time);
      setTimeLeft(time);
      setTimeElapsed(0);
      setQuizState("ACTIVE");
      setCurrentQuestionIndex(0);
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
  
  const handleGradeSelected = () => {
    if (grade) {
      fetchQuestions(difficulty, level);
    }
  }

  const handleAnswerSelect = (answer: string) => {
    if (quizState !== 'ACTIVE') return;

    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setUserAnswers(newAnswers);
    setQuizState("REVIEW");
    
    const timeoutDuration = mode === 'quiz' ? 2000 : 0;

    if (mode === 'quiz') {
      reviewTimeoutRef.current = setTimeout(() => {
        handleNextQuestion(newAnswers);
      }, timeoutDuration);
    }
  };

  const finishLevel = (finalAnswers: (string | null)[]) => {
    let correctAnswers = 0;
    questions.forEach((q, i) => {
      if (finalAnswers[i] === q.correctAnswer) {
        correctAnswers++;
      }
    });
    const score = Math.round((correctAnswers / questions.length) * 100);
    setLevelResult({ score });
    setQuizState("LEVEL_COMPLETE");
  };

  const handleNextQuestion = (currentAnswers: (string | null)[]) => {
    if (reviewTimeoutRef.current) {
        clearTimeout(reviewTimeoutRef.current);
    }
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setQuizState("ACTIVE");
    } else {
      finishLevel(currentAnswers);
    }
  };

  const getNextDifficulty = (currentDifficulty: string): string => {
    const difficulties = ["Beginner", "Intermediate", "Advanced", "Expert"];
    const currentIndex = difficulties.indexOf(currentDifficulty);
    if (currentIndex < difficulties.length - 1) {
        return difficulties[currentIndex + 1];
    }
    return "Expert"; // Stay at expert
  }

  const handleProceedToNextLevel = () => {
    if (!levelResult) return;
    const newDifficulty = getNextDifficulty(difficulty);
    const newLevel = level + 1;
    setLevel(newLevel);
    setDifficulty(newDifficulty);
    fetchQuestions(newDifficulty, newLevel);
    setLevelResult(null);
  };
  
  const handleRepeatLevel = () => {
    fetchQuestions(difficulty, level);
    setLevelResult(null);
  };

  const handleEndSession = () => {
    if (!levelResult) return;
    const timeTaken = mode === 'quiz' ? totalTimeForLevel - timeLeft : timeElapsed;
    let coins = 0;

    const currentProfileId = localStorage.getItem('currentProfileId');
    if (!currentProfileId) return;

    const historyKey = `testHistory_${currentProfileId}`;
    const existingHistory = JSON.parse(localStorage.getItem(historyKey) || '[]') as any[];
    
    const hasPerfectedLevelBefore = existingHistory.some(
        (result: any) =>
          result.subject === subject.name &&
          result.level === level &&
          result.difficulty === difficulty &&
          result.grade === grade &&
          result.score === 100
    );

    if(levelResult.score === 100 && timeLeft > 0 && !hasPerfectedLevelBefore && mode === 'quiz') {
        coins = Math.floor(timeLeft * 0.05);
    }
    router.push(
      `/results?score=${Math.round(levelResult.score)}&time=${timeTaken}&coins=${coins}&subject=${subject.name}&level=${level}&difficulty=${difficulty}&grade=${grade}`
    );
  };

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  if (quizState === "GRADE_SELECT") {
    return (
      <Card className="w-full max-w-2xl text-center shadow-lg">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-primary/10 text-primary">
              <Icon className="h-10 w-10" />
            </div>
          </div>
          <CardTitle className="text-3xl font-extrabold font-headline text-primary">{subject.name} {mode === 'quiz' ? 'Quiz' : 'Training'}</CardTitle>
          <CardDescription className="text-lg">Please select your grade level to begin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select onValueChange={setGrade} value={grade}>
            <SelectTrigger className="w-full text-lg py-6">
              <SelectValue placeholder="Select Grade" />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" className="max-h-60">
              {GRADES.map((g) => (
                <SelectItem key={g} value={g} className="text-lg">{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
        <CardFooter>
          <Button className="w-full text-lg py-6" onClick={handleGradeSelected} disabled={!grade}>
            Confirm Grade
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (quizState === "LOADING") {
    return (
      <Card className="w-full max-w-2xl text-center">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Loading Questions...</CardTitle>
          <CardDescription>The AI is preparing your questions for {grade}!</CardDescription>
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

  
  if ((quizState === "ACTIVE" || quizState === "REVIEW") && currentQuestion) {
    const isReviewing = quizState === "REVIEW";
    const userAnswer = userAnswers[currentQuestionIndex];
    const correctAnswer = currentQuestion.correctAnswer;
    const isAnswerCorrect = userAnswer === correctAnswer;
    
    return (
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader>
          <div className="flex justify-between items-center mb-2">
            <CardTitle className="text-xl font-bold font-headline">{subject.name} - {grade} - Level {level}</CardTitle>
            <div className="flex items-center gap-2 text-lg font-semibold text-destructive">
                <Timer className="h-6 w-6" />
                {mode === 'quiz' ? <span>{timeLeft}s</span> : <span>{timeElapsed}s</span>}
            </div>
          </div>
          <CardDescription>Question {currentQuestionIndex + 1} of {questions.length}</CardDescription>
          <Progress value={progress} className="w-full mt-2" />
        </CardHeader>
        <CardContent>
            <div className="text-lg font-medium mb-4 text-center min-h-[6rem] flex items-center justify-center">
                <p>{currentQuestion.question}</p>
            </div>

            {isReviewing && (
                 <div className={cn(
                    "flex items-center justify-center gap-2 mb-4 p-2 rounded-md text-white",
                    isAnswerCorrect ? "bg-green-500" : "bg-red-500"
                 )}>
                    {isAnswerCorrect ? <CheckCircle className="h-5 w-5"/> : <XCircle className="h-5 w-5"/>}
                    <span className="font-semibold text-sm">{isAnswerCorrect ? "Correct!" : "Incorrect!"}</span>
                 </div>
            )}

            <RadioGroup onValueChange={handleAnswerSelect} value={userAnswer || ""} disabled={isReviewing}>
                <div className="space-y-3">
                {currentQuestion.options.map((option, index) => {
                    const isThisOptionCorrect = option === correctAnswer;
                    const isThisOptionSelected = option === userAnswer;
                    
                    let optionStyle = "";
                    if (isReviewing && isThisOptionCorrect) {
                        optionStyle = "bg-green-100 border-green-500 text-green-800 dark:bg-green-900/50 dark:border-green-700 dark:text-green-300";
                    } else if (isReviewing && isThisOptionSelected && !isAnswerCorrect) {
                        optionStyle = "bg-red-100 border-red-500 text-red-800 dark:bg-red-900/50 dark:border-red-700 dark:text-red-300";
                    }
                    
                    return (
                        <Label key={index} htmlFor={`option-${index}`} className={cn(
                            "flex items-center p-4 rounded-lg border transition-all",
                            optionStyle,
                            isReviewing ? "cursor-default" : "cursor-pointer hover:bg-accent/50 has-[:checked]:bg-accent/20 has-[:checked]:border-accent"
                        )}>
                        <RadioGroupItem value={option} id={`option-${index}`} className="h-5 w-5 mr-4" disabled={isReviewing} />
                        <span className="flex-grow">{option}</span>
                        {isReviewing && isThisOptionCorrect && <Check className="h-6 w-6 text-green-600" />}
                        {isReviewing && isThisOptionSelected && !isAnswerCorrect && <X className="h-6 w-6 text-red-600" />}
                        </Label>
                    );
                })}
                </div>
            </RadioGroup>
        </CardContent>
        {mode === 'training' && isReviewing && (
           <CardFooter>
             <Button className="w-full" onClick={() => handleNextQuestion(userAnswers)}>
               Next Question <ArrowRight className="ml-2 h-4 w-4" />
             </Button>
           </CardFooter>
        )}
      </Card>
    );
  }

  return (
    <>
      <AlertDialog open={quizState === "LEVEL_COMPLETE"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-xl font-bold">
               {levelResult ? `${grade} - Level ${level} Complete!` : "Calculating Results..."}
            </AlertDialogTitle>
          </AlertDialogHeader>
          {levelResult ? (
            <>
              <div className="py-4 text-center">
                  <div className="flex items-center justify-center mb-4">
                      {levelResult.score >= SCORE_THRESHOLD ? (
                          <CheckCircle className="h-16 w-16 text-green-500" />
                      ) : (
                          <XCircle className="h-16 w-16 text-destructive" />
                      )}
                  </div>
                   {levelResult.score === 100 && timeLeft > 0 && mode === 'quiz' && (
                      <div className="p-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg mb-4 text-center">
                          <p className="font-semibold text-sm text-yellow-600 dark:text-yellow-400 flex items-center justify-center gap-2">
                            <Coins className="h-5 w-5"/> Congratulations! You earned {Math.floor(timeLeft * 0.05)} bonus coins for finishing early!
                          </p>
                      </div>
                  )}
                  <div className="p-4 bg-muted rounded-lg">
                      <p className="font-semibold text-sm text-foreground">
                        {levelResult.score >= SCORE_THRESHOLD 
                            ? `Congratulations, You scored ${Math.round(levelResult.score)}% and can now proceed to the next level.` 
                            : `Well done, you made a great effort, but your score of ${Math.round(levelResult.score)}% fell short of the requirement to proceed to the next level. Keep trying to gain perfection.`
                        }
                      </p>
                  </div>
              </div>
              <AlertDialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <Button 
                   variant="outline" 
                   onClick={handleEndSession}
                   className="font-bold py-6 text-base shadow-md hover:shadow-lg transition-shadow border-2 border-gray-300 dark:border-gray-600 flex-1"
                 >
                   End Session
                 </Button>
                {levelResult.score >= SCORE_THRESHOLD ? (
                   <>
                    <Button 
                       variant="secondary"
                       onClick={() => router.push('/')}
                       className="font-bold py-6 text-base shadow-md hover:shadow-lg transition-shadow border-2 border-gray-300 dark:border-gray-600 flex-1"
                    >
                       <Library className="mr-2 h-4 w-4" /> Change Subject
                    </Button>
                     <Button 
                       onClick={handleRepeatLevel}
                       className="font-bold py-6 text-base text-white bg-yellow-500 hover:bg-yellow-600 shadow-[0_4px_0_0_#ca8a04] hover:shadow-[0_4px_0_0_#a16207] active:translate-y-1 active:shadow-none transition-all flex-1"
                     >
                       Repeat Level <Repeat className="ml-2 h-4 w-4" />
                     </Button>
                     <Button 
                       onClick={handleProceedToNextLevel} 
                       disabled={difficulty === 'Expert'}
                       className="sm:col-span-2 font-bold py-6 text-base text-white bg-green-500 hover:bg-green-600 shadow-[0_4px_0_0_#16a34a] hover:shadow-[0_4px_0_0_#15803d] active:translate-y-1 active:shadow-none transition-all"
                     >
                       Next Level: {getNextDifficulty(difficulty)} <ArrowRight className="ml-2 h-4 w-4" />
                     </Button>
                   </>
                ) : (
                  <>
                    <Button 
                      variant="secondary"
                      onClick={() => router.push('/')}
                      className="font-bold py-6 text-base shadow-md hover:shadow-lg transition-shadow border-2 border-gray-300 dark:border-gray-600 flex-1"
                    >
                        <Library className="mr-2 h-4 w-4" /> Change Subject
                    </Button>
                    <Button 
                      onClick={handleRepeatLevel}
                      className="sm:col-span-2 font-bold py-6 text-base text-white bg-blue-500 hover:bg-blue-600 shadow-[0_4px_0_0_#2563eb] hover:shadow-[0_4px_0_0_#1d4ed8] active:translate-y-1 active:shadow-none transition-all"
                    >
                        Try Again <Repeat className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                )}
              </AlertDialogFooter>
            </>
          ) : (
             <AlertDialogDescription className="text-center text-lg">
                Please wait...
             </AlertDialogDescription>
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
