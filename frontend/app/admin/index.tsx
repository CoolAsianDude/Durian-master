import React, { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useResponsive } from '@/utils/platform';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
  Dimensions,
  Modal,
  TextInput,
  StyleSheet as RNStyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { API_URL } from '@/config/appconf';
import { useAdminStyles } from '@/styles/admin_styles/index.styles';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Fonts, Palette } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

const modalStyles = RNStyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: Palette.white,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 450,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Palette.charcoalEspresso,
    marginBottom: 8,
    textAlign: 'center',
  },
  userInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    backgroundColor: '#f9f9f9',
    marginBottom: 12,
  },
  note: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    fontFamily: Fonts.medium,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#333',
    fontFamily: Fonts.semiBold,
    fontSize: 14,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#d32f2f',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: Palette.white,
    fontFamily: Fonts.bold,
    fontSize: 14,
  },
  disabledBtn: {
    backgroundColor: '#ccc',
  },
});

interface User {
  _id: string;
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

export default function Admin() {
  const styles = useAdminStyles();
  const { user, loading: userLoading, refreshUser, logout } = useUser();
  const { isWeb, isSmallScreen } = useResponsive();

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<{ message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [deactivateModalVisible, setDeactivateModalVisible] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (!userLoading && (!user || user.role !== 'admin')) {
      router.replace('/');
    }
  }, [user, userLoading]);

