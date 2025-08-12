import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import Link from 'next/link';
import { Home, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';

export const metadata: Metadata = {
  title: 'Quiks',
  description: 'An educational app that helps train students to think fast and smart.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <header className="absolute top-0 right-0 p-4 flex gap-2">
          <Button asChild variant="ghost" size="icon" className="text-primary hover:text-primary/90">
            <Link href="/">
              <Home className="h-6 w-6" />
              <span className="sr-only">Home</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="text-primary hover:text-primary/90">
            <Link href="/profile">
              <Users className="h-6 w-6" />
              <span className="sr-only">Profiles</span>
            </Link>
          </Button>
        </header>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
