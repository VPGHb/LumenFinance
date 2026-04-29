import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { supabase } from "../lib/supabase";

// session management - access based on auth + onboarding state
export default function RootLayout() {
  const [session, setSession] = useState<any>(undefined);
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments<any>();

  //for loading screen
  const inLoading = segments[0] === "loading";

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function checkOnboarding() {
      if (!session?.user) {
        setIsOnboarded(null);
        setIsAdmin(null);
        return;
      }

      const { data: profile } = await supabase
        .from("UserInfo")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      const adminUser = profile?.role === "admin";
      setIsAdmin(adminUser);

      if (adminUser) {
        setIsOnboarded(true);
        return;
      }

      const { data, error } = await supabase
        .from("accounts")
        .select("net_worth, monthly_income, monthly_budget")
        .eq("user_id", session.user.id)
        .single();

      if (error || !data) {
        setIsOnboarded(false);
        return;
      }

      const finishedSetup =
        data.net_worth !== null &&
        data.monthly_income !== null &&
        data.monthly_budget !== null;

      setIsOnboarded(finishedSetup);
    }

    checkOnboarding();
  }, [session, segments]);

  useEffect(() => {
    if (session === undefined) return;
    if (session && (isOnboarded === null || isAdmin === null)) return;

    const inTabs = segments[0] === "(tabs)";
    const inProfile = segments[0] === "profile";
    const inAdmin = segments[0] === "admin";
    const inLogin = segments[0] === "login";
    const inSignup = segments[0] === "signup";
    const inWelcome = segments[0] === "welcome";

    const inProtectedRoute = inTabs || inProfile || inAdmin;
    const inGuestRoute = inLogin || inSignup;

    if (!session) {
      if (inProtectedRoute || inWelcome || inLoading) {
        router.replace("/login");
      }
      return;
    }

    if (isAdmin) {
      if (!inAdmin && !inLoading) {
        router.replace("/admin");
      }
      return;
    }

    if (inAdmin) {
      router.replace("/(tabs)/home");
      return;
    }

    if (!isOnboarded) {
      if (!inWelcome && !inLoading) {
        router.replace("/welcome");
      }
      return;
    }

    if (inGuestRoute || inWelcome) {
      router.replace("/(tabs)/home");
    }
  }, [session, isOnboarded, isAdmin, segments, router, inLoading]);

  if (
    session === undefined ||
    (session && (isOnboarded === null || isAdmin === null))
  ) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#07070f",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="login"
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="signup"
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="welcome"
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="(tabs)"
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="loading"
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="admin"
        options={{
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}
