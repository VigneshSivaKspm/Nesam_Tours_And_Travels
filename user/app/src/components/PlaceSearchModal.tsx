// Full-screen place picker: current location, saved places, recent places and
// debounced Photon search (native port of user/web PlaceSearch.tsx).
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { GeoPlace, LatLng, LocationItem } from '../types';
import { searchPlaces } from '../services/geoService';
import { isValidLatLng } from '../utils/geo';
import { isOnline } from '../utils/network';
import { colors, radius, space, type } from '../theme';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSelect: (place: GeoPlace) => void;
  savedPlaces?: LocationItem[];
  recentPlaces?: GeoPlace[];
  near?: LatLng | null;
  onUseCurrentLocation?: () => void;
  /** Text to search for as soon as the picker opens (e.g. “airport”). */
  initialQuery?: string;
}

type Row =
  | { key: string; kind: 'current' }
  | { key: string; kind: 'header'; label: string }
  | { key: string; kind: 'place'; place: LocationItem; icon: keyof typeof Ionicons.glyphMap };

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  work: 'briefcase-outline',
  favorite: 'star-outline',
  airport: 'airplane-outline',
  recent: 'time-outline',
};

export function PlaceSearchModal(props: Props) {
  // The body mounts fresh each time the picker opens, so it starts empty.
  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      {props.visible ? <PlaceSearchBody {...props} /> : null}
    </Modal>
  );
}

const NO_RESULTS: GeoPlace[] = [];

interface SearchState {
  query: string;
  results: GeoPlace[];
  error: string;
}

function PlaceSearchBody({ title, onClose, onSelect, savedPlaces = [], recentPlaces = [], near, onUseCurrentLocation, initialQuery = '' }: Props) {
  const [text, setText] = useState(initialQuery);
  // Results are tagged with the query they answer; anything else is stale.
  const [search, setSearch] = useState<SearchState>({ query: '', results: [], error: '' });
  const q = text.trim();
  const active = q.length >= 3;
  const settled = active && search.query === q;
  const results = settled ? search.results : NO_RESULTS;
  const error = settled ? search.error : '';
  const loading = active && !settled;

  // Debounced search; stale requests are aborted.
  useEffect(() => {
    if (q.length < 3) return undefined;
    const controller = new AbortController();
    const t = setTimeout(() => {
      searchPlaces(q, near ?? null, controller.signal)
        .then((r) => {
          if (!controller.signal.aborted) {
            setSearch({ query: q, results: r, error: r.length ? '' : 'No places found. Try a landmark, area or city name.' });
          }
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setSearch({
            query: q,
            results: [],
            error: isOnline() ? 'Search is temporarily unavailable. Please try again.' : 'You’re offline — search needs a connection.',
          });
        });
    }, 400);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q, near?.lat, near?.lng]); // eslint-disable-line react-hooks/exhaustive-deps -- coordinates, not the object identity

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (!active) {
      if (onUseCurrentLocation) out.push({ key: 'current', kind: 'current' });
      if (savedPlaces.length) {
        out.push({ key: 'h-saved', kind: 'header', label: 'Saved places' });
        for (const p of savedPlaces) out.push({ key: `s-${p.id}`, kind: 'place', place: p, icon: TYPE_ICON[p.type] ?? 'location-outline' });
      }
      if (recentPlaces.length) {
        out.push({ key: 'h-recent', kind: 'header', label: 'Recent' });
        for (const p of recentPlaces) out.push({ key: `r-${p.id}`, kind: 'place', place: p, icon: 'time-outline' });
      }
    } else {
      for (const p of results) out.push({ key: `q-${p.id}`, kind: 'place', place: p, icon: p.type === 'airport' ? 'airplane-outline' : 'location-outline' });
    }
    return out;
  }, [active, results, savedPlaces, recentPlaces, onUseCurrentLocation]);

  const pick = (p: LocationItem) => {
    if (!isValidLatLng(p as Partial<LatLng>)) return;
    onSelect(p as GeoPlace);
    onClose();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="arrow-back" size={24} color={colors.ink} />
          </Pressable>
          <Text style={[type.h3, { flex: 1 }]}>{title}</Text>
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Search area, landmark or address"
            placeholderTextColor={colors.faint}
            autoFocus
            style={styles.input}
            returnKeyType="search"
            autoCorrect={false}
          />
          {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            if (item.kind === 'header') return <Text style={styles.group}>{item.label}</Text>;
            if (item.kind === 'current') {
              return (
                <Pressable
                  style={styles.row}
                  onPress={() => {
                    onUseCurrentLocation?.();
                    onClose();
                  }}
                  accessibilityRole="button"
                >
                  <Ionicons name="locate" size={20} color={colors.info} />
                  <Text style={[styles.name, { color: colors.info }]}>Use current location</Text>
                </Pressable>
              );
            }
            const usable = isValidLatLng(item.place as Partial<LatLng>);
            return (
              <Pressable style={[styles.row, !usable && { opacity: 0.5 }]} onPress={() => pick(item.place)} accessibilityRole="button" disabled={!usable}>
                <Ionicons name={item.icon} size={20} color={colors.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.place.name}
                  </Text>
                  <Text style={type.small} numberOfLines={2}>
                    {usable ? item.place.address : 'No map position — re-save this place from search.'}
                  </Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            !active ? <Text style={styles.hint}>Type at least 3 letters to search.</Text> : null
          }
        />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.card },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
  },
  input: { flex: 1, fontSize: 15, color: colors.ink },
  error: { color: colors.primaryDark, marginHorizontal: space.lg, marginTop: space.sm, fontSize: 13 },
  group: { ...type.small, fontWeight: '800', textTransform: 'uppercase', paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56 },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  hint: { ...type.small, textAlign: 'center', marginTop: space.xl },
});
