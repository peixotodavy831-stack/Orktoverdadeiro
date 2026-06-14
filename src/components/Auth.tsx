import React from 'react';
import { SignInPage } from './ui/sign-in-flow-1';

interface AuthProps {
  onSignInSuccess: (email?: string) => void;
  isLoading: boolean;
}

export default function Auth({ onSignInSuccess, isLoading }: AuthProps) {
  return <SignInPage onSignInSuccess={onSignInSuccess} />;
}

