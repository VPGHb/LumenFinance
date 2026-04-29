import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function Profile() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const stars = useMemo(() => buildStars(width, height), [width, height]);

  //name, initials
  const [fullName, setFullName] = useState("");
  const [initials, setInitials] = useState("");

  //grabbing email
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [aiInsightsEnabled, setAiInsightsEnabled] = useState(true);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  useEffect(() => {
    async function fetchUserName() {
      // for name,initials - Step 1: ask Supabase who is currently logged in
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.log("Could not get logged-in user");
        return;
      }

      setEmail(user.email || "");

      const { data: accountData } = await supabase
        .from("accounts")
        .select("ai_insights_enabled")
        .eq("user_id", user.id)
        .single();

      setAiInsightsEnabled(accountData?.ai_insights_enabled !== false);

      // Step 2: use that auth user id to look up this user's row in UserInfo
      const { data, error } = await supabase
        .from("UserInfo")
        .select("full_name, phone_num")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.log("Could not fetch full name:", error.message);
        return;
      }

      // Step 3: save the full name into React state
      setFullName(data.full_name);
      setPhone(data.phone_num ? String(data.phone_num) : "");

      // Step 4: turn the full name into initials
      const nameParts = data.full_name.trim().split(" ");

      // take the first letter of the first 2 name parts
      const userInitials = nameParts
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");

      setInitials(userInitials);
    }

    fetchUserName();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function openInfoModal() {
    setNameInput(fullName);
    setPhoneInput(phone);
    setInfoModalVisible(true);
  }

  async function savePersonalInfo() {
    if (!nameInput.trim()) {
      Alert.alert("Missing info", "Name is required.");
      return;
    }

    setSavingInfo(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const phoneDigits = phoneInput.replace(/\D/g, "");
    const { error } = await supabase
      .from("UserInfo")
      .update({
        full_name: nameInput.trim(),
        phone_num: phoneDigits ? parseInt(phoneDigits, 10) : null,
      })
      .eq("user_id", user.id);

    setSavingInfo(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    setFullName(nameInput.trim());
    setPhone(phoneDigits);
    setInitials(
      nameInput
        .trim()
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join(""),
    );
    setInfoModalVisible(false);
  }

  async function toggleAiInsights() {
    const nextValue = !aiInsightsEnabled;
    setAiInsightsEnabled(nextValue);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase
        .from("accounts")
        .update({ ai_insights_enabled: nextValue })
        .eq("user_id", user.id);

      if (error) setAiInsightsEnabled(!nextValue);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.skyBg, { width }]} />

      {stars.map((star, index) => (
        <Star key={index} {...star} />
      ))}

      {/* Back button */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.back()}
        activeOpacity={0.5}
      >
        <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.7)" />
        <Text style={styles.backLabel}>Back</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || "?"}</Text>
            </View>
          </View>
          <Text style={styles.heroName}>{fullName || "Loading..."}</Text>
          <Text style={styles.heroEmail}>{email || "Loading..."}</Text>
        </View>

        {/* ── Account ── */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.menuGroup}>
          <MenuRow
            icon="person-outline"
            iconBg="#1C1A3A"
            iconColor="#8E6CFF"
            title="Personal information"
            subtitle="Name, email, phone"
            onPress={openInfoModal}
            isLast
          />
        </View>

        {/* ── Preferences ── */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.menuGroup}>
          <MenuRow
            icon="sparkles-outline"
            iconBg="#1C1A3A"
            iconColor="#8E6CFF"
            title="AI Insights"
            subtitle={aiInsightsEnabled ? "Monthly report enabled" : "Monthly report disabled"}
            badge={aiInsightsEnabled ? "On" : "Off"}
            badgeColor={aiInsightsEnabled ? "#56D37F" : "#FF6B6B"}
            onPress={toggleAiInsights}
            isLast
          />
        </View>

        {/* ── Support ── */}
        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.menuGroup}>
          <MenuRow
            icon="help-circle-outline"
            iconBg="#2A2210"
            iconColor="#F4C542"
            title="Help & FAQ"
            onPress={() => console.log("Help")}
            isLast
          />
        </View>

        {/* -- Logout -- */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPressIn={() => console.log("logout")}
          onPress={handleLogout}
          activeOpacity={0.3}
        >
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal
        visible={infoModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setInfoModalVisible(false)}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Personal Information</Text>

            <Text style={styles.sheetLabel}>Name</Text>
            <TextInput
              style={styles.sheetInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Full name"
              placeholderTextColor="#6F707C"
            />

            <Text style={styles.sheetLabel}>Phone</Text>
            <TextInput
              style={styles.sheetInput}
              value={phoneInput}
              onChangeText={setPhoneInput}
              placeholder="Phone number"
              placeholderTextColor="#6F707C"
              keyboardType="phone-pad"
            />

            <Text style={styles.readOnlyEmail}>Email: {email}</Text>

            <View style={styles.sheetButtonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setInfoModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, savingInfo && { opacity: 0.65 }]}
                onPress={savePersonalInfo}
                disabled={savingInfo}
              >
                <Text style={styles.submitButtonText}>
                  {savingInfo ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Reusable menu row component ──
function MenuRow({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  badge,
  badgeColor,
  onPress,
  isLast,
}) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, isLast && styles.menuRowLast]}
      onPress={onPress}
      activeOpacity={0.5}
    >
      <View style={[styles.menuIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>

      <View style={styles.menuText}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle ? <Text style={styles.menuSubtitle}>{subtitle}</Text> : null}
      </View>

      {badge ? (
        <View
          style={[styles.menuBadge, { backgroundColor: badgeColor + "26" }]}
        >
          <Text style={[styles.menuBadgeText, { color: badgeColor }]}>
            {badge}
          </Text>
        </View>
      ) : null}

      <Ionicons
        name="chevron-forward"
        size={16}
        color="rgba(255,255,255,0.2)"
      />
    </TouchableOpacity>
  );
}