  // Fetch backend status
  const fetchStatus = () => {
    setLoading(true);
    fetch(`${API_URL}/status`, {
      headers: { 'ngrok-skip-browser-warning': 'true', Accept: 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(`HTTP ${res.status}`)))
      .then((data) => { setStatusData(data); setError(null); })
      .catch(() => setError('Failed to fetch backend status.'))
      .finally(() => setLoading(false));
  };

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    const token = await AsyncStorage.getItem('jwt_token');
    fetch(`${API_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true', Accept: 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(`HTTP ${res.status}`)))
      .then((data) => {
        const normalizedUsers = data.users.map((user: any) => ({ ...user, _id: user._id || user.id }));
        setUsers(normalizedUsers);
        setError(null);
      })
      .catch(() => setError('Failed to fetch users.'))
      .finally(() => setLoading(false));
  };

  // Logout
  const handleLogout = async () => {
    try {
      await logout();
      Alert.alert('Logged Out', 'Redirecting to home screen...');
      router.replace('/');
    } catch {
      Alert.alert('Error', 'Failed to logout');
    }
  };

  const updateUserRole = (userId: string, newRole: string) => {
    fetch(`${API_URL}/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ role: newRole }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          Alert.alert('Success', `User is now an ${newRole}.`);
          fetchUsers();
        } else Alert.alert('Error', data.error || 'Failed to update role.');
      })
      .catch(() => Alert.alert('Error', 'Failed to update role.'));
  };

  // Deactivate modal
  const openDeactivateModal = (user: User) => { setUserToDeactivate(user); setDeactivateReason(''); setDeactivateModalVisible(true); };
  const closeDeactivateModal = () => { setDeactivateModalVisible(false); setUserToDeactivate(null); setDeactivateReason(''); };

  const confirmDeactivateUser = () => {
    if (!userToDeactivate || !deactivateReason.trim()) {
      Alert.alert('Error', 'Please provide a reason.');
      return;
    }
    setDeactivating(true);
    fetch(`${API_URL}/admin/users/${userToDeactivate._id}/deactivate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ reason: deactivateReason.trim() }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) { Alert.alert('Success', 'User deactivated.'); closeDeactivateModal(); fetchUsers(); }
        else Alert.alert('Error', data.error || 'Failed to deactivate user.');
      })
      .catch(() => Alert.alert('Error', 'Failed to deactivate user.'))
      .finally(() => setDeactivating(false));
  };

  const reactivateUser = (userId: string) => {
    fetch(`${API_URL}/admin/users/${userId}/activate`, { method: 'PUT', headers: { 'ngrok-skip-browser-warning': 'true' } })
      .then((res) => res.json())
      .then((data) => { if (data.success) { Alert.alert('Success', 'User reactivated.'); fetchUsers(); } else Alert.alert('Error', data.error || 'Failed to reactivate user.'); })
      .catch(() => Alert.alert('Error', 'Failed to reactivate user.'));
  };

  useEffect(() => { fetchStatus(); fetchUsers(); }, []);

  if (userLoading || loading || !user) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Palette.linenWhite }}>
      <ActivityIndicator size="large" color={Palette.warmCopper} />
      <Text style={{ marginTop: 12, fontFamily: Fonts.medium, color: Palette.slate }}>Connecting...</Text>
    </View>
  );

  const visibleUsers = showDeactivated ? users : users.filter(u => u.isActive !== false);

  return (
    <View style={{ flex: 1, flexDirection: (isSmallScreen || !isWeb) ? 'column' : 'row', backgroundColor: Palette.linenWhite }}>
      <AdminSidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
      {sidebarVisible && (isSmallScreen || !isWeb) && <TouchableOpacity style={overlayStyles.overlay} activeOpacity={1} onPress={() => setSidebarVisible(false)} />}

      <View style={{ flex: 1 }}>
        <ScrollView style={styles.container} contentContainerStyle={(isSmallScreen || !isWeb) ? undefined : { paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {(isSmallScreen || !isWeb) && (
            <View style={mobileHeaderStyles.header}>
              <TouchableOpacity onPress={() => setSidebarVisible(true)}><Ionicons name="menu" size={32} color={Palette.deepObsidian} /></TouchableOpacity>
              <Text style={mobileHeaderStyles.title}>Admin Panel</Text>
              <View style={{ width: 32 }} />
            </View>
          )}

          <View style={styles.header}>
            <Text style={styles.title}>Admin Dashboard</Text>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}><Text style={styles.logoutBtnText}>Logout</Text></TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>System Status</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusIndicator, { backgroundColor: error ? '#ef4444' : '#22c55e' }]} />
              <Text style={styles.statusText}>{error ? 'Backend Offline' : statusData?.message || 'Operational'}</Text>
            </View>
            {error && <TouchableOpacity style={styles.retryBtn} onPress={fetchStatus}><Text style={styles.retryBtnText}>Retry Connection</Text></TouchableOpacity>}
          </View>

          <Text style={styles.welcomeText}>Welcome, Administrator!</Text>

          <View style={[styles.card, { marginBottom: 40 }]}>
            <Text style={styles.cardTitle}>User Management</Text>
            <TouchableOpacity style={[styles.retryBtn, { alignSelf: 'flex-start', marginTop: 10 }]} onPress={() => setShowDeactivated(prev => !prev)}>
              <Text style={styles.retryBtnText}>{showDeactivated ? 'Hide Deactivated' : 'Show Deactivated'}</Text>
            </TouchableOpacity>

            {visibleUsers.length === 0 ? (
              <Text style={styles.emptyText}>No users found.</Text>
            ) : visibleUsers.map(u => (
              <View key={u._id} style={styles.userRow}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{u.name}</Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                </View>
                <View style={styles.userActions}>
                  <Picker
                    selectedValue={u.role}
                    onValueChange={(v) => v !== 'deactivate' && updateUserRole(u._id, v)}
                    style={styles.picker}
                  >
                    <Picker.Item label="User" value="user" />
                    <Picker.Item label="Admin" value="admin" />
                  </Picker>

                  {u.isActive ? (
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => openDeactivateModal(u)}>
                      <Text style={styles.deleteBtnText}>Deactivate</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.retryBtn} onPress={() => reactivateUser(u._id)}>
                      <Text style={styles.retryBtnText}>Reactivate</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Deactivation Modal */}
        <Modal visible={deactivateModalVisible} transparent animationType="fade" onRequestClose={closeDeactivateModal}>
          <View style={modalStyles.overlay}>
            <View style={modalStyles.modalContainer}>
              <Text style={modalStyles.modalTitle}>Deactivate User</Text>
              {userToDeactivate && <Text style={modalStyles.userInfo}>{userToDeactivate.name} ({userToDeactivate.email})</Text>}
              <Text style={modalStyles.label}>Reason for deactivation:</Text>
              <TextInput
                style={modalStyles.textInput}
                placeholder="Enter reason..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                value={deactivateReason}
                onChangeText={setDeactivateReason}
                textAlignVertical="top"
              />
              <Text style={modalStyles.note}>The user will receive an email notification.</Text>
              <View style={modalStyles.buttonRow}>
                <TouchableOpacity style={modalStyles.cancelBtn} onPress={closeDeactivateModal} disabled={deactivating}>
                  <Text style={modalStyles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[modalStyles.confirmBtn, deactivating && modalStyles.disabledBtn]} onPress={confirmDeactivateUser} disabled={deactivating}>
                  <Text style={modalStyles.confirmBtnText}>{deactivating ? 'Deactivating...' : 'Confirm Deactivate'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const overlayStyles = RNStyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  }
});

const mobileHeaderStyles = RNStyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: Palette.white,
    borderBottomWidth: 1,
    borderBottomColor: Palette.stoneGray,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Palette.deepObsidian,
  }
});