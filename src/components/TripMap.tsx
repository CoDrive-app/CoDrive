import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { C } from '../theme';

export type MapStop = {
  id: string;
  title: string;
  x: number;
  y: number;
  pin: string;
  going: boolean;
};

function routePath(stops: MapStop[]) {
  const points = stops.filter((stop) => stop.going);
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    const cx = (from.x + to.x) / 2;
    const cy = (from.y + to.y) / 2 - (to.x - from.x) * 0.12;
    d += ` Q ${cx} ${cy} ${to.x} ${to.y}`;
  }
  return d;
}

function shortTitle(title: string) {
  return title.length > 16 ? `${title.slice(0, 15)}…` : title;
}

export function TripMap({
  stops,
  draft,
  onPick,
}: {
  stops: MapStop[];
  draft?: { x: number; y: number } | null;
  onPick?: (x: number, y: number) => void;
}) {
  const route = routePath(stops);
  const size = useRef({ width: 1, height: 1 });
  return (
    <View
      style={styles.fill}
      onLayout={(event) => {
        size.current = {
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        };
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
        <Rect width="100" height="100" fill="#D7E6C6" />
        <Ellipse cx="8" cy="14" rx="28" ry="18" fill="#EAF3E0" />
        <Ellipse cx="82" cy="8" rx="32" ry="20" fill="#C5D9B0" />
        <Ellipse cx="54" cy="50" rx="40" ry="24" fill="#C9DEB6" />
        <Ellipse cx="18" cy="82" rx="34" ry="20" fill="#E4F0D8" />
        <Ellipse cx="86" cy="72" rx="28" ry="24" fill="#B7D0A2" />
        <Ellipse cx="94" cy="6" rx="16" ry="12" fill="#C5DDD4" />
        {route ? (
          <Path d={route} stroke="#F7FBF3" strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
        {route ? (
          <Path d={route} stroke="#E2B045" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
      </Svg>
      {stops.map((stop) => (
        <View
          key={stop.id}
          pointerEvents="none"
          style={[styles.pinWrap, { left: `${stop.x}%`, top: `${stop.y}%` }]}
        >
          <View style={[styles.label, !stop.going && styles.labelSkipped]}>
            <Text style={[styles.labelText, !stop.going && styles.labelTextSkipped]} numberOfLines={1}>
              {shortTitle(stop.title)}
            </Text>
          </View>
          <View style={[styles.pinOuter, { borderColor: stop.going ? stop.pin : '#C9C3BA' }]}>
            <View style={[styles.pinInner, { backgroundColor: stop.going ? stop.pin : '#E7E2DA' }]} />
          </View>
        </View>
      ))}
      {onPick ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Drop a pin"
          onPress={(event) => {
            const { locationX, locationY } = event.nativeEvent;
            const { width, height } = size.current;
            onPick(
              Math.min(96, Math.max(4, (locationX / width) * 100)),
              Math.min(96, Math.max(4, (locationY / height) * 100)),
            );
          }}
        />
      ) : null}
      {draft ? (
        <View pointerEvents="none" style={[styles.pinWrap, { left: `${draft.x}%`, top: `${draft.y}%` }]}>
          <View style={styles.draftLabel}>
            <Text style={styles.draftText}>New stop</Text>
          </View>
          <View style={[styles.pinOuter, styles.draftOuter]}>
            <View style={[styles.pinInner, { backgroundColor: C.teal }]} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: C.map,
    overflow: 'hidden',
  },
  pinWrap: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  label: {
    position: 'absolute',
    bottom: 16,
    backgroundColor: C.white,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 120,
  },
  labelSkipped: {
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  labelText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.ink,
  },
  labelTextSkipped: {
    color: C.muted,
  },
  pinOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.white,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  draftLabel: {
    position: 'absolute',
    bottom: 16,
    backgroundColor: C.teal,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  draftText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.white,
  },
  draftOuter: {
    borderColor: C.teal,
  },
});
