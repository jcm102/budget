'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { Loader2 } from 'lucide-react';

const GoogleIcon = () => (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.802 8.94C34.332 4.918 29.333 2.5 24 2.5C11.853 2.5 2.5 11.853 2.5 24s9.353 21.5 21.5 21.5c11.948 0 21.02-9.22 21.495-20.917l.116-1.5z" />
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12.5 24 12.5c3.059 0 5.842 1.154 7.961 3.039l5.841-5.841C34.332 4.918 29.333 2.5 24 2.5C16.318 2.5 9.5 6.963 6.306 14.691z" />
        <path fill="#4CAF50" d="M24 45.5c5.333 0 10.332-2.418 14.802-6.44l-5.841-5.841C30.842 35.846 27.059 37.5 24 37.5c-5.223 0-9.65-3.657-11.303-8H6.389c3.194 7.727 10.482 13.5 17.611 13.5z" />
        <path fill="#1976D2" d="M43.611 20.083H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.841 5.841C40.526 35.396 45.5 28.986 45.5 20c0-1.587-.19-3.13-.545-4.592l-.116 1.5z" />
    </svg>
);


export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignIn = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/tasks');
    } catch (error: any) {
       toast({
        title: 'Authentication Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-secondary">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Sign in with your Google account to access the application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={handleSignIn} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
            Sign In with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
