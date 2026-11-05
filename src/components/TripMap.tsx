import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, PanResponder, StyleSheet, Text, TouchableOpacity, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { tileUrl } from '../api';
import {
  clampCamera,
  clampZoom,
  fitCamera,
  labelWidth,
  moveCamera,
  pinAt,
  project,
  routeOpacity,
  screenLine,
  tileZoomFor,
  toScreen,
  visibleTiles,
  type Camera,
  type PinSpot,
  type Point,
  type Size,
} from '../mapView';
import { C } from '../theme';

export type MapStop = { id?: string; latitude: number; longitude: number; color: string; label: string };
export type MapPlace = { latitude: number; longitude: number };
/** A stretch of the route in one driver's colour. */
export type MapSection = { color: string; path: [number, number][] };

/** The route stays clear of the buttons at the top and side, and of the routing card at the bottom. */
const FIT_PADDING = { top: 72, right: 64, bottom: 180, left: 40 };
/** How far in the recenter button goes: close enough to read street names. */
const LOCATE_ZOOM = 15;
const BUTTON_STEP = 1;
/** A finger that moves further than this is panning, not tapping. */
const TAP_SLOP = 8;
const TAP_MS = 500;
/** Wait for the map to stop moving before loading another zoom level, so a pinch doesn't pay for each one it passes. */
const TILE_SETTLE_MS = 200;
/** Past this many levels from the tiles on screen, load new ones at once rather than stretch these further. */
const MAX_TILE_STRETCH = 1.5;
/** Tiles from further away than this would be too many and too small to be worth keeping on screen. */
const MAX_LEVELS_BEHIND = 2;

/** The route's colour before anyone is set to drive. */
const DEFAULT_ROUTE_COLOR = '#E2B045';