// ── Star animation (same as home.js) ──
function Star({ x, y, size, delay }) {
  const opacity = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    const loop = () =>
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 2000 + Math.random() * 1000,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.05,
          duration: 2000 + Math.random() * 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]).start(loop);

    loop();
  }, [delay, opacity]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#fff",
        opacity,
      }}
    />
  );
}

function buildStars(width, height) {
  const stars = [];
  for (let i = 0; i < 100; i += 1) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 1 + Math.random() * 2.5,
      delay: Math.random() * 2000,
    });
  }
  return stars;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0f0e28",
  },
  skyBg: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    backgroundColor: "#0f0e28",
  },

  // Back button
  backBtn: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    left: 16,
    position: "absolute",
    top: 54,
    zIndex: 50,
  },
  backLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
  },

  // Scroll
  scroll: {
    flex: 1,
    marginTop: 44,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 40,
  },

  // Hero
  hero: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatarRing: {
    alignItems: "center",
    borderColor: "rgba(108,99,255,0.45)",
    borderRadius: 46,
    borderWidth: 2,
    height: 92,
    justifyContent: "center",
    marginBottom: 14,
    width: 92,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#6C63FF",
    borderRadius: 38,
    height: 76,
    justifyContent: "center",
    width: 76,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "500",
  },
  heroName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  heroEmail: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
  },
  // Section label
  sectionLabel: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
  },

  // Menu group
  menuGroup: {
    backgroundColor: "#12131B",
    borderColor: "#242633",
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    overflow: "hidden",
  },
  menuRow: {
    alignItems: "center",
    borderBottomColor: "#1B1C24",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 13,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuRowLast: {
    borderBottomWidth: 0,
  },
  menuIconWrap: {
    alignItems: "center",
    borderRadius: 10,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  menuText: {
    flex: 1,
  },
  menuTitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
  },
  menuSubtitle: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    marginTop: 2,
  },
  menuBadge: {
    borderRadius: 10,
    marginRight: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  menuBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  bottomSheet: {
    backgroundColor: "#12131B",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: "#242633",
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 99,
    backgroundColor: "#3A3D4A",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 18,
  },
  sheetLabel: {
    color: "#A5A5B2",
    fontSize: 12,
    marginBottom: 8,
  },
  sheetInput: {
    backgroundColor: "#0E1016",
    borderWidth: 1,
    borderColor: "#242633",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#FFFFFF",
    fontSize: 15,
    marginBottom: 16,
  },
  readOnlyEmail: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    marginBottom: 18,
  },
  sheetButtonRow: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2D3A",
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#0E1016",
  },
  cancelButtonText: {
    color: "#A5A5B2",
    fontSize: 15,
    fontWeight: "600",
  },
  submitButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#6C63FF",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  // Logout
  logoutBtn: {
    alignItems: "center",
    backgroundColor: "rgba(255,70,70,0.07)",
    borderColor: "rgba(255,80,80,0.22)",
    borderRadius: 16,
    borderWidth: 0.5,
    justifyContent: "center",
    paddingVertical: 16,
  },
  logoutText: {
    color: "rgba(255,100,100,0.88)",
    fontSize: 15,
    fontWeight: "500",
  },

  bottomSpacer: {
    height: 100,
  },
});
