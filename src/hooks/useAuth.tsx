import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { PROFILE_COLUMNS_NO_GOALS } from "@/lib/profileColumns";


type Profile = Tables<"profiles">;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  hasProfile: boolean;
  signingOut: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const clockedInRef = useRef(false);

  // Wrap a profile fetch with profileLoading state + an 8s safety timeout
  // so route guards (loading || profileLoading) never spin forever.
  const runProfileLoad = useCallback(
    async (loader: () => Promise<Profile | null>): Promise<Profile | null> => {
      setProfileLoading(true);
      try {
        return await Promise.race([
          loader(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
        ]);
      } catch (err) {
        console.error("Profile load failed:", err);
        return null;
      } finally {
        setProfileLoading(false);
      }
    },
    []
  );

  // Auto clock-in helper — no external IP lookup (privacy + reliability)
  const autoClockIn = useCallback(async (userId: string, companyId: string) => {
    if (clockedInRef.current) return;
    clockedInRef.current = true;
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("attendance_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("log_date", today)
        .maybeSingle();

      if (existing) return;

      await supabase
        .from("attendance_logs")
        .insert({
          user_id: userId,
          company_id: companyId,
          clock_in_location: "Auto",
        });
    } catch (err) {
      console.error("Auto clock-in failed:", err);
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS_NO_GOALS)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
    if (!data) return null;
    // Goal columns are gated behind a SECURITY DEFINER RPC.
    const { data: goals } = await supabase.rpc("get_my_goals" as any);
    const g = (goals as any[] | null)?.[0] || null;
    return {
      ...(data as any),
      monthly_goal: g?.monthly_goal ?? null,
      weekly_goal: g?.weekly_goal ?? null,
      accuracy_goal: g?.accuracy_goal ?? null,
    };
  }, []);


  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const profileData = await fetchProfile(user.id);
    setProfile(profileData);
  }, [user, fetchProfile]);

  useEffect(() => {
    let initialSessionHandled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          initialSessionHandled = true;
          // Defer to avoid Supabase deadlock
          setTimeout(() => {
            fetchProfile(session.user.id).then((profileData) => {
              setProfile(profileData);
              setLoading(false);
              if (profileData && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
                autoClockIn(session.user.id, profileData.company_id);
              }
            });
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (initialSessionHandled) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id).then((profileData) => {
          setProfile(profileData);
          setLoading(false);
          if (profileData) {
            autoClockIn(session.user.id, profileData.company_id);
          }
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, autoClockIn]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    return { error };
  };

  const signOut = async () => {
    setSigningOut(true);
    setProfile(null);
    await supabase.auth.signOut();
    setSigningOut(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        // Honest: hasProfile reflects actual profile state. Consumers gating
        // Setup-flash should use the explicit `signingOut` flag instead.
        hasProfile: !!profile,
        signingOut,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
