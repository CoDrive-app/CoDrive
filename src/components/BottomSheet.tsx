import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';

/** Tall enough to show the handle, the title, the Find Gas / Food / Rest buttons, and the trip summary underneath. */
export const COLLAPSED_HEIGHT = 194;
const TAP_SLOP = 6;
/** How far ahead a flick carries the sheet, in milliseconds of its release speed. */
const FLICK_MS = 150;

/**
 * A panel that sits at the bottom of the screen and can be dragged up and down by its handle and title.
 * It settles on one of three heights: tucked away, half the screen, or most of the screen.
 * A tap on the handle toggles between tucked away and half. `containerHeight` is the room it may use.
 */
export function BottomSheet({
  title,
  containerHeight,
  children,
}: {
  title: string;
  containerHeight: number;
  children: ReactNode;
}) {
  const snaps = useMemo(() => {
    const full = Math.max(COLLAPSED_HEIGHT + 80, containerHeight * 0.7);
    const half = Math.min(full - 40, Math.max(COLLAPSED_HEIGHT + 60, containerHeight * 0.48));
    return [COLLAPSED_HEIGHT, half, full];
  }, [containerHeight]);

  const snapsRef = useRef(snaps);
  snapsRef.current = snaps;
  const index = useRef(1);
  const height = useRef(new Animated.Value(snaps[1])).current;
  const current = useRef(snaps[1]);
  const start = useRef(snaps[1]);

  useEffect(() => {
    const id = height.addListener(({ value }) => {
      current.current = value;
    });
    return () => height.removeListener(id);
  }, [height]);

  // The screen was measured or turned: keep the sheet on the same stop.
  useEffect(() => {
    height.setValue(snaps[index.current]);
  }, [snaps, height]);

  const settle = (to: number) => {
    index.current = to;
    Animated.spring(height, { toValue: snapsRef.current[to], bounciness: 4, speed: 14, useNativeDriver: false }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        height.stopAnimation();
        start.current = current.current;
      },
      onPanResponderMove: (_event: unknown, gesture: { dy: number }) => {
        const [low, , high] = snapsRef.current;
        height.setValue(Math.min(high, Math.max(low, start.current - gesture.dy)));
      },
      onPanResponderRelease: (_event: unknown, gesture: { dx: number; dy: number; vy: number }) => {
        if (Math.abs(gesture.dx) < TAP_SLOP && Math.abs(gesture.dy) < TAP_SLOP) {
          settle(index.current === 0 ? 1 : 0);
          return;
        }
        // Dragging down has a positive speed and makes the sheet shorter.
        const aimed = current.current - gesture.vy * FLICK_MS;
        let best = 0;
        snapsRef.current.forEach((snap, i) => {
          if (Math.abs(snap - aimed) < Math.abs(snapsRef.current[best] - aimed)) best = i;
        });
        settle(best);
      },
    }),
  ).current;

  return (
    <Animated.View style={[styles.sheet, { height }]}>
      <View {...pan.panHandlers} style={styles.grab} accessibilityLabel="Drag to open or close the itinerary">
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    marginTop: -18,
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    overflow: 'hidden',
  },
  grab: {
    // A generous area to grab, wider than the little bar itself.
    paddingBottom: 6,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E4DFD6',
    marginBottom: 12,
    marginTop: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: C.ink,
    marginBottom: 8,
  },
});
