import type { StopCategory } from './types';
import { StyleSheet, type ViewStyle } from 'react-native';

export const C = {
  cream: '#F4F1EB',
  white: '#FFFFFF',
  ink: '#1C1917',
  body: '#3F3A36',
  muted: '#7C776F',
  faint: '#A39E96',
  line: '#E7E2DA',
  teal: '#0E9F8A',
  orange: '#E8832C',
  sun: '#FFF3D0',
  rest: '#F1EEE8',
  map: '#D7E6C6',
  field: '#F6F3EE',
};

/**
 * One colour per kind of stop, used for the category chips, the outline of stop cards and the map pins.
 * Chosen to stay clear of the crew colours, which mark drivers on the route.
 */
export const CATEGORY_COLORS: Record<StopCategory, string> = {
  food: '#F2711C',
  gas: '#C2185B',
  beach: '#0096D6',
  sights: '#3E9B47',
  lodging: '#8D6E63',
};

export const cardShadow: ViewStyle = {
  shadowColor: '#1C1917',
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  elevation: 2,
};

export const layout = StyleSheet.create({
  fill: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  section: {
    marginTop: 28,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '700',
    color: C.ink,
  },
  dock: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: C.cream,
  },
});
