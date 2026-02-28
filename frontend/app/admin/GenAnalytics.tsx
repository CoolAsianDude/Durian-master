import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import { useUser } from '@/contexts/UserContext';
import { API_URL } from '@/config/appconf';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

interface AnalyticsData {
  total_users: number;
  total_scans: number;
  total_durians_detected: number;
  overall_success_rate: number;
  user_growth_percent?: number;
  weekly_growth_percent?: number;
  scan_success_breakdown?: {
    successful: number;
    rejected: number;
  };
  system_health?: 'Healthy' | 'Warning' | 'Critical';
  daily_scans?: Array<{ day: string; scans: number }>;
}

interface MetricCardProps {
  title: string;
  value: number;
  growth?: number;
  color: string;
}

export default function GenAnalytics() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debug function to print current analyticsData
const printAnalyticsData = () => {
  if (!analyticsData) {
    console.log('No analytics data loaded yet.');
    return;
  }

  console.log('===== GenAnalytics Data =====');
  console.log('Total Users:', analyticsData.total_users);
  console.log('Total Scans:', analyticsData.total_scans);
  console.log('Total Durians Detected:', analyticsData.total_durians_detected);
  console.log('Overall Success Rate:', analyticsData.overall_success_rate);
  console.log('User Growth Percent:', analyticsData.user_growth_percent ?? 'N/A');
  console.log('Weekly Growth Percent:', analyticsData.weekly_growth_percent ?? 'N/A');
  console.log('Scan Success Breakdown:', analyticsData.scan_success_breakdown ?? 'N/A');
  console.log('System Health:', analyticsData.system_health ?? 'N/A');
  console.log('Daily Scans:', analyticsData.daily_scans ?? 'N/A');
  console.log('==============================');
};

  // Fetch analytics from backend
  const fetchAdminAnalytics = useCallback(async () => {
    if (!user?.token) {
      setError('Admin not authenticated');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/admin/GenAnalytics`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${user.token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      const data = await res.json();

      if (data.success) {
        setAnalyticsData(data.stats);
        setError(null);
      } else {
        setError(data.error || 'Failed to load analytics');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token]);

  useEffect(() => {
    if (!userLoading) fetchAdminAnalytics();
  }, [fetchAdminAnalytics, userLoading]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAdminAnalytics();
  }, [fetchAdminAnalytics]);

  // Animated counter hook
  const useAnimatedNumber = (target: number, duration = 800) => {
    const [value, setValue] = useState(0);

    useEffect(() => {
      let start = 0;
      const increment = target / (duration / 16);
      const timer = setInterval(() => {
        start += increment;
        if (start >= target) {
          start = target;
          clearInterval(timer);
        }
        setValue(Math.floor(start));
      }, 16);

      return () => clearInterval(timer);
    }, [target]);

    return value;
  };

  // Metric card component
  const MetricCard: React.FC<MetricCardProps> = ({ title, value, growth, color }) => {
    const animatedValue = useAnimatedNumber(value);
    return (
      <View style={{
        width: Platform.OS === 'web' ? '18%' : '48%',
        backgroundColor: '#1F2937',
        borderRadius: 16,
        padding: 18,
        marginBottom: 16,
      }}>
        <Text style={{ color: '#9CA3AF', fontSize: 13 }}>{title}</Text>
        <Text style={{ color, fontSize: 22, fontWeight: 'bold', marginTop: 6 }}>{animatedValue}</Text>
        {growth !== undefined && (
          <Text style={{ marginTop: 6, color: growth >= 0 ? '#10B981' : '#EF4444', fontSize: 12 }}>
            {growth >= 0 ? '▲' : '▼'} {growth}%
          </Text>
        )}
      </View>
    );
  };

  // Download PDF (fetch blob with Authorization header)
  const downloadAdminPDF = async () => {
  if (!user?.token) return alert("Admin not authenticated");

  try {
    const res = await fetch(`${API_URL}/admin/GenAnalytics/pdf`, {
      headers: {
        'Authorization': `Bearer ${user.token}`,
        'Accept': 'application/pdf',
      },
    });

    if (!res.ok) throw new Error("PDF download failed");

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "gen_analytics_report.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error("PDF download failed:", err);
    alert("PDF download failed. Check console for details.");
  }
};

  if (loading || userLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' }}>
        <ActivityIndicator size="large" color="#27AE60" />
        <Text style={{ color: '#fff', marginTop: 12 }}>Loading analytics...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#111827' }}>
        <Text style={{ color: '#EF4444', textAlign: 'center' }}>{error}</Text>
        <Text style={{ color: '#27AE60', marginTop: 12 }} onPress={fetchAdminAnalytics}>Retry</Text>
      </View>
    );
  }

  const maxScans = Math.max(...(analyticsData?.daily_scans?.map(d => d.scans) || [1]));

  return (
    <ScrollView
      contentContainerStyle={{ padding: 20, backgroundColor: '#111827' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#27AE60" />}
    >
      {/* Back Button */}
      <TouchableOpacity
        style={{ marginBottom: 20, flexDirection: 'row', alignItems: 'center' }}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color="#27AE60" />
        <Text style={{ color: '#27AE60', marginLeft: 8 }}>Back</Text>
      </TouchableOpacity>

      {/* Header */}
      <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 8 }}>Admin Dashboard</Text>
      <Text style={{ color: '#9CA3AF', marginBottom: 20 }}>Global system overview</Text>

      {/* KPI Grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <MetricCard title="Total Users" value={analyticsData?.total_users ?? 0} growth={analyticsData?.user_growth_percent ?? 0} color="#27AE60" />
        <MetricCard title="Total Scans" value={analyticsData?.total_scans ?? 0} growth={analyticsData?.weekly_growth_percent ?? 0} color="#3B82F6" />
        <MetricCard title="Durians Detected" value={analyticsData?.total_durians_detected ?? 0} color="#F59E0B" />
        <MetricCard title="Success Rate" value={analyticsData?.overall_success_rate ?? 0} color="#10B981" />
      </View>

      {/* System Health */}
      <View style={{
        backgroundColor: '#1F2937',
        padding: 20,
        borderRadius: 16,
        marginTop: 10,
        marginBottom: 30
      }}>
        <Text style={{ color: '#9CA3AF' }}>System Health</Text>
        <Text style={{
          marginTop: 6,
          fontSize: 18,
          fontWeight: 'bold',
          color: analyticsData?.system_health === 'Healthy'
            ? '#10B981'
            : analyticsData?.system_health === 'Warning'
              ? '#F59E0B'
              : '#EF4444'
        }}>
          ● {analyticsData?.system_health ?? 'Unknown'}
        </Text>
      </View>

      {/* Weekly Activity */}
      <View style={{ marginBottom: 30 }}>
        <Text style={{ color: '#fff', fontSize: 18, marginBottom: 16 }}>Weekly Activity</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          {analyticsData?.daily_scans?.map((d, index) => {
            const height = (d.scans / maxScans) * 140;
            return (
              <View key={index} style={{ alignItems: 'center' }}>
                <View style={{ width: Platform.OS === 'web' ? 30 : 22, height, backgroundColor: '#27AE60', borderRadius: 6 }} />
                <Text style={{ color: '#9CA3AF', marginTop: 6 }}>{d.day}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* PDF Button */}
      <TouchableOpacity
  style={{
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27AE60',
    padding: 14,
    borderRadius: 12,
    marginBottom: 30
  }}
  onPress={downloadAdminPDF}
>
  <Ionicons name="download" size={18} color="#fff" style={{ marginRight: 8 }} />
  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Download PDF Report</Text>
</TouchableOpacity>
    </ScrollView>
  );
}