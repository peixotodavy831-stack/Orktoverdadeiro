import React from 'react';
import { SignInPage } from './ui/sign-in-flow-1';
import type { SignUpOutcome } from '../lib/auth-flows';
import { isGooglePilot } from '../lib/google-pilot';
import GooglePilotAuth from './GooglePilotAuth';

interface AuthProps {
  onSignInSuccess: () => void;
  onSignUp: (email: string, password: string, name: string) => Promise<SignUpOutcome>;
  onDemoLogin?: () => Promise<void>;
  onAuthenticate?: (email: string, password: string) => Promise<{ error?: string }>;
  isLoading: boolean;
  initialAuthError?: string | null;
}

export default function Auth({ onSignInSuccess, onSignUp, onDemoLogin, onAuthenticate, isLoading, initialAuthError }: AuthProps) {
  if (isGooglePilot(import.meta.env.VITE_ORKTO_AUTH_MODE)) return <GooglePilotAuth initialError={initialAuthError} />;
  return <SignInPage onSignInSuccess={onSignInSuccess} onSignUp={onSignUp} onDemoLogin={onDemoLogin} onAuthenticate={onAuthenticate} />;
}
