// Google Sheets/Gmail desabilitados — serviço removido por segurança
export const getAccessToken = async (): Promise<string | null> => {
  return null;
};

export const googleSignIn = async (): Promise<{ user: any; accessToken: string } | null> => {
  return null;
};

export const logout = async () => {
  // Sem tokens para limpar
};
