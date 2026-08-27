import React from 'react';
import { SignInPage } from './ui/sign-in-flow-1';

interface AuthProps {
  onSignInSuccess: (email?: string, password?: string) => void;
  onSignUp: (email: string, password: string) => Promise<void>;
  onDemoLogin?: () => void;
  isLoading: boolean;
}

export default function Auth({ onSignInSuccess, onSignUp, onDemoLogin, isLoading }: AuthProps) {
  return <SignInPage onSignInSuccess={onSignInSuccess} onSignUp={onSignUp} onDemoLogin={onDemoLogin} />;
}
