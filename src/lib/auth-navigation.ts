export function resolveSignedOutView(currentView: string, authFailed = false): 'landing' | 'auth' {
  return authFailed || currentView === 'auth' ? 'auth' : 'landing';
}
