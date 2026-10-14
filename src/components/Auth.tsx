import React from 'react';
import { SignInPage } from './ui/sign-in-flow-1';
import type { SignUpOutcome } from '../lib/auth-flows';

interface AuthProps {
  onSignInSuccess: () => void;
  onSignUp: (email: string, password: string, name: string) => Promise<SignUpOutcome>;
  onDemoLogin?: () => Promise<void>;
  onAuthenticate?: (email: string, password: string) => Promise<{ error?: string }>;
  isLoading: boolean;
}

export default function Auth({ onSignInSuccess, onSignUp, onDemoLogin, onAuthenticate, isLoading }: AuthProps) {
  return <SignInPage onSignInSuccess={onSignInSuccess} onSignUp={onSignUp} onDemoLogin={onDemoLogin} onAuthenticate={onAuthenticate} />;
}
