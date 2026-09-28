import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDriverData } from '../context/DriverData';
import { EmptyState } from '../components/ui';
import { markNotificationRead } from '../services/driverService';
import { colors, radius, space, type } from '../theme';

export function NotificationsScreen() {
  const { notifications } = useDriverData();
  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={notifications}
      keyExtractor={(n) => n.id}
      contentContainerStyle={{ padding: space.lg }}
      ListEmptyComponent={<EmptyState title="No notifications" message="Trip, payout and document updates from NESAM appear here." />}
      renderItem={({ item: n }) => (
        <Pressable
          onPress={() => {
            if (!n.read) markNotificationRead(n.id).catch(() => undefined);
          }}
          style={[styles.item, !n.read && styles.unread]}
          accessibilityRole="button"
        >
          <View style={[styles.dot, { backgroundColor: n.read ? colors.border : colors.primary }]} />
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>{n.title}</Text>
            <Text style={[type.small, { marginTop: 2 }]}>{n.message}</Text>
            <Text style={[type.tiny, { marginTop: 4 }]}>{n.time}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: space.md, backgroundColor: '#FAFAFA', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, marginBottom: space.sm },
  unread: { backgroundColor: colors.card, borderColor: colors.primaryBorder },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
