export class ProductApiError extends Error {
  readonly status: number;
  readonly category?: string;

  constructor(message: string, status: number, category?: string) {
    super(message);
    this.name = 'ProductApiError';
    this.status = status;
    this.category = category;
  }
}

export async function productApi<T>(
  path: string,
  accessToken: string | null,
  init: RequestInit = {},
): Promise<T> {
  if (!accessToken) {
    throw new ProductApiError('Sua sessão expirou. Entre novamente para continuar.', 401, 'session_required');
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        Authorization: 'Bearer ' + accessToken,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ProductApiError('Não foi possível conectar ao ORKTO. Verifique sua conexão e tente novamente.', 0, 'offline');
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ProductApiError(
      typeof payload?.error === 'string' ? payload.error : 'Não foi possível carregar os dados agora.',
      response.status,
      typeof payload?.category === 'string' ? payload.category : undefined,
    );
  }
  return payload as T;
}

export function getProductErrorState(error: unknown) {
  if (!(error instanceof ProductApiError)) return 'error' as const;
  if (error.status === 401 || error.status === 403) return 'permission_denied' as const;
  if (error.status === 0 || error.category === 'offline') return 'offline' as const;
  if (error.category?.includes('configuration') || error.category === 'channel_not_configured') {
    return 'configuration_required' as const;
  }
  if (error.status === 404 || error.status === 501) return 'backend_pending' as const;
  return 'error' as const;
}
