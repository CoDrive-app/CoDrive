import { useEffect, useState } from 'react';
import { BackHandler, Platform, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { createTrip, getTrip, isServerTrip, listTrips, logExpense, type ApiExpense, type ApiTrip } from './src/api';
import { crewFromName, currentDriver, isRouteEnd, isTripCreator, journeyReady } from './src/journey';
import { budgetAmount, formatTripDates, parseStoredDates, tidyLabel, tripFormReady } from './src/tripForm';
import { TabBar } from './src/components/TabBar';
import { CREW, iconFor, IMG, TRIPS } from './src/data';
import { ConnectionDialog } from './src/screens/ConnectionDialog';
import { CostsScreen } from './src/screens/CostsScreen';
import { CrewDialog } from './src/screens/CrewDialog';
import { LaunchDialog } from './src/screens/LaunchDialog';
import { CreateTripDialog } from './src/screens/CreateTripDialog';
import { DriveScreen } from './src/screens/DriveScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { InviteScreen } from './src/screens/InviteScreen';
import { LogExpenseDialog } from './src/screens/LogExpenseDialog';
import { PlanScreen } from './src/screens/PlanScreen';
import { ProfileDialog } from './src/screens/ProfileDialog';
import { RotationDialog } from './src/screens/RotationDialog';
import { StopPinDialog } from './src/screens/StopPinDialog';
import { SwapDriverDialog } from './src/screens/SwapDriverDialog';
import { C } from './src/theme';
import type { Crew, Expense, ExpenseIcon, Tab, Trip } from './src/types';

const EXPENSE_ICONS: ExpenseIcon[] = ['food', 'snorkel', 'stay', 'treat', 'gas'];
const STOP_PINS = ['#E26D5A', '#E2B045', '#3AA99A', '#5B7CFA', '#8B6CC4'];

function expenseFromApi(row: ApiExpense): Expense {
  const icon = EXPENSE_ICONS.find((kind) => kind === row.category) ?? iconFor(row.title || row.category);
  return {
    id: row.id,
    title: row.title || row.category,
    details: row.description,
    amount: row.amount,
    icon,
    photos: row.photos,
  };
}

function tripFromApi(row: ApiTrip): Trip {
  const created = new Date(row.created_at);
  const dates = Number.isNaN(created.getTime())
    ? 'Dates TBD'
    : created.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  return {
    id: row.id,
    shareCode: row.share_code,
    title: row.title,
    routeName: row.title,
    dates,
    image: IMG.road,
    crew: [{ id: 'you', name: 'You', initial: 'Y', color: '#E26D5A' }],
    driverId: 'you',
    waypoints: [],
    expenses: [],
    budget: Number(row.budget) > 0 ? Number(row.budget) : 500,
    status: 'planning',
    createdBy: 'you',
    duration: '—',
    leg: row.title,
    progress: 0,
    rest: { place: 'Nearest safe pull-off', distance: '—', note: 'We’ll mark it once you’re moving' },
  };
}

function CoDrive() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home');
  const [trips, setTrips] = useState<Trip[]>(TRIPS);
  const [selectedId, setSelectedId] = useState(TRIPS[0].id);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [rotationOpen, setRotationOpen] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [rotationSeen, setRotationSeen] = useState(false);
  const [rotationNote, setRotationNote] = useState<string | null>(null);
  const [draftStop, setDraftStop] = useState('');
  const [pinOpen, setPinOpen] = useState(false);
  const [draftPin, setDraftPin] = useState<{ x: number; y: number } | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapChoice, setSwapChoice] = useState<string | null>(null);
  const [swapReason, setSwapReason] = useState('');
  const [tripName, setTripName] = useState('');
  const [startName, setStartName] = useState('');
  const [endName, setEndName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tripBudget, setTripBudget] = useState('');
  const [tripImage, setTripImage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expensePhotos, setExpensePhotos] = useState<string[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [crewOpen, setCrewOpen] = useState(false);
  const [profileUri, setProfileUri] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  const trip = trips.find((item) => item.id === selectedId) ?? trips[0];

  useEffect(() => {
    let active = true;
    listTrips()
      .then((rows) => {
        if (!active) return;
        setTrips((current) => {
          const known = new Set(current.map((item) => item.id));
          const saved = rows.filter((row) => !known.has(row.id)).map(tripFromApi);
          return saved.length > 0 ? [...saved, ...current] : current;
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const tripId = trip?.id;
  useEffect(() => {
    if (tab !== 'costs' || !tripId || !isServerTrip(tripId)) return;
    let active = true;
    getTrip(tripId)
      .then((saved) => {
        if (!active) return;
        updateTrip(tripId, (current) => ({ ...current, expenses: saved.expenses.map(expenseFromApi) }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [tab, tripId]);

  useEffect(() => {
    if (tab === 'drive' && trip?.status === 'live' && !rotationSeen) {
      setRotationOpen(true);
      setRotationSeen(true);
    }
  }, [tab, rotationSeen, trip]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (inviteOpen) {
        setInviteOpen(false);
        return true;
      }
      if (rotationOpen) {
        setRotationOpen(false);
        return true;
      }
      if (connectionOpen) {
        setConnectionOpen(false);
        return true;
      }
      if (createOpen) {
        setCreateOpen(false);
        setEditingId(null);
        return true;
      }
      if (expenseOpen) {
        setExpenseOpen(false);
        return true;
      }
      if (profileOpen) {
        setProfileOpen(false);
        return true;
      }
      if (launchOpen) {
        setLaunchOpen(false);
        return true;
      }
      if (crewOpen) {
        setCrewOpen(false);
        return true;
      }
      if (pinOpen) {
        setPinOpen(false);
        return true;
      }
      if (swapOpen) {
        setSwapOpen(false);
        return true;
      }
      if (tab !== 'home') {
        setTab('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [inviteOpen, rotationOpen, connectionOpen, createOpen, expenseOpen, profileOpen, launchOpen, crewOpen, pinOpen, swapOpen, tab]);

  const updateTrip = (id: string, recipe: (current: Trip) => Trip) => {
    setTrips((current) => current.map((item) => (item.id === id ? recipe(item) : item)));
  };

  const openTrip = (id: string) => {
    setSelectedId(id);
    setTab('plan');
  };

  const deleteTrip = (id: string) => {
    const remaining = trips.filter((item) => item.id !== id);
    setTrips(remaining);
    if (selectedId === id) {
      setSelectedId(remaining[0]?.id ?? '');
      setTab('home');
    }
  };

  const createReady = tripFormReady({
    editing: editingId !== null,
    name: tripName,
    start: startName,
    end: endName,
    startDate,
    endDate,
    budget: tripBudget,
  });
  const amountValue = parseFloat(expenseAmount);
  const expenseReady =
    expenseName.trim().length > 0 &&
    expenseNotes.trim().length > 0 &&
    !Number.isNaN(amountValue) &&
    amountValue > 0;

  const clearTripForm = () => {
    setTripName('');
    setStartName('');
    setEndName('');
    setStartDate('');
    setEndDate('');
    setTripBudget('');
    setTripImage(null);
    setEditingId(null);
  };

  const openCreate = () => {
    clearTripForm();
    setCreateError(null);
    setCreateOpen(true);
  };

  const openEdit = (id: string) => {
    const current = trips.find((item) => item.id === id);
    if (!current) return;
    const parsedDates = parseStoredDates(current.dates);
    setEditingId(id);
    setTripName(current.title);
    setStartName(current.waypoints.find((stop) => stop.detail === 'Start')?.title ?? '');
    setEndName(current.waypoints.find((stop) => stop.detail === 'Destination')?.title ?? '');
    setStartDate(parsedDates.start);
    setEndDate(parsedDates.end);
    setTripBudget(String(current.budget));
    setTripImage(current.image);
    setCreateOpen(true);
  };

  const closeTripForm = () => {
    setCreateOpen(false);
    setEditingId(null);
    setCreateError(null);
    setCreating(false);
  };

  const placeWaypoints = (current: Trip, start: string, end: string) => {
    let waypoints = current.waypoints.map((stop) => {
      if (stop.detail === 'Start' && start) return { ...stop, title: start };
      if (stop.detail === 'Destination' && end) return { ...stop, title: end };
      return stop;
    });
    if (start && !waypoints.some((stop) => stop.detail === 'Start')) {
      waypoints = [
        {
          id: `${current.id}-start`,
          title: start,
          detail: 'Start',
          proposedBy: 'You',
          likes: 1,
          liked: true,
          image: IMG.coast,
          time: '9:00 AM',
          stop: 'Departure',
          pin: '#E26D5A',
          x: 16,
          y: 78,
          going: true,
        },
        ...waypoints,
      ];
    }
    if (end && !waypoints.some((stop) => stop.detail === 'Destination')) {
      waypoints = [
        ...waypoints,
        {
          id: `${current.id}-end`,
          title: end,
          detail: 'Destination',
          proposedBy: 'You',
          likes: 1,
          liked: true,
          image: IMG.hills,
          time: '—',
          stop: 'Arrival',
          pin: '#5B7CFA',
          x: 78,
          y: 22,
          going: true,
        },
      ];
    }
    return waypoints;
  };

  const handleCreate = async () => {
    const budget = budgetAmount(tripBudget);
    if (!createReady || budget === null || creating) return;
    const title = tidyLabel(tripName);
    const start = tidyLabel(startName);
    const end = tidyLabel(endName);
    const dates = formatTripDates(startDate, endDate);
    if (!dates) return;
    const image = tripImage ?? IMG.road;

    if (editingId) {
      updateTrip(editingId, (current) => ({
        ...current,
        title,
        routeName: current.routeName === current.title ? title : current.routeName,
        dates,
        budget,
        image,
        leg: start && end ? `${start} to ${end}` : current.leg,
        waypoints: placeWaypoints(current, start, end),
      }));
      clearTripForm();
      setCreateOpen(false);
      return;
    }

    setCreating(true);
    setCreateError(null);
    let created: { id: string; share_code: string };
    try {
      created = await createTrip(title, budget);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Could not create the trip');
      setCreating(false);
      return;
    }

    const id = created.id;
    const you: Crew = { id: 'you', name: 'You', initial: 'Y', color: '#E26D5A' };
    const next: Trip = {
      id,
      shareCode: created.share_code,
      title,
      routeName: title,
      dates,
      image,
      crew: [you, CREW[1], CREW[2]],
      driverId: 'you',
      budget,
      status: 'planning',
      createdBy: 'you',
      duration: '—',
      leg: `${start} to ${end}`,
      progress: 0.08,
      rest: { place: 'Nearest safe pull-off', distance: '—', note: 'We’ll mark it once you’re moving' },
      expenses: [],
      waypoints: [
        {
          id: `${id}-start`,
          title: start,
          detail: 'Start',
          proposedBy: 'You',
          likes: 1,
          liked: true,
          image: IMG.coast,
          time: '9:00 AM',
          stop: 'Departure',
          pin: '#E26D5A',
          x: 16,
          y: 78,
          going: true,
        },
        {
          id: `${id}-end`,
          title: end,
          detail: 'Destination',
          proposedBy: 'You',
          likes: 1,
          liked: true,
          image: IMG.hills,
          time: '—',
          stop: 'Arrival',
          pin: '#5B7CFA',
          x: 78,
          y: 22,
          going: true,
        },
      ],
    };
    setTrips((current) => [next, ...current]);
    setSelectedId(id);
    clearTripForm();
    setCreating(false);
    setCreateOpen(false);
    setInviteOpen(true);
  };

  const openStopPin = () => {
    if (!draftStop.trim() || !trip) return;
    setDraftPin(null);
    setPinOpen(true);
  };

  const confirmStop = () => {
    const title = draftStop.trim();
    if (!title || !trip || !draftPin) return;
    const point = draftPin;
    const tripId = trip.id;
    const localId = Date.now().toString();
    updateTrip(tripId, (current) => {
      const stop = {
        id: localId,
        title,
        detail: 'Suggested stop',
        proposedBy: 'You',
        likes: 1,
        liked: true,
        image: IMG.lake,
        time: '—',
        stop: 'New suggestion',
        pin: STOP_PINS[current.waypoints.length % STOP_PINS.length] ?? '#8B6CC4',
        x: point.x,
        y: point.y,
        going: true,
      };
      let endIndex = -1;
      current.waypoints.forEach((item, index) => {
        if (item.detail === 'Destination' || item.stop === 'Arrival') endIndex = index;
      });
      const waypoints = [...current.waypoints];
      if (endIndex >= 0) waypoints.splice(endIndex, 0, stop);
      else waypoints.push(stop);
      return { ...current, waypoints };
    });
    setDraftStop('');
    setDraftPin(null);
    setPinOpen(false);
  };

  const toggleGoing = (id: string) => {
    if (!trip) return;
    updateTrip(trip.id, (current) => ({
      ...current,
      waypoints: current.waypoints.map((stop) =>
        stop.id === id && !isRouteEnd(stop) ? { ...stop, going: !stop.going } : stop,
      ),
    }));
  };

  const openSwap = () => {
    if (!trip) return;
    setSwapChoice(currentDriver(trip)?.id ?? null);
    setSwapReason('');
    setSwapOpen(true);
  };

  const confirmSwap = () => {
    if (!trip || !swapChoice) return;
    const person = trip.crew.find((member) => member.id === swapChoice);
    const driving = currentDriver(trip);
    if (!person || person.id === driving?.id) {
      setSwapOpen(false);
      return;
    }
    const why = swapReason.trim();
    updateTrip(trip.id, (current) => ({ ...current, driverId: person.id }));
    setRotationNote(why ? `${person.name} is driving · ${why}` : `${person.name} is driving`);
    setSwapOpen(false);
  };

  const toggleLike = (id: string) => {
    if (!trip) return;
    updateTrip(trip.id, (current) => ({
      ...current,
      waypoints: current.waypoints.map((stop) =>
        stop.id === id ? { ...stop, liked: !stop.liked, likes: stop.likes + (stop.liked ? -1 : 1) } : stop,
      ),
    }));
  };

  const openLaunch = (id: string) => {
    setSelectedId(id);
    setLaunchOpen(true);
  };

  const confirmLaunch = () => {
    if (!trip || !journeyReady(trip)) return;
    updateTrip(trip.id, (current) => ({
      ...current,
      status: 'live',
      progress: current.progress > 0 ? current.progress : 0.04,
      duration: current.duration === '—' ? 'Just started' : current.duration,
    }));
    setLaunchOpen(false);
    setRotationSeen(false);
    setTab('drive');
  };

  const openCrew = (id: string) => {
    const current = trips.find((item) => item.id === id);
    if (!current || !isTripCreator(current)) return;
    setSelectedId(id);
    setCrewOpen(true);
  };

  const addCrewMember = (personName: string) => {
    if (!trip) return;
    const person = crewFromName(personName, trip.crew.length);
    if (!person || trip.crew.some((member) => member.name.toLowerCase() === person.name.toLowerCase())) return;
    updateTrip(trip.id, (current) => ({ ...current, crew: [...current.crew, person] }));
  };

  const removeCrewMember = (memberId: string) => {
    if (!trip || trip.crew.length <= 1 || memberId === trip.createdBy) return;
    updateTrip(trip.id, (current) => {
      const crew = current.crew.filter((member) => member.id !== memberId);
      const drivingId = current.driverId || current.crew[0]?.id;
      return {
        ...current,
        crew,
        driverId: memberId === drivingId ? crew[0]?.id ?? current.driverId : current.driverId || drivingId || '',
      };
    });
  };

  const openExpense = () => {
    setExpenseError(null);
    setExpenseOpen(true);
  };

  const closeExpense = () => {
    setExpenseOpen(false);
    setExpenseError(null);
  };

  const handleLog = async () => {
    if (!expenseReady || !trip || logging) return;
    const target = trip;
    const notes = expenseNotes.trim();
    const paidBy = notes.match(/paid by\s+([^·,\n]+)/i)?.[1]?.trim() || 'You';
    const category = iconFor(expenseName);
    let expenseId = Date.now().toString();

    if (isServerTrip(target.id)) {
      setLogging(true);
      setExpenseError(null);
      try {
        const saved = await logExpense(target.id, {
          paid_by_user: paidBy,
          amount: amountValue,
          category,
          title: expenseName.trim(),
          description: notes,
          photos: expensePhotos,
        });
        expenseId = saved.id;
      } catch (error) {
        setExpenseError(error instanceof Error ? error.message : 'Could not log the expense');
        setLogging(false);
        return;
      }
      setLogging(false);
    }

    updateTrip(target.id, (current) => ({
      ...current,
      expenses: [
        {
          id: expenseId,
          title: expenseName.trim(),
          details: notes,
          amount: amountValue,
          icon: category,
          photos: expensePhotos,
        },
        ...current.expenses,
      ],
    }));
    setExpenseName('');
    setExpenseAmount('');
    setExpenseNotes('');
    setExpensePhotos([]);
    setExpenseOpen(false);
  };

  const driver = (trip ? currentDriver(trip)?.name : undefined) ?? 'Ava';
  const driverLine =
    driver === 'You'
      ? 'You have reached the group set drive limit of '
      : `${driver} has reached the group set drive limit of `;

  return (
    <View style={styles.stage}>
      <View style={styles.phone}>
        <StatusBar style="dark" />
        <View
          style={[
            styles.column,
            {
              paddingTop: insets.top,
              backgroundColor: tab === 'drive' && trip?.status === 'live' ? C.map : C.cream,
            },
          ]}
        >
          <View style={styles.fill}>
            {tab === 'home' ? (
              <HomeScreen
                trips={trips}
                profileUri={profileUri}
                onOpen={openTrip}
                onCreate={openCreate}
                onDelete={deleteTrip}
                onEdit={openEdit}
                onProfile={() => setProfileOpen(true)}
                onStart={openLaunch}
                onCrew={openCrew}
              />
            ) : null}
            {!trip && tab !== 'home' ? (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyTabText}>Start a trip from Home to plan, drive, and split costs.</Text>
              </View>
            ) : null}
            {tab === 'plan' && trip ? (
              <PlanScreen
                trip={trip}
                draft={draftStop}
                onDraft={setDraftStop}
                onAdd={openStopPin}
                onLike={toggleLike}
                onToggleGoing={toggleGoing}
                onSwap={openSwap}
                onInvite={() => setInviteOpen(true)}
                onStart={() => openLaunch(trip.id)}
                onOpenDrive={() => setTab('drive')}
                onCrew={() => openCrew(trip.id)}
              />
            ) : null}
            {tab === 'drive' && trip ? (
              <DriveScreen
                trip={trip}
                fullMap={rotationOpen || connectionOpen || swapOpen}
                note={rotationNote}
                onRotation={() => setRotationOpen(true)}
                onSwap={openSwap}
                onToggleGoing={toggleGoing}
                onConnection={() => setConnectionOpen(true)}
                onStart={() => openLaunch(trip.id)}
              />
            ) : null}
            {tab === 'costs' && trip ? <CostsScreen trip={trip} trips={trips} onSelectTrip={setSelectedId} onLog={openExpense} /> : null}
          </View>
          <TabBar tab={tab} onChange={setTab} paddingBottom={insets.bottom} />
        </View>

        {createOpen ? (
          <CreateTripDialog
            editing={editingId !== null}
            name={tripName}
            start={startName}
            end={endName}
            onName={setTripName}
            onStart={setStartName}
            onEnd={setEndName}
            startDate={startDate}
            endDate={endDate}
            budget={tripBudget}
            image={tripImage}
            onStartDate={setStartDate}
            onEndDate={setEndDate}
            onBudget={setTripBudget}
            onImage={setTripImage}
            onSubmit={handleCreate}
            onClose={closeTripForm}
            canSubmit={createReady}
            submitting={creating}
            error={createError}
          />
        ) : null}

        {expenseOpen && trip ? (
          <LogExpenseDialog
            tripTitle={trip.title}
            name={expenseName}
            amount={expenseAmount}
            notes={expenseNotes}
            photos={expensePhotos}
            onName={setExpenseName}
            onAmount={setExpenseAmount}
            onNotes={setExpenseNotes}
            onPhotos={setExpensePhotos}
            onLog={handleLog}
            onClose={closeExpense}
            canLog={expenseReady}
            submitting={logging}
            error={expenseError}
          />
        ) : null}

        {rotationOpen && trip ? (
          <RotationDialog
            driverLine={driverLine}
            rest={trip.rest}
            onClose={() => setRotationOpen(false)}
            onAcknowledge={() => {
              setRotationNote('Rotation acknowledged');
              setRotationOpen(false);
            }}
            onRemind={() => {
              setRotationNote('Reminder in 10 min');
              setRotationOpen(false);
            }}
            onSwap={() => {
              setRotationOpen(false);
              openSwap();
            }}
          />
        ) : null}

        {swapOpen && trip ? (
          <SwapDriverDialog
            crew={trip.crew}
            driverId={currentDriver(trip)?.id}
            choice={swapChoice}
            reason={swapReason}
            onChoice={setSwapChoice}
            onReason={setSwapReason}
            onConfirm={confirmSwap}
            onClose={() => setSwapOpen(false)}
          />
        ) : null}

        {pinOpen && trip ? (
          <StopPinDialog
            title={draftStop.trim()}
            stops={trip.waypoints}
            pin={draftPin}
            onPin={setDraftPin}
            onConfirm={confirmStop}
            onClose={() => setPinOpen(false)}
          />
        ) : null}

        {connectionOpen ? <ConnectionDialog driverName={driver} onClose={() => setConnectionOpen(false)} /> : null}

        {launchOpen && trip ? (
          <LaunchDialog trip={trip} onClose={() => setLaunchOpen(false)} onLaunch={confirmLaunch} />
        ) : null}

        {crewOpen && trip && isTripCreator(trip) ? (
          <CrewDialog
            trip={trip}
            onClose={() => setCrewOpen(false)}
            onAdd={addCrewMember}
            onRemove={removeCrewMember}
          />
        ) : null}

        {profileOpen ? (
          <ProfileDialog
            uri={profileUri}
            onPhoto={setProfileUri}
            onClear={() => setProfileUri(null)}
            onClose={() => setProfileOpen(false)}
          />
        ) : null}

        {inviteOpen && trip ? (
          <InviteScreen
            trip={trip}
            onDone={() => {
              setInviteOpen(false);
              setTab('plan');
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <CoDrive />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: '#E7E1D6',
    alignItems: 'center',
  },
  phone: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 430 : undefined,
    backgroundColor: C.cream,
    overflow: 'hidden',
  },
  column: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  emptyTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTabText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: C.muted,
  },
});
