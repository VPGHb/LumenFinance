import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

export default function Insights() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [insight, setInsight] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [aiError, setAiError] = useState(false);

  const fetchMonthlySummary = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const { data: currentMonthData } = await supabase
      .from("transactions")
      .select("amount, transaction_type")
      .eq("user_id", session.user.id)
      .gte("transaction_date", currentMonthStart.toISOString().split('T')[0]);

    const { data: previousMonthData } = await supabase
      .from("transactions")
      .select("amount, transaction_type")
      .eq("user_id", session.user.id)
      .gte("transaction_date", previousMonthStart.toISOString().split('T')[0])
      .lte("transaction_date", previousMonthEnd.toISOString().split('T')[0]);

    const totals = (rows = []) => {
      const income = rows.filter(t => t.transaction_type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const expenses = rows.filter(t => t.transaction_type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      return { income, expenses, savings: income - expenses, savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0 };
    };

    setMonthlySummary({
      current: { name: now.toLocaleString('default', { month: 'long' }), ...totals(currentMonthData) },
      previous: { name: previousMonthStart.toLocaleString('default', { month: 'long' }), ...totals(previousMonthData) },
    });
  }, []);

  const fetchInsight = useCallback(async () => {
    try {
      setLoading(true);
      setAiError(false);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setInsight("Please log in to see your financial insights");
        setLoading(false);
        return;
      }

      const { data: accountData } = await supabase
        .from("accounts")
        .select("ai_insights_enabled")
        .eq("user_id", session.user.id)
        .single();

      if (accountData?.ai_insights_enabled === false) {
        setMonthlySummary(null);
        setInsight("AI insights are turned off in your profile.");
        setLoading(false);
        return;
      }

      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const currentStartStr = currentMonthStart.toISOString().split('T')[0];
      const previousStartStr = previousMonthStart.toISOString().split('T')[0];
      const previousEndStr = previousMonthEnd.toISOString().split('T')[0];

      const { data: currentMonthData } = await supabase
        .from("transactions")
        .select("amount, transaction_type")
        .eq("user_id", session.user.id)
        .gte("transaction_date", currentStartStr);

      const { data: previousMonthData } = await supabase
        .from("transactions")
        .select("amount, transaction_type")
        .eq("user_id", session.user.id)
        .gte("transaction_date", previousStartStr)
        .lte("transaction_date", previousEndStr);

      const currentIncome = currentMonthData?.filter(t => t.transaction_type === "income").reduce((s, t) => s + Number(t.amount), 0) || 0;
      const currentExpenses = currentMonthData?.filter(t => t.transaction_type === "expense").reduce((s, t) => s + Number(t.amount), 0) || 0;
      const currentSavings = currentIncome - currentExpenses;
      const currentSavingsRate = currentIncome > 0 ? (currentSavings / currentIncome) * 100 : 0;

      const previousIncome = previousMonthData?.filter(t => t.transaction_type === "income").reduce((s, t) => s + Number(t.amount), 0) || 0;
      const previousExpenses = previousMonthData?.filter(t => t.transaction_type === "expense").reduce((s, t) => s + Number(t.amount), 0) || 0;

      setMonthlySummary({
        current: {
          name: now.toLocaleString('default', { month: 'long' }),
          income: currentIncome,
          expenses: currentExpenses,
          savings: currentSavings,
          savingsRate: currentSavingsRate,
        },
        previous: {
          name: previousMonthStart.toLocaleString('default', { month: 'long' }),
          income: previousIncome,
          expenses: previousExpenses,
          savings: previousIncome - previousExpenses,
          savingsRate: previousIncome > 0 ? ((previousIncome - previousExpenses) / previousIncome) * 100 : 0,
        },
      });

      const { data, error: fnError } = await supabase.functions.invoke("lumen-ai", {
        body: { action: 'getInsights' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (fnError) {
        console.error("AI Function error:", fnError);
        setAiError(true);
        setInsight(`• You saved ${currentSavingsRate.toFixed(0)}% of your income this month.\n• Pull down to refresh for a full AI insight.`);
      } else {
        setInsight(data?.insight || "No insight returned");
        setAiError(false);
      }

    } catch (err) {
      console.error('Insight error:', err);
      setAiError(true);
      setInsight("• Unable to load AI insight right now.\n• Pull down to refresh and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInsight();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMonthlySummary();
    }, [fetchMonthlySummary]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchInsight();
  };

  // Parse bullet points from AI response
  const renderInsight = (text) => {
    if (!text) return null;
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    return lines.map((line, index) => {
      const cleaned = line.replace(/^[\*\-•]\s*/, '').trim();
      return (
        <View key={index} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Text style={styles.bulletText}>{cleaned}</Text>
        </View>
      );
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Analyzing your finances...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Insights</Text>
        <Text style={styles.pageSubtitle}>Your financial overview</Text>
      </View>

      {/* Monthly Comparison Cards */}
      {monthlySummary && (
        <View style={styles.comparisonContainer}>
          <Text style={styles.sectionTitle}>Monthly comparison</Text>

          <View style={styles.comparisonWrapper}>
            {/* Current Month */}
            <View style={styles.monthCard}>
              <Text style={styles.monthName}>{monthlySummary.current.name}</Text>
              <View style={styles.statRow}>
                <Ionicons name="trending-up" size={16} color="#4ECDC4" />
                <Text style={styles.incomeText}>+${monthlySummary.current.income.toLocaleString()}</Text>
              </View>
              <View style={styles.statRow}>
                <Ionicons name="trending-down" size={16} color="#FF6B6B" />
                <Text style={styles.expenseText}>-${monthlySummary.current.expenses.toLocaleString()}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statRow}>
                <Ionicons name="cash-outline" size={16} color="#F4C542" />
                <Text style={styles.savingsText}>Saved: ${Math.max(monthlySummary.current.savings, 0).toLocaleString()}</Text>
              </View>
              <View style={styles.rateBadge}>
                <Text style={styles.rateText}>{monthlySummary.current.savingsRate.toFixed(0)}% savings rate</Text>
              </View>
            </View>

            {/* VS */}
            <View style={styles.vsContainer}>
              <Text style={styles.vsText}>VS</Text>
            </View>

            {/* Previous Month */}
            <View style={styles.monthCard}>
              <Text style={styles.monthName}>{monthlySummary.previous.name}</Text>
              <View style={styles.statRow}>
                <Ionicons name="trending-up" size={16} color="#4ECDC4" />
                <Text style={styles.incomeText}>+${monthlySummary.previous.income.toLocaleString()}</Text>
              </View>
              <View style={styles.statRow}>
                <Ionicons name="trending-down" size={16} color="#FF6B6B" />
                <Text style={styles.expenseText}>-${monthlySummary.previous.expenses.toLocaleString()}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statRow}>
                <Ionicons name="cash-outline" size={16} color="#F4C542" />
                <Text style={styles.savingsText}>Saved: ${Math.max(monthlySummary.previous.savings, 0).toLocaleString()}</Text>
              </View>
              <View style={styles.rateBadgeSecondary}>
                <Text style={styles.rateTextSecondary}>{monthlySummary.previous.savingsRate.toFixed(0)}% savings rate</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* AI Insight Card */}
      <View style={styles.insightCard}>
        <View style={styles.insightHeader}>
          <View style={styles.lightbulbIcon}>
            <Ionicons name="bulb" size={22} color="#F4C542" />
          </View>
          <Text style={styles.insightTitle}>LumenAI Insight</Text>
        </View>
        <View style={styles.insightBody}>
          {renderInsight(insight)}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#A5A5B2',
  },
  header: {
    marginBottom: 28,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  pageSubtitle: {
    color: '#A5A5B2',
    marginTop: 4,
    fontSize: 13,
  },
  sectionTitle: {
    color: '#A5A5B2',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  comparisonContainer: {
    marginBottom: 24,
  },
  comparisonWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  monthCard: {
    flex: 1,
    backgroundColor: '#12131B',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#242633',
  },
  monthName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 14,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  incomeText: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '600',
  },
  expenseText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
  savingsText: {
    color: '#F4C542',
    fontSize: 13,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#242633',
    marginVertical: 10,
  },
  rateBadge: {
    backgroundColor: '#1A2A2E',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  rateText: {
    color: '#4ECDC4',
    fontSize: 11,
    fontWeight: '600',
  },
  rateBadgeSecondary: {
    backgroundColor: '#2C2C3E',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  rateTextSecondary: {
    color: '#A5A5B2',
    fontSize: 11,
    fontWeight: '600',
  },
  vsContainer: {
    width: 36,
    alignItems: 'center',
  },
  vsText: {
    color: '#A5A5B2',
    fontSize: 12,
    fontWeight: '600',
  },
  insightCard: {
    backgroundColor: '#12131B',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#242633',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  lightbulbIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2C2C3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  insightBody: {
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6C63FF',
    marginTop: 7,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    color: '#D0D0D0',
    fontSize: 15,
    lineHeight: 24,
    letterSpacing: 0.2,
  },
});
