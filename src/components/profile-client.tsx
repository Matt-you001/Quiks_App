"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table"
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { UserProfile, TestResult } from "@/types";
import { Home, UserCog } from "lucide-react";


const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  age: z.string().refine((val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0, {
    message: "Please select a valid age.",
  }),
});

export default function ProfileClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [testHistory, setTestHistory] = useState<TestResult[]>([]);

  const {
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
        name: "",
        age: "",
    }
  });

  useEffect(() => {
    const storedProfile = localStorage.getItem("userProfile");
    if (storedProfile) {
        const parsedProfile = JSON.parse(storedProfile);
        setProfile(parsedProfile);
        setValue("name", parsedProfile.name);
        setValue("age", String(parsedProfile.age));
    }
    const storedHistory = localStorage.getItem("testHistory");
    if(storedHistory) {
        setTestHistory(JSON.parse(storedHistory));
    }
  }, [setValue]);

  const onSubmit = (data: z.infer<typeof profileSchema>) => {
    const newProfile: UserProfile = {
      name: data.name,
      age: parseInt(data.age, 10),
    };
    localStorage.setItem("userProfile", JSON.stringify(newProfile));
    setProfile(newProfile);
    toast({
      title: "Profile Saved!",
      description: "Your information has been updated.",
    });
    router.push("/");
  };

  return (
    <div className="w-full max-w-4xl space-y-8">
        <Card className="shadow-lg">
            <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                    <div className="p-4 rounded-full bg-primary/10 text-primary">
                        <UserCog className="h-10 w-10" />
                    </div>
                </div>
                <CardTitle className="text-3xl font-extrabold font-headline text-primary">User Profile</CardTitle>
                <CardDescription className="text-lg">
                    {profile ? "Update your information or view your test history." : "Please create your profile to get started."}
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Controller
                            name="name"
                            control={control}
                            render={({ field }) => <Input id="name" placeholder="Enter your name" {...field} />}
                            />
                            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="age">Age</Label>
                            <Controller
                                name="age"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select your age" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Array.from({ length: 100 }, (_, i) => i + 1).map((age) => (
                                        <SelectItem key={age} value={String(age)}>
                                            {age}
                                        </SelectItem>
                                        ))}
                                    </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.age && <p className="text-sm text-destructive">{errors.age.message}</p>}
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row gap-2 border-t pt-6">
                    <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
                        {isSubmitting ? "Saving..." : "Save Profile"}
                    </Button>
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => router.push('/')} type="button">
                        <Home className="mr-2 h-4 w-4" /> Go to Homepage
                    </Button>
                </CardFooter>
            </form>
        </Card>

        {profile && (
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Test History</CardTitle>
                    <CardDescription>Here are the results from your previous test sessions.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Subject</TableHead>
                                <TableHead>Level</TableHead>
                                <TableHead>Score</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                           {testHistory.length > 0 ? (
                                testHistory.map((result, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{new Date(result.date).toLocaleDateString()}</TableCell>
                                        <TableCell>{result.subject}</TableCell>
                                        <TableCell>{result.level} ({result.difficulty})</TableCell>
                                        <TableCell className="font-bold">{result.score}%</TableCell>
                                    </TableRow>
                                ))
                           ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground">
                                    You haven't completed any tests yet.
                                </TableCell>
                            </TableRow>
                           )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        )}
    </div>
  );
}
