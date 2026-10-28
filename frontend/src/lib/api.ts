const LOCAL_BACKEND = "http://localhost:5000/api";
const DEPLOYED_BACKEND = "https://code-collab-ai-api.onrender.com/api";

const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  (import.meta.env.DEV ? LOCAL_BACKEND : DEPLOYED_BACKEND);

const TOKEN_STORAGE_KEY = "codecollab_auth_token";

interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

export const authTokenStore = {
  get: () => sessionStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY),
  set: (token: string) => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  },
  clear: () => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  },
};

export const apiRequest = async <T>(
  path: string,
  { method = "GET", body, token, signal }: ApiRequestOptions = {}
): Promise<T> => {
  const resolvedToken = token ?? authTokenStore.get();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  const responseText = await response.text();
  let data: any = null;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      authTokenStore.clear();
      window.dispatchEvent(new CustomEvent('auth:401'));
    }
    const htmlSnippet = responseText?.trim().startsWith('<')
      ? `Endpoint returned ${response.status} (${response.statusText || 'Error'})`
      : null;
    const message = data?.message || data?.error || htmlSnippet || (responseText && responseText.length < 300 ? responseText : `Request failed with status ${response.status}`);
    throw new Error(message);
  }

  // Handle standard { success: true, data: ... } response wrapper
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
     return data.data as T;
  }

  return data as T;
};

export const apiBaseUrl = API_BASE_URL;
