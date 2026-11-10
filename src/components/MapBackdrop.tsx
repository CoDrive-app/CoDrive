import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

// Every shade is a step lighter or darker than the app's cream (#F4F1EB), so the map reads as texture.
const STREET = '#EAE5DA';
const CASING = '#E4DDCF';
const ROAD = '#F8F6F1';
const BLOCK = '#EEE9DF';
const WATER = '#F9F7F2';
const CONTOUR = '#E7E1D5';
const ROUTE = '#DDD5C4';

const GRID_V = Array.from({ length: 15 }, (_, index) => -160 + index * 52);
const GRID_H = Array.from({ length: 20 }, (_, index) => -260 + index * 58);

/** A faint, fixed map-style texture for behind the Home screen. */
export function MapBackdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
        {/* Terrain contours, top right and lower left */}
        <G fill="none" stroke={CONTOUR} strokeWidth={1}>
          <Ellipse cx={360} cy={90} rx={150} ry={96} />
          <Ellipse cx={360} cy={90} rx={112} ry={70} />
          <Ellipse cx={360} cy={90} rx={74} ry={44} />
          <Ellipse cx={360} cy={90} rx={36} ry={20} />
          <Ellipse cx={30} cy={720} rx={170} ry={110} />
          <Ellipse cx={30} cy={720} rx={126} ry={80} />
          <Ellipse cx={30} cy={720} rx={82} ry={50} />
        </G>

        {/* A winding river */}
        <Path
          d="M-20 560 C60 520 110 600 190 560 C270 520 300 440 410 470"
          stroke={WATER}
          strokeWidth={26}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M-20 560 C60 520 110 600 190 560 C270 520 300 440 410 470"
          stroke={CASING}
          strokeWidth={1}
          fill="none"
          strokeDasharray="3 5"
          strokeLinecap="round"
        />

        {/* City blocks and parks */}
        <G transform="rotate(-14 195 422)">
          <Rect x={40} y={150} width={92} height={64} rx={8} fill={BLOCK} />
          <Rect x={236} y={238} width={70} height={92} rx={8} fill={BLOCK} />
          <Rect x={92} y={640} width={110} height={58} rx={8} fill={BLOCK} />
          <Rect x={284} y={600} width={76} height={70} rx={8} fill={BLOCK} />

          {/* Minor street grid */}
          <G stroke={STREET} strokeWidth={1}>
            {GRID_V.map((x) => (
              <Line key={`v${x}`} x1={x} y1={-300} x2={x} y2={1150} />
            ))}
            {GRID_H.map((y) => (
              <Line key={`h${y}`} x1={-220} y1={y} x2={620} y2={y} />
            ))}
          </G>

          {/* Main avenues */}
          <Line x1={-220} y1={296} x2={620} y2={296} stroke={CASING} strokeWidth={9} />
          <Line x1={-220} y1={296} x2={620} y2={296} stroke={ROAD} strokeWidth={6} />
          <Line x1={188} y1={-300} x2={188} y2={1150} stroke={CASING} strokeWidth={9} />
          <Line x1={188} y1={-300} x2={188} y2={1150} stroke={ROAD} strokeWidth={6} />
        </G>

        {/* A curved highway */}
        <Path
          d="M-20 250 C110 270 160 420 250 520 C310 585 360 640 420 650"
          stroke={CASING}
          strokeWidth={11}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M-20 250 C110 270 160 420 250 520 C310 585 360 640 420 650"
          stroke={ROAD}
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
        />

        {/* A planned route with stops */}
        <Path
          d="M46 770 C110 700 120 640 180 610 C250 575 290 500 330 430"
          stroke={ROUTE}
          strokeWidth={3}
          fill="none"
          strokeDasharray="2 7"
          strokeLinecap="round"
        />
        <Circle cx={46} cy={770} r={7} fill={ROAD} stroke={ROUTE} strokeWidth={2} />
        <Circle cx={180} cy={610} r={5} fill={ROAD} stroke={ROUTE} strokeWidth={2} />
        <Circle cx={330} cy={430} r={7} fill={ROAD} stroke={ROUTE} strokeWidth={2} />
      </Svg>
    </View>
  );
}
