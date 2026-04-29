import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

const DEFAULT_CATEGORY_COLOR = "#6C63FF";

export default function Admin() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCategories: 0,
    totalTransactions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // User detail modal
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [userDetailVisible, setUserDetailVisible] = useState(false);

  // Category modal
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [catName, setCatName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/");
        return;
      }

      const { data: profile } = await supabase
        .from("UserInfo")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (profile?.role !== "admin") {
        Alert.alert("Access Denied", "You don't have admin access.");
        router.replace("/(tabs)/home");
        return;
      }

      // Load users — newest first via auth created_at
      const { data: usersData } = await supabase
        .from("UserInfo")
        .select("user_id, full_name, email, role, phone_num")
        .order("user_info_id", { ascending: false });

      setUsers(usersData || []);
      setFilteredUsers(usersData || []);

      // Load categories with usage count
      const { data: catsData } = await supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });

      // Get transaction counts per category
      const { data: txData } = await supabase
        .from("transactions")
        .select("category_id");

      const usageMap = {};
      txData?.forEach((t) => {
        if (t.category_id) {
          usageMap[t.category_id] = (usageMap[t.category_id] || 0) + 1;
        }
      });

      const catsWithUsage = (catsData || [])
        .map((c) => ({
          ...c,
          usageCount: usageMap[c.id] || 0,
        }))
        .sort((a, b) => b.usageCount - a.usageCount);

      setCategories(catsWithUsage);

      setStats({
        totalUsers: usersData?.length || 0,
        totalCategories: catsData?.length || 0,
        totalTransactions: txData?.length || 0,
      });
    } catch (err) {
      console.error("Admin loadData error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (u) =>
            u.full_name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q),
        ),
      );
    }
  }, [searchQuery, users]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  // ── User detail 
  async function openUserDetail(user) {
    setSelectedUser(user);
    setUserDetailVisible(true);
    setUserDetailLoading(true);
    setUserDetail(null);

    try {
      const { count: txCount } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.user_id);

      setUserDetail({ txCount: txCount || 0 });
    } catch (err) {
      console.error("User detail error:", err);
    } finally {
      setUserDetailLoading(false);
    }
  }

  async function handleToggleRole(userId, currentRole, userName) {
    const newRole = currentRole === "admin" ? "user" : "admin";
    Alert.alert("Change Role", `Make ${userName} a ${newRole}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          const { error } = await supabase
            .from("UserInfo")
            .update({ role: newRole })
            .eq("user_id", userId);
          if (error) {
            Alert.alert("Error", error.message);
          } else {
            setUsers((prev) =>
              prev.map((u) =>
                u.user_id === userId ? { ...u, role: newRole } : u,
              ),
            );
            if (selectedUser?.user_id === userId) {
              setSelectedUser((prev) => ({ ...prev, role: newRole }));
            }
          }
        },
      },
    ]);
  }

  // ── Category CRUD 
  function openNewCategory() {
    setEditingCategory(null);
    setCatName("");
    setCatModalVisible(true);
  }

  function openEditCategory(cat) {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatModalVisible(true);
  }

  async function handleSaveCategory() {
    if (!catName.trim()) {
      Alert.alert("Error", "Please enter a category name.");
      return;
    }
    setSaving(true);

    if (editingCategory) {
      const { error } = await supabase
        .from("categories")
        .update({ name: catName.trim() })
        .eq("id", editingCategory.id);

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === editingCategory.id
              ? { ...c, name: catName.trim() }
              : c,
          ),
        );
        setCatModalVisible(false);
      }
    } else {
      const { data, error } = await supabase
        .from("categories")
        .insert({
          name: catName.trim(),
          color: DEFAULT_CATEGORY_COLOR,
          icon: "ellipsis-horizontal-outline",
        })
        .select()
        .single();

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        setCategories((prev) => [...prev, { ...data, usageCount: 0 }]);
        setStats((prev) => ({
          ...prev,
          totalCategories: prev.totalCategories + 1,
        }));
        setCatModalVisible(false);
      }
    }
    setSaving(false);
  }

  async function handleDeleteCategory(id, name) {
    Alert.alert("Delete Category", `Delete "${name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("categories")
            .delete()
            .eq("id", id);
          if (error) {
            Alert.alert("Error", error.message);
          } else {
            setCategories((prev) => prev.filter((c) => c.id !== id));
            setStats((prev) => ({
              ...prev,
              totalCategories: prev.totalCategories - 1,
            }));
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading admin panel...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Admin Panel</Text>
          <Text style={styles.subtitle}>Lumen Management</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={20} color="#FF6B7A" />
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="people-outline" size={16} color="#6C63FF" />
          <Text style={styles.statValue}>{stats.totalUsers}</Text>
          <Text style={styles.statLabel}>Users</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="pricetags-outline" size={16} color="#4ECDC4" />
          <Text style={styles.statValue}>{stats.totalCategories}</Text>
          <Text style={styles.statLabel}>Categories</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="receipt-outline" size={16} color="#F4C542" />
          <Text style={styles.statValue}>{stats.totalTransactions}</Text>
          <Text style={styles.statLabel}>Transactions</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "users" && styles.tabActive]}
          onPress={() => setActiveTab("users")}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={activeTab === "users" ? "#fff" : "#A5A5B2"}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "users" && styles.tabTextActive,
            ]}
          >
            Users ({users.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "categories" && styles.tabActive]}
          onPress={() => setActiveTab("categories")}
        >
          <Ionicons
            name="pricetags-outline"
            size={16}
            color={activeTab === "categories" ? "#fff" : "#A5A5B2"}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "categories" && styles.tabTextActive,
            ]}
          >
            Categories ({categories.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search — users only */}
      {activeTab === "users" && (
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#A5A5B2" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email..."
            placeholderTextColor="#4a4570"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color="#A5A5B2" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Users List */}
      {activeTab === "users" ? (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.user_id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6C63FF"
            />
          }
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Text style={styles.listHint}>
              Newest members first · Tap a user for details
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.userRow}
              onPress={() => openUserDetail(item)}
              activeOpacity={0.7}
            >
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {item.full_name ? item.full_name[0].toUpperCase() : "?"}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <View style={styles.userNameRow}>
                  <Text style={styles.userName}>
                    {item.full_name || "No name"}
                  </Text>
                </View>
                <Text style={styles.userEmail}>{item.email}</Text>
              </View>
              <View style={styles.userRowRight}>
                <View
                  style={[
                    styles.roleBadge,
                    item.role === "admin" && styles.roleBadgeAdmin,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleText,
                      item.role === "admin" && styles.roleTextAdmin,
                    ]}
                  >
                    {item.role || "user"}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color="#A5A5B2"
                  style={{ marginLeft: 6 }}
                />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No users found.</Text>
          }
        />
      ) : (
        <>
          <FlatList
            data={categories}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#6C63FF"
              />
            }
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <Text style={styles.listHint}>
                Sorted by most used · Tap ✏️ to edit
              </Text>
            }
            renderItem={({ item }) => (
              <View style={styles.categoryRow}>
                <View
                  style={[
                    styles.categoryDot,
                    { backgroundColor: item.color || "#6C63FF" },
                  ]}
                />
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>{item.name}</Text>
                  <Text style={styles.categoryUsage}>
                    {item.usageCount}{" "}
                    {item.usageCount === 1 ? "transaction" : "transactions"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => openEditCategory(item)}
                  style={styles.iconBtn}
                >
                  <Ionicons name="pencil-outline" size={18} color="#A5A5B2" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteCategory(item.id, item.name)}
                  style={styles.iconBtn}
                >
                  <Ionicons name="trash-outline" size={18} color="#FF6B7A" />
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No categories found.</Text>
            }
          />
          <TouchableOpacity style={styles.addBtn} onPress={openNewCategory}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </>
      )}

      {/* ── User Detail Modal ── */}
      <Modal visible={userDetailVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.modalTitle}>User Details</Text>
              <TouchableOpacity
                onPress={() => {
                  setUserDetailVisible(false);
                  setUserDetail(null);
                }}
              >
                <Ionicons name="close" size={22} color="#A5A5B2" />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <>
                <View style={styles.detailHero}>
                  <View style={styles.detailAvatar}>
                    <Text style={styles.detailAvatarText}>
                      {selectedUser.full_name
                        ? selectedUser.full_name[0].toUpperCase()
                        : "?"}
                    </Text>
                  </View>
                  <Text style={styles.detailName}>
                    {selectedUser.full_name || "No name"}
                  </Text>
                  <Text style={styles.detailEmail}>{selectedUser.email}</Text>
                  {selectedUser.phone_num && (
                    <Text style={styles.detailPhone}>
                      {selectedUser.phone_num}
                    </Text>
                  )}
                </View>

                {userDetailLoading ? (
                  <ActivityIndicator
                    color="#6C63FF"
                    style={{ marginVertical: 20 }}
                  />
                ) : userDetail ? (
                  <>
                    {/* Transaction count only — no financial amounts */}
                    <View style={styles.detailStats}>
                      <View style={styles.detailStatCard}>
                        <Text style={styles.detailStatValue}>
                          {userDetail.txCount}
                        </Text>
                        <Text style={styles.detailStatLabel}>Transactions</Text>
                      </View>
                    </View>

                    {/* Role management */}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailRowLabel}>Role</Text>
                      <TouchableOpacity
                        style={[
                          styles.roleBadge,
                          selectedUser.role === "admin" &&
                            styles.roleBadgeAdmin,
                        ]}
                        onPress={() =>
                          handleToggleRole(
                            selectedUser.user_id,
                            selectedUser.role,
                            selectedUser.full_name,
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.roleText,
                            selectedUser.role === "admin" &&
                              styles.roleTextAdmin,
                          ]}
                        >
                          {selectedUser.role || "user"} · tap to change
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : null}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Category Modal */}
      <Modal visible={catModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingCategory ? "Edit Category" : "New Category"}
            </Text>

            <Text style={styles.fieldLabel}>NAME</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Utilities"
              placeholderTextColor="#4a4570"
              value={catName}
              onChangeText={setCatName}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCatModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSaveCategory}
                disabled={saving}
              >
                <Text style={styles.saveText}>
                  {saving ? "Saving..." : editingCategory ? "Save" : "Add"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07070f" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#07070f",
  },
  loadingText: { color: "#A5A5B2", marginTop: 12, fontSize: 14 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1B1C24",
  },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#A5A5B2", fontSize: 13, marginTop: 2 },
  logoutBtn: { padding: 8, backgroundColor: "#1B1C24", borderRadius: 10 },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#12131B",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#242633",
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  statValue: { color: "#fff", fontSize: 18, fontWeight: "700" },
  statLabel: { color: "#A5A5B2", fontSize: 10 },
  tabs: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#12131B",
    borderWidth: 1,
    borderColor: "#242633",
  },
  tabActive: { backgroundColor: "#6C63FF", borderColor: "#6C63FF" },
  tabText: { color: "#A5A5B2", fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#12131B",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#242633",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 14 },
  listContent: { paddingHorizontal: 20, paddingBottom: 120 },
  listHint: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 11,
    marginBottom: 12,
    marginTop: 4,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1B1C24",
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#6C63FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  userAvatarText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  userName: { color: "#fff", fontSize: 14, fontWeight: "600" },
  userEmail: { color: "#A5A5B2", fontSize: 12, marginTop: 2 },
  userRowRight: { flexDirection: "row", alignItems: "center" },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#1B1C24",
    borderWidth: 1,
    borderColor: "#242633",
  },
  roleBadgeAdmin: {
    backgroundColor: "rgba(108,99,255,0.15)",
    borderColor: "#6C63FF",
  },
  roleText: { color: "#A5A5B2", fontSize: 11, fontWeight: "600" },
  roleTextAdmin: { color: "#8E6CFF" },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1B1C24",
  },
  categoryDot: { width: 12, height: 12, borderRadius: 6, marginRight: 14 },
  categoryInfo: { flex: 1 },
  categoryName: { color: "#fff", fontSize: 15 },
  categoryUsage: { color: "#A5A5B2", fontSize: 11, marginTop: 2 },
  iconBtn: { padding: 8 },
  emptyText: {
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
  },
  addBtn: {
    position: "absolute",
    bottom: 28,
    right: 170,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#6C63FF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6C63FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  detailCard: {
    backgroundColor: "#12131B",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#242633",
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  detailHero: { alignItems: "center", marginBottom: 24 },
  detailAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#6C63FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  detailAvatarText: { color: "#fff", fontSize: 24, fontWeight: "700" },
  detailName: { color: "#fff", fontSize: 18, fontWeight: "700" },
  detailEmail: { color: "#A5A5B2", fontSize: 13, marginTop: 4 },
  detailPhone: { color: "#A5A5B2", fontSize: 13, marginTop: 2 },
  detailStats: { flexDirection: "row", gap: 10, marginBottom: 20 },
  detailStatCard: {
    flex: 1,
    backgroundColor: "#0f0e28",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  detailStatValue: { color: "#fff", fontSize: 18, fontWeight: "700" },
  detailStatLabel: { color: "#A5A5B2", fontSize: 11 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#1B1C24",
  },
  detailRowLabel: { color: "#A5A5B2", fontSize: 14 },
  modalCard: {
    backgroundColor: "#12131B",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#242633",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#6C63FF",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: "#0e0c22",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e1b3a",
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: { flexDirection: "row", gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#1B1C24",
    alignItems: "center",
  },
  cancelText: { color: "#A5A5B2", fontSize: 15, fontWeight: "600" },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#6C63FF",
    alignItems: "center",
  },
  saveBtnDisabled: { backgroundColor: "#3d3880" },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
