import Svg, { G, Path, Rect } from 'react-native-svg';
import { C } from '../theme';

/** A little cartoon trash can in grey line art, with its lid knocked slightly askew. */
export function TrashIcon({ size = 24, color = C.muted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <G transform="rotate(-10 4 8)">
        <Rect x={3.5} y={5.6} width={17} height={2.8} rx={1.4} />
        <Path d="M9.6 5.6 Q9.6 3.4 12 3.4 Q14.4 3.4 14.4 5.6" />
      </G>
      <Path d="M5.8 10.2 L7.2 19.6 Q7.5 21.2 9.1 21.2 H14.9 Q16.5 21.2 16.8 19.6 L18.2 10.2" />
      <Path d="M10 12.6 L10.3 18.4 M14 12.6 L13.7 18.4" />
    </Svg>
  );
}
