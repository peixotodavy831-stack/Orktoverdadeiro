import React from 'react';
import { SignInPage } from './ui/sign-in-flow-1';

interface AuthProps {
  onSignInSuccess: () => void;
  onSignUp: (email: string, password: string, name: string) => Promise<void>;
  onDemoLogin?: () => Promise<void>;
  onAuthenticate?: (email: string, password: string) => Promise<{ error?: string }>;
  isLoading: boolean;
}

export default function Auth({ onSignInSuccess, onSignUp, onDemoLogin, onAuthenticate, isLoading }: AuthProps) {
  return <SignInPage onSignInSuccess={onSignInSuccess} onSignUp={onSignUp} onDemoLogin={onDemoLogin} onAuthenticate={onAuthenticate} />;
}
