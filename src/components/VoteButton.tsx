import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

const INK = '#3B2A1E';

const LOOK = {
  up: {
    // Pale and sleepy when idle, bright and beaming when chosen.
    idleHand: '#FFE9A6',
    onHand: '#FFD23F',
    idlePill: '#E4F7EA',
    onPill: '#5BD68A',
    cuff: '#4FC3F7',
    tilt: '-8deg',
  },
  down: {
    idleHand: '#FFD3CE',
    onHand: '#FF8A7A',
    idlePill: '#FDE6E6',
    onPill: '#FF7B8A',
    cuff: '#B388FF',
    tilt: '8deg',
  },
} as const;

/** A chunky cartoon hand with a sleeve cuff, rosy cheeks, and a face. The thumb points up or down. */
function Hand({ kind, active }: { kind: 'up' | 'down'; active: boolean }) {
  const look = LOOK[kind];
  const hand = active ? look.onHand : look.idleHand;
  return (
    <Svg width={28} height={28} viewBox="0 0 32 32">
      {/* Turning the drawing upside down makes the thumb point down. */}
      <G transform={kind === 'down' ? 'translate(0 32) scale(1 -1)' : undefined}>
        <Path
          d="M11 15 L14.6 6.4 C15.2 4.9 17 4.4 18.2 5.4 C19.1 6.2 19.2 7.4 18.9 8.4 L17.7 12 H25 C26.9 12 28.2 13.7 27.8 15.5 L26.2 24 C25.9 25.8 24.4 27.2 22.6 27.2 H11 Z"
          fill={hand}
          stroke={INK}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        <Path d="M3 14.5 H10.5 A1.5 1.5 0 0 1 12 16 V27 A1.5 1.5 0 0 1 10.5 28.5 H3 A1.5 1.5 0 0 1 1.5 27 V16 A1.5 1.5 0 0 1 3 14.5 Z" fill={look.cuff} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
        <Path d="M4.2 17.5 V25" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" opacity={0.7} />
        {/* A shine on the thumb. */}
        <Path d="M16.4 8.2 L15.6 10.6" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" opacity={0.85} />
      </G>
      {/* The face stays the right way up. */}
      <Circle cx={18.6} cy={kind === 'up' ? 19 : 13} r={1.3} fill={INK} />
      <Circle cx={23.4} cy={kind === 'up' ? 19 : 13} r={1.3} fill={INK} />
      <Circle cx={18.2} cy={kind === 'up' ? 18.5 : 12.5} r={0.45} fill="#FFFFFF" />
      <Circle cx={23} cy={kind === 'up' ? 18.5 : 12.5} r={0.45} fill="#FFFFFF" />
      <Ellipse cx={17} cy={kind === 'up' ? 21.4 : 15.4} rx={1.5} ry={0.9} fill="#FF6F91" opacity={0.7} />
      <Ellipse cx={25} cy={kind === 'up' ? 21.4 : 15.4} rx={1.5} ry={0.9} fill="#FF6F91" opacity={0.7} />
      <Path
        d={kind === 'up' ? 'M19.4 21.2 Q21 23.6 22.6 21.2' : 'M19.4 16.2 Q21 13.8 22.6 16.2'}
        stroke={INK}
        strokeWidth={1.3}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * A cartoon thumb on a candy-coloured pill, with its count beside it.
 * Choosing it makes the pill bright, tilts the hand a little, and gives a happy bounce.
 */
export function VoteButton({
  kind,
  active,
  count,
  onPress,
  label,
}: {
  kind: 'up' | 'down';
  active: boolean;
  count: number;
  onPress: () => void;
  label: string;
}) {
  const look = LOOK[kind];
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!active) return;
    const native = Platform.OS !== 'web';
    Animated.sequence([
      Animated.timing(pop, { toValue: 1.4, duration: 90, useNativeDriver: native }),
      Animated.spring(pop, { toValue: 1, bounciness: 16, speed: 18, useNativeDriver: native }),
    ]).start();
  }, [active, pop]);

  const shown = Number.isFinite(count) ? count : 0;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.pill, { backgroundColor: active ? look.onPill : look.idlePill, borderColor: active ? INK : 'transparent' }]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      {/* The drawing sits on top of the pill. It must not take the click, or the thumb itself does nothing. */}
      <Animated.View pointerEvents="none" style={{ transform: [{ scale: pop }, { rotate: active ? look.tilt : '0deg' }] }}>
        <Hand kind={kind} active={active} />
      </Animated.View>
      <Text pointerEvents="none" style={[styles.count, active && styles.countOn]}>{shown}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 5,
    paddingRight: 12,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
  },
  count: {
    fontSize: 14,
    fontWeight: '800',
    color: INK,
    opacity: 0.55,
  },
  countOn: {
    opacity: 1,
  },
});
