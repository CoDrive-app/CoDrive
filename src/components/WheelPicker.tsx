import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';

const ITEM_HEIGHT = 34;
const ROWS = 3;
const SETTLE_MS = 120;

/**
 * A scroll wheel of whole numbers that snaps to one at a time, with the chosen one in the middle band.
 * `count` numbers are offered, starting at `min` (0 unless given) and going up by `step` (1 unless given).
 * A value between steps shows at the nearest one. The parent owns `value`.
 */
export function WheelPicker({
  value,
  count,
  min = 0,
  onChange,
  label,
  unit,
  pad,
  step = 1,
}: {
  value: number;
  count: number;
  /** The lowest number on the wheel. */
  min?: number;
  onChange: (value: number) => void;
  /** Read out by screen readers, like "Hours". */
  label: string;
  /** Small text beside the wheel, like "hr". */
  unit: string;
  /** Pad numbers with a leading zero, like 05. */
  pad?: boolean;
  /** How far apart the numbers are, like 5 for 0, 5, 10… */
  step?: number;
}) {
  const scroller = useRef<ScrollView>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Position on the wheel, counting from the top.
  const safe = Math.min(Math.max(Math.round((value - min) / step), 0), count - 1);
  const at = (index: number) => min + index * step;

  // Keep the wheel on the value when it changes from outside, or when the number of choices changes.
  useEffect(() => {
    scroller.current?.scrollTo({ y: safe * ITEM_HEIGHT, animated: false });
  }, [safe, count]);

  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );

  // Wait for the scrolling to stop, then read which number is in the middle.
  const onScroll = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = event.nativeEvent.contentOffset.y;
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const next = Math.min(count - 1, Math.max(0, Math.round(y / ITEM_HEIGHT)));
      if (next !== safe) onChange(at(next));
    }, SETTLE_MS);
  };

  return (
    <View style={styles.wrap} accessibilityLabel={`${label}: ${at(safe)}`}>
      <View style={styles.wheel}>
        <View pointerEvents="none" style={styles.band} />
        <ScrollView
          ref={scroller}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onScroll}
          contentOffset={{ x: 0, y: safe * ITEM_HEIGHT }}
          contentContainerStyle={styles.content}
        >
          {Array.from({ length: count }, (_, index) => (
            <View key={index} style={styles.item}>
              <Text style={[styles.number, index === safe && styles.numberOn]}>
                {pad ? String(at(index)).padStart(2, '0') : at(index)}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <Text style={styles.unit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  wheel: {
    width: 48,
    height: ITEM_HEIGHT * ROWS,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    top: ITEM_HEIGHT,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderRadius: 10,
    backgroundColor: C.field,
  },
  content: {
    paddingVertical: ITEM_HEIGHT,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontSize: 17,
    color: C.faint,
  },
  numberOn: {
    fontWeight: '700',
    color: C.ink,
  },
  unit: {
    fontSize: 13,
    fontWeight: '600',
    color: C.muted,
  },
});
