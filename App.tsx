import { useEffect, useState } from 'react';
import { BackHandler, Platform, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { createTrip, getTrip, isServerTrip, listTrips, logExpense, type AddressSuggestion, type ApiExpense, type ApiTrip, type Spot } from './src/api';
import { MapBackdrop } from './src/components/MapBackdrop';
import { TabBar } from './src/components/TabBar';
import { CREW, IMG, TRIPS } from './src/data';
import { formatIso, formatTripDates } from './src/dates';
import { currentDrivers, formatLimit } from './src/drivers';
import { EXPENSE_TYPES, orderPayers, payerOptions, togglePayer } from './src/expenses';
import { ConnectionDialog } from './src/screens/ConnectionDialog';
import { CostsScreen } from './src/screens/CostsScreen';
import { CreateTripDialog } from './src/screens/CreateTripDialog';
import { DriveScreen } from './src/screens/DriveScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { InviteScreen } from './src/screens/InviteScreen';
import { LogExpenseDialog } from './src/screens/LogExpenseDialog';
import { PlanScreen } from './src/screens/PlanScreen';
import { ProfileDialog } from './src/screens/ProfileDialog';
import { RotationDialog } from './src/screens/RotationDialog';
import { StopNoteDialog } from './src/screens/StopNoteDialog';
import { TripSettingsScreen, type TripSettings } from './src/screens/TripSettingsScreen';
import { applyEndpoints, spotFor, where } from './src/stops';
import { C } from './src/theme';
import { castVote } from './src/votes';
import type { Crew, Expense, ExpenseType, Tab, Trip } from './src/types';

function expenseFromApi(row: ApiExpense): Expense {
  const type = EXPENSE_TYPES.some((item) => item.value === row.category) ? (row.category as ExpenseType) : 'other';
  const paidBy = row.paid_by_user
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  return {
    id: row.id,
    title: row.title || row.category,
    paidBy: paidBy.length > 0 ? paidBy : ['You'],
    notes: row.description,
    amount: row.amount,
    type,
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
    waypoints: [],
    expenses: [],
    budget: Number(row.budget) > 0 ? Number(row.budget) : 0,
    drivers: [],
    duration: '—',
    leg: row.title,
    rest: { place: 'Nearest safe pull-off', distance: '—', note: 'We’ll mark it once you’re moving' },
  };
}

function CoDrive() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home');
  // Set when something sends you to a field on the Trip tab, so it can scroll there and focus it.
  const [settingsFocus, setSettingsFocus] = useState<'budget' | null>(null);
  const [trips, setTrips] = useState<Trip[]>(TRIPS);
  const [selectedId, setSelectedId] = useState(TRIPS[0].id);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [rotationOpen, setRotationOpen] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [rotationNote, setRotationNote] = useState<string | null>(null);
  const [draftStop, setDraftStop] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [stopNote, setStopNote] = useState('');
  const [tripName, setTripName] = useState('');
  const [draftPlace, setDraftPlace] = useState<Spot | null>(null);
  const [expenseType, setExpenseType] = useState<ExpenseType | null>(null);
  const [expensePaidBy, setExpensePaidBy] = useState<string[]>([]);
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expensePhotos, setExpensePhotos] = useState<string[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileUri, setProfileUri] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  const trip = trips.find((item) => item.id === selectedId) ?? trips[0];
  const payers = payerOptions(trip?.crew ?? []);
  // Drop picks that belong to another trip's crew if the selected trip changed.
  const activePayers = expensePaidBy.filter((name) => payers.includes(name));

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
        setTrips((current) =>
          current.map((item) => (item.id === tripId ? { ...item, expenses: saved.expenses.map(expenseFromApi) } : item)),
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [tab, tripId]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (noteOpen) {
        setNoteOpen(false);
        return true;
      }
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
      if (tab !== 'home') {
        setTab('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [noteOpen, inviteOpen, rotationOpen, connectionOpen, createOpen, expenseOpen, profileOpen, tab]);

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

  const createReady = tripName.trim().length > 0;
  const amountValue = parseFloat(expenseAmount);
  const expenseReady =
    expenseType !== null &&
    activePayers.length > 0 &&
    expenseName.trim().length > 0 &&
    !Number.isNaN(amountValue) &&
    amountValue > 0;

  const openCreate = () => {
    setTripName('');
    setCreateError(null);
    setCreateOpen(true);
  };

  // Editing a trip from Home now means opening its Trip tab.
  const openEdit = (id: string) => {
    setSelectedId(id);
    setSettingsFocus(null);
    setTab('trip');
  };

  const closeTripForm = () => {
    setCreateOpen(false);
    setCreateError(null);
    setCreating(false);
  };

  /** Creates a trip from just its name. Everything else is set on the Trip tab. */
  const handleCreate = async () => {
    if (!createReady || creating) return;
    const title = tripName.trim();

    setCreating(true);
    setCreateError(null);
    let created: { id: string; share_code: string };
    try {
      created = await createTrip(title);
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
      dates: 'Dates TBD',
      image: IMG.road,
      crew: [you, CREW[1], CREW[2]],
      budget: 0,
      drivers: [],
      duration: '—',
      leg: 'Add a start and end on the Trip tab',
      rest: { place: 'Nearest safe pull-off', distance: '—', note: 'We’ll mark it once you’re moving' },
      expenses: [],
      waypoints: [],
    };
    setTrips((current) => [next, ...current]);
    setSelectedId(id);
    setTripName('');
    setCreating(false);
    setCreateOpen(false);
    setInviteOpen(true);
  };

  const saveSettings = (settings: TripSettings) => {
    if (!trip) return;
    updateTrip(trip.id, (current) => {
      const dates =
        settings.startDate && settings.endDate
          ? formatTripDates(settings.startDate, settings.endDate)
          : settings.startDate
            ? formatIso(settings.startDate)
            : settings.endDate
              ? `Until ${formatIso(settings.endDate)}`
              : 'Dates TBD';
      return {
        ...current,
        title: settings.title,
        routeName: current.routeName === current.title ? settings.title : current.routeName,
        dates,
        startDate: settings.startDate || undefined,
        endDate: settings.endDate || undefined,
        budget: settings.budget,
        image: settings.image,
        crew: settings.crew,
        drivers: settings.drivers,
        leg: settings.start && settings.end ? `${settings.start} to ${settings.end}` : current.leg,
        waypoints: applyEndpoints(current, settings.start, settings.end, settings.startSpot, settings.endSpot),
      };
    });
  };

  const requestStop = () => {
    if (!draftStop.trim() || !trip) return;
    setStopNote('');
    setNoteOpen(true);
  };

  const pickPlace = (place: AddressSuggestion) => {
    setDraftStop(place.name);
    setDraftPlace({ name: place.name, latitude: place.latitude, longitude: place.longitude });
    setStopNote('');
    setNoteOpen(true);
  };

  const addStop = () => {
    const title = draftStop.trim();
    if (!title || !trip) return;
    const note = stopNote.trim();
    const spot = spotFor(title, draftPlace);
    const tripId = trip.id;
    const localId = Date.now().toString();
    updateTrip(tripId, (current) => ({
      ...current,
      waypoints: [
        ...current.waypoints,
        {
          id: localId,
          title,
          detail: 'Suggested stop',
          note: note || undefined,
          proposedBy: 'You',
          likes: 0,
          dislikes: 0,
          vote: null,
          image: IMG.lake,
          time: '—',
          stop: 'New suggestion',
          pin: '#8B6CC4',
          status: 'suggested',
          ...where(spot),
        },
      ],
    }));
    setDraftStop('');
    setDraftPlace(null);
    setStopNote('');
    setNoteOpen(false);
  };

  const vote = (id: string, direction: 'up' | 'down') => {
    if (!trip) return;
    updateTrip(trip.id, (current) => ({
      ...current,
      waypoints: current.waypoints.map((stop) => (stop.id === id ? castVote(stop, direction) : stop)),
    }));
  };

  const handleLog = async () => {
    if (!expenseReady || !trip || logging) return;
    if (expenseType === null) return;
    const notes = expenseNotes.trim();
    const paidBy = orderPayers(activePayers, payers);
    const category = expenseType;
    let expenseId = Date.now().toString();

    if (isServerTrip(trip.id)) {
      setLogging(true);
      setExpenseError(null);
      try {
        const saved = await logExpense(trip.id, {
          paid_by_user: paidBy.join(', '),
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

    updateTrip(trip.id, (current) => ({
      ...current,
      expenses: [
        {
          id: expenseId,
          title: expenseName.trim(),
          paidBy,
          notes,
          amount: amountValue,
          type: category,
          photos: expensePhotos,
        },
        ...current.expenses,
      ],
    }));
    setExpenseType(null);
    setExpensePaidBy([]);
    setExpenseName('');
    setExpenseAmount('');
    setExpenseNotes('');
    setExpensePhotos([]);
    setExpenseOpen(false);
  };

  const firstDriver = trip ? currentDrivers(trip)[0] : undefined;
  const driver = firstDriver?.member.name ?? trip?.crew[0]?.name ?? 'Ava';
  const driverLine =
    driver === 'You'
      ? 'You have reached the group set drive limit of '
      : `${driver} has reached the group set drive limit of `;

  return (
    <View style={styles.stage}>
      <View style={styles.phone}>
        <StatusBar style="dark" />
        <View style={[styles.column, { paddingTop: insets.top, backgroundColor: tab === 'drive' ? C.map : C.cream }]}>
          {tab === 'home' ? <MapBackdrop /> : null}
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
              />
            ) : null}
            {!trip && tab !== 'home' ? (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyTabText}>Start a trip from Home to plan, drive, and split costs.</Text>
              </View>
            ) : null}
            {tab === 'trip' && trip ? <TripSettingsScreen key={`${trip.id}-${settingsFocus ?? ''}`} trip={trip} onSave={saveSettings} focus={settingsFocus ?? undefined} /> : null}
            {tab === 'plan' && trip ? (
              <PlanScreen
                trip={trip}
                draft={draftStop}
                onDraft={setDraftStop}
                onAdd={requestStop}
                onPickPlace={pickPlace}
                onVote={vote}
                onInvite={() => setInviteOpen(true)}
              />
            ) : null}
            {tab === 'drive' && trip ? (
              <DriveScreen
                trip={trip}
                fullMap={rotationOpen || connectionOpen}
                note={rotationNote}
                onRotation={() => setRotationOpen(true)}
                onConnection={() => setConnectionOpen(true)}
              />
            ) : null}
            {tab === 'costs' && trip ? (
              <CostsScreen
                trip={trip}
                onLog={() => setExpenseOpen(true)}
                onSetBudget={() => {
                  setSettingsFocus('budget');
                  setTab('trip');
                }}
              />
            ) : null}
          </View>
          <TabBar
            tab={tab}
            onChange={(next) => {
              setSettingsFocus(null);
              setTab(next);
            }}
            paddingBottom={insets.bottom}
          />
        </View>

        {createOpen ? (
          <CreateTripDialog
            name={tripName}
            onName={setTripName}
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
            type={expenseType}
            name={expenseName}
            amount={expenseAmount}
            payers={payers}
            paidBy={activePayers}
            notes={expenseNotes}
            photos={expensePhotos}
            onType={setExpenseType}
            onName={setExpenseName}
            onAmount={setExpenseAmount}
            onPayer={(name) => setExpensePaidBy(togglePayer(activePayers, name))}
            onNotes={setExpenseNotes}
            onPhotos={setExpensePhotos}
            onLog={handleLog}
            onClose={() => {
              setExpenseOpen(false);
              setExpenseError(null);
            }}
            canLog={expenseReady}
            submitting={logging}
            error={expenseError}
          />
        ) : null}

        {rotationOpen && trip ? (
          <RotationDialog
            driverLine={driverLine}
            limit={firstDriver ? formatLimit(firstDriver.limitMinutes) : undefined}
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
          />
        ) : null}

        {connectionOpen ? <ConnectionDialog driverName={driver} onClose={() => setConnectionOpen(false)} /> : null}

        {profileOpen ? (
          <ProfileDialog
            uri={profileUri}
            onPhoto={setProfileUri}
            onClear={() => setProfileUri(null)}
            onClose={() => setProfileOpen(false)}
          />
        ) : null}

        {noteOpen && trip ? (
          <StopNoteDialog
            stopTitle={draftStop.trim()}
            note={stopNote}
            onNote={setStopNote}
            onConfirm={addStop}
            onClose={() => setNoteOpen(false)}
          />
        ) : null}

        {inviteOpen && trip ? (
          <InviteScreen
            trip={trip}
            onDone={() => {
              setInviteOpen(false);
              setTab('trip');
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
