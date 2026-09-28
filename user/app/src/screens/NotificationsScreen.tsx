import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCustomerData } from '../context/CustomerData';
import { EmptyState, LinkText, Notice } from '../components/ui';
import { markAllNotificationsRead, markNotificationRead } from '../services/userService';
import { describeError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';

export function NotificationsScreen() {
  const { notifications } = useCustomerData();
  const [error, setError] = useState('');
  const unread = notifications.filter((n) => !n.read);

  const markAll = async () => {
    setError('');
    try {
      await markAllNotificationsRead(unread.map((n) => n.id));
    } catch (e) {
      setError(describeError(e, 'Couldn’t update notifications.'));
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={type.h1}>Notifications</Text>
          <Text style={type.small}>Booking updates, driver alerts & offers</Text>
        </View>
        {unread.length > 0 ? <LinkText onPress={() => void markAll()}>Mark all read</LinkText> : null}
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: space.lg, paddingTop: 0 }}
        ListHeaderComponent={<Notice message={error} />}
        ListEmptyComponent={<EmptyState title="You’re all caught up" message="Ride updates and offers from NESAM appear here." />}
        renderItem={({ item: n }) => (
          <Pressable
            onPress={() => {
              if (!n.read) markNotificationRead(n.id).catch(() => undefined);
            }}
            style={[styles.item, !n.read && styles.unread]}
            accessibilityRole="button"
            accessibilityHint={n.read ? undefined : 'Marks as read'}
          >
            <View style={[styles.dot, { backgroundColor: n.read ? colors.border : colors.primary }]} />
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={[type.h3, { flex: 1 }]}>{n.title}</Text>
                <Text style={type.tiny}>{n.time}</Text>
              </View>
              <Text style={[type.small, { marginTop: 2 }]}>{n.message}</Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md },
  item: {
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: '#FAFAFA',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    marginBottom: space.sm,
  },
  unread: { backgroundColor: colors.card, borderColor: colors.primaryBorder },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  titleRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
});
