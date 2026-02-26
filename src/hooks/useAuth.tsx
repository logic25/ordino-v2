import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef, useMemo } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  hasProfile: boolean;
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
  const [signingOut, setSigningOut] = useState(false);
  const clockedInRef = useRef(false);

  // Auto clock-in helper
  const autoClockIn = useCallback(async (userId: string, companyId: string) => {
    if (clockedInRef.current) return;
    clockedInRef.current = true;
    try {
      let ipAddress: string | null = null;
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const json = await res.json();
        ipAddress = json.ip;
      } catch { /* non-critical */ }

      await (supabase as any)
        .from("attendance_logs")
        .insert({
          user_id: userId,
          company_id: companyId,
          clock_in_location: "Auto",
          ip_address: ipAddress,
        });
      // Ignore 23505 (unique violation) — already clocked in today
    } catch { /* non-critical */ }
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
    return data;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const profileData = await fetchProfile(user.id);
    setProfile(profileData);
  }, [user, fetchProfile]);

  useEffect(() => {
    let initialSessionHandled = false;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Mark that onAuthStateChange handled the session so getSession doesn't double-fetch
          initialSessionHandled = true;
          // Defer to avoid Supabase deadlock, but keep loading true until profile resolves
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

    // THEN check for existing session (fallback if onAuthStateChange hasn't fired yet)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (initialSessionHandled) return; // onAuthStateChange already handled it
      
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

  // During sign-out, treat hasProfile as true to prevent Setup flash
  const effectiveHasProfile = useMemo(
    () => signingOut ? true : !!profile,
    [signingOut, profile]
  );

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        session, 
        profile, 
        loading, 
        hasProfile: effectiveHasProfile,
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
