import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiRequest, authTokenStore } from "@/lib/api";

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  color: number;
}

interface Session {
  access_token: string;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

// Our backend responds with data: { user } for /auth/me
interface MeResponse {
  user: AuthUser;
}

// Our backend responds with data: { user, token } for /auth/login
interface LoginResponse {
  token: string;
  user: AuthUser;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to create a fake Profile from AuthUser since our backend doesn't split them
const createProfileFromUser = (user: AuthUser): Profile => ({
  id: user.id,
  user_id: user.id,
  display_name: user.name || user.email.split('@')[0],
  avatar_url: user.avatarUrl || null,
  color: 1 + (user.id.charCodeAt(0) % 6) // Deterministic random color 1-6
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = authTokenStore.get();

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const me = await apiRequest<MeResponse>("/auth/me", { token });
        setUser(me.user);
        setProfile(createProfileFromUser(me.user));
        setSession({ access_token: token });
      } catch (error: any) {
        // If it was a 401, the interceptor already cleared the token and triggered auth:401.
        // We only fallback if the token is still considered valid (e.g., 500 error or network failure).
        if (authTokenStore.get()) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const fallbackUser = { id: payload.id, email: payload.email, name: payload.email.split('@')[0] };
            setUser(fallbackUser);
            setProfile(createProfileFromUser(fallbackUser));
            setSession({ access_token: token });
          } catch (e) {
            authTokenStore.clear();
            setUser(null);
            setProfile(null);
            setSession(null);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    const handle401 = () => {
      authTokenStore.clear();
      setUser(null);
      setProfile(null);
      setSession(null);
    };

    window.addEventListener('auth:401', handle401);
    initializeAuth();

    return () => {
      window.removeEventListener('auth:401', handle401);
    };
  }, []);

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      // Backend expects { name, email, password }
      await apiRequest("/auth/register", {
        method: "POST",
        body: { email, password, name: displayName },
      });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const loginData = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: { email, password },
      });

      authTokenStore.set(loginData.token);
      setUser(loginData.user);
      setProfile(createProfileFromUser(loginData.user));
      setSession({ access_token: loginData.token });

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    const token = authTokenStore.get();

    try {
      if (token) {
        await apiRequest("/auth/logout", { method: "POST", token });
      }
    } catch {
      // Ignore logout errors
    }

    authTokenStore.clear();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

