import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { C, layout } from '../theme';
import type { Trip } from '../types';
import { currentDriver, isRouteEnd } from '../journey';
import { PrimaryButton } from '../components/Buttons';
import { TripMap } from '../components/TripMap';

export function DriveScreen({
  trip,
  fullMap,
  note,
  onRotation,
  onSwap,
  onToggleGoing,
  onConnection,
  onStart,
}: {
  trip: Trip;
  fullMap: boolean;
  note: string | null;
  onRotation: () => void;
  onSwap: () => void;
  onToggleGoing: (id: string) => void;
  onConnection: () => void;
  onStart: () => void;
}) {
  const driver = currentDriver(trip);

  if (trip.status !== 'live') {
    return (
      <View style={styles.gate}>
        <Text style={styles.gateTitle}>This journey hasn’t started</Text>
        <Text style={styles.gateBody}>
          Check the route, crew, dates, and budget. Launch from here once everything looks good.
        </Text>
        <PrimaryButton
          label="Review and start"
          onPress={onStart}
          icon={<MaterialCommunityIcons name="flag-checkered" size={18} color={C.white} />}
        />
      </View>
    );
  }

  return (
    <View style={layout.fill}>
      <View style={[styles.mapWrap, fullMap && layout.fill]}>
        <TripMap stops={trip.waypoints} />
        <View style={styles.driverPill}>
          <View style={[styles.mini, { backgroundColor: driver?.color ?? C.teal }]} />
          <Text style={styles.driverText}>{driver?.name ?? 'Crew'} driving</Text>
        </View>
        <View style={styles.tools}>
          <TouchableOpacity style={styles.tool} onPress={onConnection} activeOpacity={0.85}>
            <MaterialCommunityIcons name="bluetooth" size={18} color={C.teal} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tool, styles.toolSun]} onPress={onSwap} activeOpacity={0.85} accessibilityLabel="Swap drivers">
            <MaterialCommunityIcons name="steering" size={18} color={C.orange} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.tool} onPress={onRotation} activeOpacity={0.85} accessibilityLabel="Driver rotation reminder">
            <MaterialCommunityIcons name="timer-outline" size={18} color={C.teal} />
          </TouchableOpacity>
        </View>
        {note ? (
          <View style={styles.note}>
            <Text style={styles.noteText} numberOfLines={1}>
              {note}
            </Text>
          </View>
        ) : null}
        {!fullMap ? (
          <View style={styles.routing}>
            <Text style={styles.routingTitle}>Routing {trip.routeName}</Text>
            <Text style={styles.routingLeg}>{trip.leg}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(trip.progress * 100)}%` }]} />
            </View>
            <Text style={styles.pct}>{Math.round(trip.progress * 100)}% Complete</Text>
          </View>
        ) : null}
      </View>

      {!fullMap ? (
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Today's Itinerary</Text>
          <ScrollView style={layout.fill} contentContainerStyle={styles.itinerary} showsVerticalScrollIndicator={false}>
            {trip.waypoints.map((stop, index) => (
              <View key={stop.id} style={styles.row}>
                <View style={styles.rail}>
                  <View style={[styles.dot, { backgroundColor: stop.going ? stop.pin : '#E4DFD6' }]} />
                  {index < trip.waypoints.length - 1 ? <View style={styles.line} /> : null}
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.stopTitle, !stop.going && styles.stopSkipped]}>{stop.title}</Text>
                  <Text style={styles.stopMeta}>{stop.going ? stop.stop : 'Passing by'}</Text>
                  {isRouteEnd(stop) ? null : (
                    <TouchableOpacity onPress={() => onToggleGoing(stop.id)} activeOpacity={0.75}>
                      <Text style={styles.toggle}>{stop.going ? 'Skip this stop' : 'Stop here'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.time}>{stop.time}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.eta}>
            <Text style={styles.etaValue}>{trip.duration}</Text>
            <Text style={styles.etaSub}>Live with your crew · weather along the route</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  gateTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.4,
  },
  gateBody: {
    fontSize: 15,
    lineHeight: 22,
    color: C.muted,
    marginBottom: 8,
  },
  mapWrap: {
    flex: 1.05,
    backgroundColor: C.map,
  },
  driverPill: {
    position: 'absolute',
    top: 12,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.white,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  mini: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  driverText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.ink,
  },
  tools: {
    position: 'absolute',
    top: 12,
    right: 16,
    gap: 8,
  },
  tool: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolSun: {
    backgroundColor: C.sun,
  },
  note: {
    position: 'absolute',
    top: 50,
    left: 16,
    maxWidth: 176,
    backgroundColor: C.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  noteText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.ink,
  },
  routing: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    backgroundColor: '#1B3129',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  routingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.white,
  },
  routingLeg: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.78)',
  },
  track: {
    marginTop: 10,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#3DDEC8',
  },
  pct: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#D7F7F0',
  },
  sheet: {
    flex: 1,
    marginTop: -18,
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
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
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.ink,
    marginBottom: 14,
  },
  itinerary: {
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rail: {
    width: 16,
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: '#E4DFD6',
    marginTop: 4,
  },
  copy: {
    flex: 1,
    paddingBottom: 16,
  },
  stopTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.ink,
  },
  stopMeta: {
    marginTop: 2,
    fontSize: 12,
    color: C.muted,
  },
  stopSkipped: {
    color: C.muted,
  },
  toggle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: C.teal,
  },
  time: {
    fontSize: 13,
    fontWeight: '700',
    color: C.teal,
  },
  eta: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    paddingTop: 12,
    paddingBottom: 12,
  },
  etaValue: {
    fontSize: 22,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.4,
  },
  etaSub: {
    marginTop: 2,
    fontSize: 12,
    color: C.muted,
  },
});
