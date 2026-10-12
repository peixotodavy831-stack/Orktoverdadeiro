export function resolveSignedOutView(currentView: string): 'landing' | 'auth' {
  return currentView === 'auth' ? 'auth' : 'landing';
}