const ATTRIBUTION = [
  { label: 'Powered by Geoapify', url: 'https://www.geoapify.com/' },
  { label: '© OpenMapTiles', url: 'https://openmaptiles.org/' },
  { label: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' },
];

/** Shown until a trip has routed stops. These pins aren't tappable, as they aren't stops on the trip. */
const SAMPLE_STOPS: MapStop[] = [
  { latitude: 21.593, longitude: -158.103, color: '#E2B045', label: 'Haleiwa' },
  { latitude: 21.652, longitude: -158.063, color: '#3AA99A', label: "Shark's" },
  { latitude: 21.665, longitude: -158.053, color: '#E26D5A', label: 'Pipeline' },
  { latitude: 21.678, longitude: -158.041, color: '#5B7CFA', label: 'Sunset' },
  { latitude: 21.705, longitude: -157.998, color: '#8B6CC4', label: 'Turtle Bay' },
];

type Pin = PinSpot & { color: string };
type TileLevels = { zoom: number; behind: number | null };

/**
 * The trip map: street map tiles, with the stops and the driving route drawn over them, or straight dashes
 * while the route is not known. Drag to pan and pinch to zoom, or use the + and - buttons. Tap a pin to select
 * its stop. The target button jumps to your location, or back to the whole route when there is no location.
 */
export function TripMap({
  stops,
  path,
  me,
  sections,
  routeColor,
  selectedId,
  onSelect,
}: {
  stops?: MapStop[];
  path?: [number, number][] | null;
  me?: MapPlace | null;
  sections?: MapSection[];
  /** The line's colour when it isn't split into stretches: the driver's, if the route has one. */
  routeColor?: string;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
} = {}) {
  const live = Boolean(stops && stops.length > 0);
  const shown = live && stops ? stops : SAMPLE_STOPS;
  const stopKey = shown.map((stop) => `${stop.latitude},${stop.longitude}`).join('|');
  const stopSpots = useMemo(() => shown.map((stop) => project(stop.latitude, stop.longitude)), [stopKey]);
  const road = useMemo(() => (path && path.length >= 2 ? path.map(([lat, lon]) => project(lat, lon)) : null), [path]);
  const drawnSections = useMemo(
    () =>
      (sections ?? [])
        .filter((section) => section.path.length >= 2)
        .map((section) => ({ color: section.color, points: section.path.map(([lat, lon]) => project(lat, lon)) })),
    [sections],
  );

  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [camera, setCamera] = useState<Camera | null>(null);
  const [settledTileZoom, setSettledTileZoom] = useState<number | null>(null);

  const cameraRef = useRef(camera);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const pinsRef = useRef<Pin[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const loadedTiles = useRef(new Set<string>());
  // Once someone moves the map, it stays where they put it until the stops change.
  const moved = useRef(false);
  const tileLevels = useRef<TileLevels | null>(null);
  const last = useRef<{ count: number; x: number; y: number; spread: number } | null>(null);
  const tap = useRef<{ x: number; y: number; at: number; alive: boolean } | null>(null);

  const move = (next: Camera) => {
    cameraRef.current = next;
    setCamera(next);
  };

  const ready = size.w > 0 && size.h > 0;
  const fitted = () => fitCamera(road ? [...road, ...stopSpots] : stopSpots, sizeRef.current, FIT_PADDING);

  useEffect(() => {
    moved.current = false;
  }, [stopKey]);

  // Show the whole route as it arrives, and when the room for the map changes.
  useEffect(() => {
    if (ready && !moved.current) move(fitted());
  }, [ready, size.w, size.h, stopKey, road]);

  // Chosen while drawing, because one frame of tiles from a far-off zoom level could be thousands of images.
  if (camera && settledTileZoom !== null) {
    const stale = Math.abs(camera.zoom - settledTileZoom) > MAX_TILE_STRETCH;
    const level = stale ? tileZoomFor(camera.zoom) : settledTileZoom;
    if (tileLevels.current?.zoom !== level) {
      tileLevels.current = { zoom: level, behind: tileLevels.current?.zoom ?? null };
    }
  }

  useEffect(() => {
    if (!camera) return;
    const showing = tileLevels.current?.zoom;
    if (showing !== undefined && showing !== settledTileZoom) {
      setSettledTileZoom(showing);
      return;
    }
    const target = tileZoomFor(camera.zoom);
    if (target === showing) return;
    const timer = setTimeout(() => setSettledTileZoom(target), TILE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [camera?.zoom, settledTileZoom]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event: GestureResponderEvent) => {
        last.current = null;
        tap.current = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY, at: Date.now(), alive: true };
      },
      onPanResponderMove: (event: GestureResponderEvent, gesture: PanResponderGestureState) => {
        const touches = event.nativeEvent.touches;
        const current = cameraRef.current;
        const screen = sizeRef.current;
        if (touches.length === 0 || !current) return;

        if (tap.current && (touches.length > 1 || Math.hypot(gesture.dx, gesture.dy) > TAP_SLOP)) tap.current.alive = false;

        const x = touches.reduce((sum, touch) => sum + touch.locationX, 0) / touches.length;
        const y = touches.reduce((sum, touch) => sum + touch.locationY, 0) / touches.length;
        const spread =
          touches.length >= 2
            ? Math.hypot(touches[0].locationX - touches[1].locationX, touches[0].locationY - touches[1].locationY)
            : 0;

        const before = last.current;
        last.current = { count: Math.min(touches.length, 2), x, y, spread };
        // A finger was added or lifted: start measuring again from here instead of jumping.
        if (!before || before.count !== last.current.count || tap.current?.alive) return;

        const zoom = before.count === 2 && before.spread > 0 ? current.zoom + Math.log2(spread / before.spread) : current.zoom;
        moved.current = true;
        // The map point that was under the fingers stays under the fingers.
        move(moveCamera(current, screen, before, { x, y }, zoom));
      },
      onPanResponderRelease: () => {
        const finished = tap.current;
        tap.current = null;
        last.current = null;
        if (!finished?.alive || Date.now() - finished.at > TAP_MS) return;
        const pin = pinAt(pinsRef.current, finished);
        onSelectRef.current?.(pin?.id ?? null);
      },
      onPanResponderTerminate: () => {
        tap.current = null;
        last.current = null;
      },
    }),
  ).current;

  const zoomBy = (step: number) => {
    if (!cameraRef.current) return;
    moved.current = true;
    move({ ...cameraRef.current, zoom: clampZoom(cameraRef.current.zoom + step) });
  };
  const recenter = () => {
    if (me) {
      moved.current = true;
      move(clampCamera({ ...project(me.latitude, me.longitude), zoom: LOCATE_ZOOM }));
    } else {
      moved.current = false;
      move(fitted());
    }
  };

  const pins: Pin[] = camera
    ? shown.map((stop, index) => ({
        ...toScreen(camera, size, stopSpots[index]),
        id: stop.id,
        label: stop.label,
        color: stop.color,
        labelAbove: index % 2 === 0,
      }))
    : [];
  pinsRef.current = pins;

  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="box-none">
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(event) => setSize({ w: event.nativeEvent.layout.width, h: event.nativeEvent.layout.height })}
        {...responder.panHandlers}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {camera && tileLevels.current ? <TileLayers camera={camera} size={size} levels={tileLevels.current} loaded={loadedTiles.current} /> : null}
          {camera ? (
            <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
              <RouteLines
                camera={camera}
                size={size}
                road={road}
                stopSpots={stopSpots}
                sections={drawnSections}
                color={routeColor ?? DEFAULT_ROUTE_COLOR}
              />
              {pins.map((pin, index) => (
                <PinMark key={`${pin.label}-${index}`} pin={pin} size={size} selected={pin.id !== undefined && pin.id === selectedId} />
              ))}
              {me ? <MeMark point={toScreen(camera, size, project(me.latitude, me.longitude))} /> : null}
            </Svg>
          ) : null}
        </View>
      </View>

      <View style={styles.controls} pointerEvents="box-none">
        <MapButton icon="plus" label="Zoom in" onPress={() => zoomBy(BUTTON_STEP)} />
        <MapButton icon="minus" label="Zoom out" onPress={() => zoomBy(-BUTTON_STEP)} />
        <MapButton icon="crosshairs-gps" label="Go to my location" onPress={recenter} />
      </View>

      <View style={styles.attribution} pointerEvents="box-none">
        {ATTRIBUTION.map((item) => (
          <Text key={item.label} style={styles.attributionText} onPress={() => void Linking.openURL(item.url)}>
            {item.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * The street map. While a new zoom level loads, the tiles already loaded from the last one stay underneath,
 * so the map doesn't flash empty.
 */
function TileLayers({
  camera,
  size,
  levels,
  loaded,
}: {
  camera: Camera;
  size: Size;
  levels: TileLevels;
  loaded: Set<string>;
}) {
  const behind =
    levels.behind === null || Math.abs(levels.behind - levels.zoom) > MAX_LEVELS_BEHIND
      ? []
      : visibleTiles(camera, size, levels.behind).filter((tile) => loaded.has(tile.key));
  const front = visibleTiles(camera, size, levels.zoom);
  return (
    <>
      {[...behind, ...front].map((tile) => (
        <Image
          key={tile.key}
          source={{ uri: tileUrl(tile.z, tile.x, tile.y) }}
          fadeDuration={0}
          onLoad={() => loaded.add(tile.key)}
          style={{ position: 'absolute', left: tile.left, top: tile.top, width: tile.width, height: tile.height }}
        />
      ))}
    </>
  );
}

function RouteLines({
  camera,
  size,
  road,
  stopSpots,
  sections,
  color,
}: {
  camera: Camera;
  size: Size;
  road: Point[] | null;
  stopSpots: Point[];
  sections: { color: string; points: Point[] }[];
  color: string;
}) {
  const whole = screenLine(road ?? stopSpots, camera, size);
  if (!whole) return null;
  const opacity = routeOpacity(camera.zoom);
  return (
    <>
      <Path d={whole} stroke="#FFFFFF" strokeOpacity={opacity.edge} strokeWidth={12} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {sections.length >= 2 ? (
        // One colour per driver: a change of colour is a change of driver.
        sections.map((section, index) => {
          const d = screenLine(section.points, camera, size);
          return d ? (
            <Path
              key={`${section.color}-${index}`}
              d={d}
              stroke={section.color}
              strokeOpacity={opacity.line}
              strokeWidth={7}
              fill="none"
              strokeLinecap="butt"
              strokeLinejoin="round"
            />
          ) : null;
        })
      ) : (
        <Path
          d={whole}
          stroke={color}
          strokeOpacity={opacity.line}
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={road ? undefined : '1 14'}
        />
      )}
    </>
  );
}

function PinMark({ pin, size, selected }: { pin: Pin; size: Size; selected: boolean }) {
  if (pin.x < -80 || pin.x > size.w + 80 || pin.y < -60 || pin.y > size.h + 60) return null;
  const width = labelWidth(pin.label);
  return (
    <G transform={`translate(${pin.x.toFixed(1)} ${pin.y.toFixed(1)})`}>
      <Rect x={-width / 2} y={pin.labelAbove ? -36 : 16} width={width} height={20} rx={8} fill="#FFFFFF" />
      <SvgText x={0} y={pin.labelAbove ? -22 : 30} fontSize="11" fontWeight="700" textAnchor="middle" fill={C.ink}>
        {pin.label}
      </SvgText>
      {selected ? <Circle cx={0} cy={0} r={15} fill={pin.color} fillOpacity={0.3} /> : null}
      <Circle cx={0} cy={0} r={9} fill="#FFFFFF" />
      <Circle cx={0} cy={0} r={6} fill={pin.color} />
    </G>
  );
}

function MeMark({ point }: { point: Point }) {
  return (
    <G transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`}>
      <Circle cx={0} cy={0} r={16} fill="#2F80ED" fillOpacity={0.18} />
      <Circle cx={0} cy={0} r={8} fill="#FFFFFF" />
      <Circle cx={0} cy={0} r={5.5} fill="#2F80ED" />
    </G>
  );
}

function MapButton({ icon, label, onPress }: { icon: 'plus' | 'minus' | 'crosshairs-gps'; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.85} accessibilityLabel={label}>
      <MaterialCommunityIcons name={icon} size={20} color={C.teal} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  controls: {
    position: 'absolute',
    top: 112,
    right: 16,
    gap: 8,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attribution: {
    position: 'absolute',
    left: 16,
    right: 16,
    // The itinerary sheet overlaps the bottom of the map by this much. The credits must stay visible above it.
    bottom: 19,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    columnGap: 6,
  },
  attributionText: {
    fontSize: 9,
    lineHeight: 14,
    color: C.body,
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 3,
    borderRadius: 3,
  },
});
