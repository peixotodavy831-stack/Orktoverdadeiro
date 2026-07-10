let cachedAccessToken: string | null = localStorage.getItem('google_access_token');

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || localStorage.getItem('google_access_token');
};

export const googleSignIn = async (): Promise<{ user: any; accessToken: string } | null> => {
  return null;
};

export const logout = async () => {
  cachedAccessToken = null;
  localStorage.removeItem('google_access_token');
};
