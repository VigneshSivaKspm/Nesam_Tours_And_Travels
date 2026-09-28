// Home / Work / favourite places (port of user/web SavedPlacesScreen.tsx).
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCustomerData } from '../context/CustomerData';
import { Button, Card, EmptyState, Notice, Screen, Segmented, TextField } from '../components/ui';
import { PlaceSearchModal } from '../components/PlaceSearchModal';
import { deleteSavedPlace, savePlace } from '../services/userService';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import type { GeoPlace, LocationItem } from '../types';
import { describeError } from '../utils/retry';
import { colors, space, type } from '../theme';

type SaveType = 'home' | 'work' | 'favorite';
const ICON: Record<string, keyof typeof Ionicons.glyphMap> = { home: 'home-outline', work: 'briefcase-outline', favorite: 'star-outline' };

export function SavedPlacesScreen() {
  const { profile, savedPlaces } = useCustomerData();
  const { position } = useDeviceLocation(false);
  const [adding, setAdding] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [picked, setPicked] = useState<GeoPlace | null>(null);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<SaveType>('favorite');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const reset = () => {
    setAdding(false);
    setPicked(null);
    setLabel('');
    setKind('favorite');
  };

  const add = async () => {
    if (!picked) return setError('Search for the place to save.');
    const name = kind === 'home' ? 'Home' : kind === 'work' ? 'Work' : label.trim() || picked.name;
    // Only one Home and one Work: replace the existing entry.
    const existing = kind !== 'favorite' ? savedPlaces.find((p) => p.type === kind) : undefined;
    setBusy(true);
    setError('');
    try {
      await savePlace({ ...picked, id: existing?.id ?? '', name, address: picked.address, type: kind }, profile.uid);
      reset();
    } catch (e) {
      setError(describeError(e, 'Couldn’t save this place.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const remove = (p: LocationItem) =>
    Alert.alert('Remove place?', `“${p.name}” will be removed from your saved places.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setDeleting(p.id);
          setError('');
          deleteSavedPlace(p.id)
            .catch((e: unknown) => setError(describeError(e, 'Couldn’t remove this place.')))
            .finally(() => setDeleting(null));
        },
      },
    ]);

  return (
    <Screen edges={[]}>
      <PlaceSearchModal visible={searchOpen} title="Find a place" onClose={() => setSearchOpen(false)} onSelect={setPicked} near={position} />
      <Notice message={error} />
      {adding ? (
        <Card>
          <Segmented
            options={[
              { value: 'home', label: 'Home' },
              { value: 'work', label: 'Work' },
              { value: 'favorite', label: 'Favourite' },
            ]}
            value={kind}
            onChange={setKind}
          />
          <Pressable style={styles.pick} onPress={() => setSearchOpen(true)} accessibilityRole="button">
            <Ionicons name="search" size={18} color={colors.muted} />
            <Text style={[type.body, { flex: 1 }]} numberOfLines={2}>
              {picked ? `${picked.name} — ${picked.address}` : 'Search address or landmark'}
            </Text>
          </Pressable>
          {kind === 'favorite' ? <TextField label="Label (optional)" value={label} onChangeText={(v) => setLabel(v.slice(0, 40))} placeholder="e.g. Grandma’s house" /> : null}
          <View style={styles.row}>
            <Button title="Cancel" variant="secondary" onPress={reset} disabled={busy} style={{ flex: 1 }} />
            <Button title={busy ? 'Saving…' : 'Save place'} loading={busy} disabled={!picked} onPress={() => void add()} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : (
        <Button title="+ Add place" onPress={() => setAdding(true)} style={{ marginBottom: space.md }} />
      )}

      {savedPlaces.length === 0 && !adding ? (
        <EmptyState title="No saved places yet" message="Add Home and Work for one-tap booking." />
      ) : (
        savedPlaces.map((p) => (
          <Card key={p.id} style={styles.item}>
            <Ionicons name={ICON[p.type] ?? 'location-outline'} size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>{p.name}</Text>
              <Text style={type.small} numberOfLines={2}>
                {p.address}
              </Text>
              {p.lat == null || p.lng == null ? <Text style={styles.warn}>No map position — re-add it to use it for booking.</Text> : null}
            </View>
            <Button small variant="ghost" title={deleting === p.id ? '…' : 'Remove'} disabled={deleting === p.id} onPress={() => remove(p)} />
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: space.md,
    marginVertical: space.md,
    minHeight: 48,
  },
  row: { flexDirection: 'row', gap: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  warn: { fontSize: 11, color: colors.warning, marginTop: 2 },
});
