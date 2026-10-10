import React, { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInbox } from '../context/Inbox';
import { EmptyState, LinkText, Notice } from '../components/ui';
import { markAllNotificationsRead, markNotificationRead } from '../services/userService';
import { CATEGORIES, CATEGORY_LABEL, TONE_COLORS, toneOf } from '../utils/notificationModel';
import type { NotificationCategory } from '../types/notifications';
import { describeError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';

export function NotificationsScreen() {
  const { notifications } = useInbox();
  const [filter, setFilter] = useState<NotificationCategory | 'all'>('all');
  const [error, setError] = useState('');
  const unread = notifications.filter((n) => !n.read);
  // Only categories that have something in them, so the bar stays short.
  const tabs = (['all', ...CATEGORIES] as const).filter((c) => c === 'all' || c === filter || notifications.some((n) => n.category === c));
  const shown = filter === 'all' ? notifications : notifications.filter((n) => n.category === filter);

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
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((c) => {
            const count = (c === 'all' ? unread : unread.filter((n) => n.category === c)).length;
            const active = filter === c;
            return (
              <Pressable key={c} onPress={() => setFilter(c)} style={[styles.tab, active && styles.tabOn]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                <Text style={[styles.tabText, active && { color: colors.white }]}>
                  {c === 'all' ? 'All' : CATEGORY_LABEL[c]}
                  {count ? ` (${count})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <FlatList
        data={shown}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: space.lg, paddingTop: 0 }}
        ListHeaderComponent={<Notice message={error} />}
        ListEmptyComponent={<EmptyState title="You’re all caught up" message="Ride updates and offers from NESAM appear here." />}
        renderItem={({ item: n }) => {
          const tone = TONE_COLORS[toneOf(n)];
          return (
            <Pressable
              onPress={() => {
                if (!n.read) markNotificationRead(n.id).catch(() => undefined);
              }}
              style={[styles.item, { borderColor: n.read ? colors.border : tone.border, backgroundColor: n.read ? '#FAFAFA' : tone.bg }]}
              accessibilityRole="button"
              accessibilityHint={n.read ? undefined : 'Marks as read'}
            >
              <View style={[styles.dot, { backgroundColor: n.read ? colors.border : tone.bar }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cat, { color: n.read ? colors.muted : tone.text }]}>{CATEGORY_LABEL[n.category].toUpperCase()}</Text>
                <View style={styles.titleRow}>
                  <Text style={[type.h3, { flex: 1 }]}>{n.title}</Text>
                  <Text style={type.tiny}>{n.time}</Text>
                </View>
                <Text style={[type.small, { marginTop: 2 }]}>{n.message}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md },
  tabs: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm },
  tab: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.text },
  item: { flexDirection: 'row', gap: space.md, borderRadius: radius.lg, borderWidth: 1, padding: space.md, marginBottom: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  cat: { fontSize: 10, fontWeight: '800', marginBottom: 2 },
  titleRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
});
