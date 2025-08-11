
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Coins, Home, UserCog, UserPlus } from "lucide-react";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters.").max(50),
  age: z.string().refine((val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0, {
    message: "Please select a valid age.",
  }),
});

const nanoid = () => Math.random().toString(36).substr(2, 9);

export default function ProfileClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subject = searchParams.get('subject');
  const shouldRedirect = searchParams.get('redirect') === 'true';

  const { toast } = useToast();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [testHistory, setTestHistory] = useState<TestResult[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const {
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", age: "" }
  });

  useEffect(() => {
    const storedProfiles = JSON.parse(localStorage.getItem("profiles") || "[]");
    const storedProfileId = localStorage.getItem("currentProfileId");
    
    setProfiles(storedProfiles);
    
    if (storedProfileId) {
      setCurrentProfileId(storedProfileId);
      const currentProfile = storedProfiles.find((p: UserProfile) => p.id === storedProfileId);
      if (currentProfile) {
        reset({ name: currentProfile.name, age: String(currentProfile.age) });
        const storedHistory = JSON.parse(localStorage.getItem(`testHistory_${currentProfile.id}`) || '[]');
        setTestHistory(storedHistory);
        setIsEditing(true);
      } else {
        setIsEditing(false);
        reset({ name: "", age: "" });
      }
    } else {
      setIsEditing(false);
      reset({ name: "", age: "" });
    }
  }, [reset]);

  const onSubmit = (data: z.infer<typeof profileSchema>) => {
    let updatedProfiles = [...profiles];
    let profileIdToSetAsCurrent;
    let isNewUser = false;

    if (isEditing && currentProfileId) {
      const profileIndex = updatedProfiles.findIndex(p => p.id === currentProfileId);
      if (profileIndex !== -1) {
        updatedProfiles[profileIndex] = { ...updatedProfiles[profileIndex], ...data, age: parseInt(data.age, 10) };
        profileIdToSetAsCurrent = currentProfileId;
        toast({ title: "Profile Updated!", description: "Your information has been saved." });
      }
    } else {
      isNewUser = true;
      const newProfile: UserProfile = {
        id: nanoid(),
        name: data.name,
        age: parseInt(data.age, 10),
      };
      updatedProfiles.push(newProfile);
      profileIdToSetAsCurrent = newProfile.id;
      toast({ title: "Profile Created!", description: "Welcome! Your profile is ready." });
    }

    localStorage.setItem("profiles", JSON.stringify(updatedProfiles));
    if (profileIdToSetAsCurrent) {
        localStorage.setItem("currentProfileId", profileIdToSetAsCurrent);
    }
    
    if (shouldRedirect && subject) {
        if (isNewUser || profiles.length === 1) {
            router.push(`/mode-select?subject=${subject}`);
        } else {
            router.push(`/select-profile?subject=${subject}`);
        }
    } else {
      router.push("/");
    }
  };
  
  const handleCreateNew = () => {
    reset({ name: "", age: "" });
    setIsEditing(false);
    setCurrentProfileId(null);
    localStorage.removeItem('currentProfileId');
  }

  const handleDeleteProfile = (id: string) => {
    const updatedProfiles = profiles.filter(p => p.id !== id);
    setProfiles(updatedProfiles);
    localStorage.setItem('profiles', JSON.stringify(updatedProfiles));
    localStorage.removeItem(`testHistory_${id}`);
    
    if (id === currentProfileId) {
        localStorage.removeItem('currentProfileId');
        setCurrentProfileId(null);
        reset({ name: "", age: "" });
        setIsEditing(false);
    }

    toast({
        title: "Profile Deleted",
        description: "The profile has been removed.",
        variant: "destructive"
    })
  }

  const handleSwitchProfile = (id: string) => {
    localStorage.setItem('currentProfileId', id);
    if (shouldRedirect && subject) {
        router.push(`/mode-select?subject=${subject}`);
    } else {
        router.push('/');
    }
  }

  const currentProfile = profiles.find(p => p.id === currentProfileId);
  const totalCoins = testHistory.reduce((sum, result) => sum + result.coinsEarned, 0);

  return (
    <div className="w-full max-w-4xl space-y-8 p-4">
        <Card className="shadow-lg">
            <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                    <div className="p-4 rounded-full bg-primary/10 text-primary">
                        <UserCog className="h-10 w-10" />
                    </div>
                </div>
                <CardTitle className="text-3xl font-extrabold font-headline text-primary">
                    {isEditing && currentProfile ? `Editing ${currentProfile.name}'s Profile` : "Create New Profile"}
                </CardTitle>
                <CardDescription className="text-lg">
                    {isEditing && currentProfile ? "Update your information below." : "Please enter the new user's details."}
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
                                render={({ field }) => <Input id="name" placeholder="Enter user's name" {...field} />}
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
                                        <SelectValue placeholder="Select user's age" />
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
                <CardFooter className="flex flex-col sm:flex-row justify-between gap-2 border-t pt-6">
                   <div className="flex gap-2">
                     <Button type="submit" disabled={isSubmitting}>
                         {isSubmitting ? "Saving..." : (isEditing ? "Save Changes" : "Create Profile")}
                     </Button>
                     <Button variant="outline" type="button" onClick={() => router.push('/')}>
                         <Home className="mr-2 h-4 w-4" /> Go to Homepage
                     </Button>
                   </div>
                   <Button variant="secondary" type="button" onClick={handleCreateNew}>
                        <UserPlus className="mr-2 h-4 w-4" /> Create New Profile
                    </Button>
                </CardFooter>
            </form>
        </Card>

        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>All Profiles</CardTitle>
                <CardDescription>Manage and switch between user profiles.</CardDescription>
            </CardHeader>
            <CardContent>
                {profiles.length > 0 ? (
                    <ul className="space-y-2">
                        {profiles.map(profile => (
                            <li key={profile.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                                <div>
                                    <p className="font-bold">{profile.name} <span className="text-sm font-normal text-muted-foreground">(Age: {profile.age})</span></p>
                                    {profile.id === currentProfileId && <span className="text-xs text-primary font-semibold">(Current)</span>}
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => handleSwitchProfile(profile.id)} disabled={profile.id === currentProfileId}>Switch To</Button>
                                    <Button size="sm" variant="destructive" onClick={() => handleDeleteProfile(profile.id)}>Delete</Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-muted-foreground">No profiles created yet.</p>
                )}
            </CardContent>
        </Card>

        {isEditing && currentProfile && (
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row justify-between items-center">
                    <div>
                        <CardTitle>Test History for {currentProfile.name}</CardTitle>
                        <CardDescription>Here are the results from previous test sessions.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-300">
                        <Coins className="h-6 w-6"/>
                        <span className="font-bold text-xl">{totalCoins}</span>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Subject</TableHead>
                                <TableHead>Level</TableHead>
                                <TableHead>Score</TableHead>
                                <TableHead>Coins</TableHead>
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
                                        <TableCell className="font-bold text-yellow-500">{result.coinsEarned}</TableCell>
                                    </TableRow>
                                ))
                           ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                    No tests completed yet for this profile.
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
