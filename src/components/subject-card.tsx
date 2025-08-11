"use client";

import type { SerializableSubject } from "@/types";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "./ui/button";
import { ArrowRight } from "lucide-react";
import { SUBJECTS } from "@/lib/constants";

interface SubjectCardProps {
  subject: SerializableSubject;
  iconSlug: string;
}

export function SubjectCard({ subject, iconSlug }: SubjectCardProps) {
  const Icon = SUBJECTS.find(s => s.slug === iconSlug)!.icon;

  return (
    <Link href={`/select-profile?subject=${subject.slug}`} className="group">
      <Card className="h-full flex flex-col transition-all duration-300 ease-in-out group-hover:shadow-xl group-hover:border-primary/50 group-hover:-translate-y-1">
        <CardHeader className="flex-row items-center gap-4 pb-4">
          <div className="p-3 rounded-full bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-xl font-bold font-headline">
              {subject.name}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col justify-between">
          <CardDescription>{subject.description}</CardDescription>
          <div className="mt-4">
            <Button variant="ghost" className="p-0 h-auto text-accent group-hover:text-primary">
              Start Practice <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
