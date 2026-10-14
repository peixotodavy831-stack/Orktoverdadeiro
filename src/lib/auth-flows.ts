export type SignUpOutcome = { confirmationRequired: boolean };

export function hasRecoveryCallback(hash: string): boolean {
  return new URLSearchParams(hash.replace(/^#/, '')).get('type') === 'recovery';
}

export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < 12) return 'Use uma senha com pelo menos 12 caracteres.';
  if (password.length > 256) return 'Use uma senha com no máximo 256 caracteres.';
  if (password !== confirmation) return 'As senhas precisam ser iguais.';
  return null;
}

type AuthFailure = { code?: string; status?: number } | null;
type AuthUser = { id: string } | null;
export type RecoveryAuth = {
  getUser(): Promise<{ data: { user: AuthUser }; error: AuthFailure }>;
  updateUser(attributes: { password: string }): Promise<{ error: AuthFailure }>;
  signOut(options: { scope: 'global' }): Promise<{ error: AuthFailure }>;
};

export async function completePasswordRecovery(auth: RecoveryAuth, password: string, confirmation: string) {
  const validation = validateNewPassword(password, confirmation);
  if (validation) return { status: 'validation_failed' as const, message: validation };
  try {
    // A URL/marker selects a screen, never authorizes changing an account.
    const identity = await auth.getUser();
    if (identity.error || !identity.data.user) return { status: 'session_required' as const, message: 'O link expirou ou não é válido. Solicite um novo link de recuperação.' };
    const updated = await auth.updateUser({ password });
    if (updated.error) {
      const code = updated.error.code;
      return { status: 'update_failed' as const, message: code === 'weak_password'
        ? 'A senha não atende à política de segurança. Use uma senha única mais forte.'
        : code === 'same_password' ? 'Escolha uma senha diferente da anterior.'
          : 'Não foi possível atualizar a senha. Solicite um novo link se o problema continuar.' };
    }
    try {
      const signedOut = await auth.signOut({ scope: 'global' });
      if (signedOut.error) return { status: 'signout_failed' as const, message: 'Senha atualizada, mas não foi possível encerrar as sessões. Tente encerrar novamente.' };
    } catch {
      // Password update already succeeded. Only retry revocation, never the write.
      return { status: 'signout_failed' as const, message: 'Senha atualizada, mas não foi possível encerrar as sessões. Tente encerrar novamente.' };
    }
    return { status: 'complete' as const, message: 'Senha atualizada. Entre novamente com sua nova senha.' };
  } catch {
    return { status: 'unavailable' as const, message: 'Não foi possível confirmar a operação. Verifique sua conexão e tente novamente.' };
  }
}

export function signUpOutcome(data: { session: unknown }): SignUpOutcome {
  return { confirmationRequired: !data.session };
}
