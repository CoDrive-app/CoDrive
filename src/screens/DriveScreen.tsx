import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { C, layout } from '../theme';
import type { Trip } from '../types';
import { BottomSheet } from '../components/BottomSheet';
import { StopCard } from '../components/StopCard';
import { TripMap } from '../components/TripMap';
import { drivingStops, duration, miles, routedStops, schedule, shortLabel } from '../route';
import { legAt, OFF_ROUTE_METERS, progressAlong } from '../progress';
import { useCarPosition } from '../useCarPosition';
import { currentDrivers } from '../drivers';
import { driverAt, planDriverLegs, sectionsFor } from '../driverLegs';
import { hasEndpoints } from '../stops';
import { useRoute } from '../useRoute';

export function DriveScreen({
  trip,
  fullMap,
  note,
  onRotation,
  onConnection,
}: {
  trip: Trip;
  fullMap: boolean;
  note: string | null;
  onRotation: () => void;
  onConnection: () => void;
}) {
  const [height, setHeight] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const drivers = currentDrivers(trip);
  const ready = hasEndpoints(trip);
  const stops = routedStops(trip);
  const { plan, failed, loading } = useRoute(stops);
  const itinerary = drivingStops(trip);
  const { position, status: locationStatus } = useCarPosition(plan !== null);

  // How far along the route the car is, from its real location.
  const along = plan && position ? progressAlong(plan.path, position) : null;
  const onRoute = along !== null && along.offRouteMeters <= OFF_ROUTE_METERS;
  const fraction = onRoute ? along.fraction : 0;
  const legIndex = plan && onRoute ? legAt(plan.legs, fraction * plan.distanceMeters) : 0;

  const progressText = !plan
    ? stops.length >= 2
      ? failed
        ? 'Route unavailable'
        : 'Finding the route…'
      : ready
        ? 'Select 2 stops with locations to track progress'
        : 'Add a start and end to build the route'
    : locationStatus === 'denied'
      ? 'Allow location to track progress'
      : locationStatus === 'unavailable'
        ? 'Location unavailable'
        : !position
          ? 'Finding your location…'
          : !onRoute
            ? 'Not on the route yet'
            : `${Math.round(fraction * 100)}% Complete`;

  const legStart = stops[legIndex];
  const legEnd = stops[legIndex + 1];
  const legLine =
    legStart && legEnd
      ? `Current leg: ${legStart.title} to ${legEnd.title}${plan ? ` · ${miles(plan.legs[legIndex]?.distanceMeters ?? plan.distanceMeters)}` : ''}${
          loading ? ' · finding the route…' : failed ? ' · route unavailable, showing a straight line' : ''
        }`
      : !ready
        ? 'Add a start and end on the Trip tab to build the route.'
        : itinerary.length === 0
          ? 'No stops selected yet. Give a stop a thumbs up on the Plan tab.'
          : trip.leg;
  const timings = plan ? schedule(stops, plan.legs) : null;

  // With more than one driver, the route is split into a stretch for each, in the crew's colours.
  const driverLegs =
    plan && drivers.length > 1
      ? planDriverLegs({
          path: plan.path,
          stops,
          legSeconds: plan.legs.map((leg) => leg.timeSeconds),
          drivers: drivers.map((item) => ({ crewId: item.member.id, limitMinutes: item.limitMinutes })),
        })
      : [];
  const colorOf = (crewId: string) => trip.crew.find((member) => member.id === crewId)?.color ?? C.teal;
  const sections = plan
    ? sectionsFor(plan.path, driverLegs).map((section) => ({ color: colorOf(section.crewId), path: section.path }))
    : [];
  // The driver on the stretch the car is on now, or the first driver before the trip starts.
  const turn = driverLegs.length > 0 ? (onRoute && along ? driverAt(driverLegs, along.alongMeters) : driverLegs[0]) : undefined;
  const driver = trip.crew.find((member) => member.id === turn?.crewId) ?? drivers[0]?.member ?? trip.crew[0];
  const selected = fullMap ? undefined : stops.find((stop) => stop.id === selectedId);
  const selectedLeg = selected ? timings?.get(selected.id)?.legMeters : null;

  return (
    <View style={layout.fill} onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
      <View style={[styles.mapWrap, fullMap && layout.fill]}>
        <TripMap
          stops={stops.map((stop) => ({
            id: stop.id,
            latitude: stop.latitude,
            longitude: stop.longitude,
            color: stop.pin,
            label: shortLabel(stop.title),
          }))}
          path={plan?.path}
          me={position}
          sections={sections}
          routeColor={drivers.length > 0 ? driver?.color : undefined}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
        />
        <View style={styles.driverPill}>
          <View style={[styles.mini, { backgroundColor: driver?.color ?? C.teal }]} />
          <Text style={styles.driverText}>{driver?.name ?? 'Crew'} driving</Text>
        </View>
        <View style={styles.tools}>
          <TouchableOpacity style={styles.tool} onPress={onConnection} activeOpacity={0.85}>
            <MaterialCommunityIcons name="bluetooth" size={18} color={C.teal} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tool, styles.toolSun]} onPress={onRotation} activeOpacity={0.85}>
            <MaterialCommunityIcons name="steering" size={18} color={C.orange} />
          </TouchableOpacity>
        </View>
        {note ? (
          <View style={styles.note}>
            <Text style={styles.noteText} numberOfLines={1}>
              {note}
            </Text>
          </View>
        ) : null}
        {selected ? (
          <StopCard
            stop={selected}
            time={timings?.get(selected.id)?.time ?? selected.time}
            fromLast={selectedLeg ? `${miles(selectedLeg)} from the last stop` : null}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
        {!fullMap && !selected ? (
          <View style={styles.routing}>
            <Text style={styles.routingTitle}>Routing {trip.routeName}</Text>
            <Text style={styles.routingLeg}>{legLine}</Text>
            {driverLegs.length > 1 ? (
              <View style={styles.legend}>
                {driverLegs.map((leg, index) => (
                  <View key={`${leg.crewId}-${index}`} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colorOf(leg.crewId) }]} />
                    <Text style={styles.legendText}>
                      {trip.crew.find((member) => member.id === leg.crewId)?.name ?? 'Driver'} · {miles(leg.toMeters - leg.fromMeters)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(fraction * 100)}%` }]} />
            </View>
            <Text style={styles.pct}>{progressText}</Text>
          </View>
        ) : null}
      </View>

      {!fullMap ? (
        <BottomSheet title="Today's Itinerary" containerHeight={height}>
          <ScrollView style={layout.fill} contentContainerStyle={styles.itinerary} showsVerticalScrollIndicator={false}>
            {itinerary.map((stop, index) => (
              <View key={stop.id} style={styles.row}>
                <View style={styles.rail}>
                  <View style={[styles.dot, { backgroundColor: stop.pin }]} />
                  {index < itinerary.length - 1 ? <View style={styles.line} /> : null}
                </View>
                <View style={styles.copy}>
                  <Text style={styles.stopTitle}>{stop.title}</Text>
                  <Text style={styles.stopMeta}>
                    {stop.stop}
                    {timings?.get(stop.id)?.legMeters ? ` · ${miles(timings.get(stop.id)?.legMeters ?? 0)} from the last stop` : ''}
                  </Text>
                </View>
                <Text style={styles.time}>{timings?.get(stop.id)?.time ?? stop.time}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.eta}>
            <Text style={styles.etaValue}>{plan ? duration(plan.timeSeconds) : trip.duration}</Text>
            <Text style={styles.etaSub}>
              {plan ? `${miles(plan.distanceMeters)} · ` : ''}Live with your crew · weather along the route
            </Text>
          </View>
        </BottomSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    bottom: 36,
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
  legend: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
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
