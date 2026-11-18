import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  addWaypoint,
  createTrip,
  currentUser,
  getTrip,
  isServerTrip,
  joinTrip,
  listTrips,
  logExpense,
  onSessionEnded,
  removeTrip,
  setAuthToken,
  signOut,
  updateTrip as saveTrip,
  voteWaypoint,
  type AddressSuggestion,
  type ApiExpense,
  type ApiMember,
  type ApiPlace,
  type ApiTrip,
  type ApiTripDetail,
  type ApiUser,
  type ApiWaypoint,
  type Spot,
} from './src/api';
import { MapBackdrop } from './src/components/MapBackdrop';
import { TabBar } from './src/components/TabBar';
import { IMG } from './src/data';
import { formatIso, formatTripDates } from './src/dates';
import { currentDrivers, formatLimit } from './src/drivers';
import { EXPENSE_TYPES, orderPayers, payerOptions, togglePayer } from './src/expenses';
import { ConnectionDialog } from './src/screens/ConnectionDialog';
import { CostsScreen } from './src/screens/CostsScreen';
import { CreateTripDialog } from './src/screens/CreateTripDialog';
import { DriveScreen } from './src/screens/DriveScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { InviteScreen } from './src/screens/InviteScreen';
import { JoinTripDialog } from './src/screens/JoinTripDialog';
import { LogExpenseDialog } from './src/screens/LogExpenseDialog';
import { PlanScreen } from './src/screens/PlanScreen';
import { ProfileDialog } from './src/screens/ProfileDialog';
import { RotationDialog } from './src/screens/RotationDialog';
import { StopNoteDialog } from './src/screens/StopNoteDialog';
import { TripSettingsScreen, type TripSettings } from './src/screens/TripSettingsScreen';
import { clearToken, loadToken, saveToken } from './src/session';
import { isGuest } from './src/crew';
import { spotFor } from './src/stops';
import { C } from './src/theme';
import { castVote, statusFor } from './src/votes';
import type { Crew, Expense, ExpenseType, Tab, Trip, Waypoint } from './src/types';

function expenseFromApi(row: ApiExpense): Expense {
  const type = EXPENSE_TYPES.some((item) => item.value === row.category) ? (row.category as ExpenseType) : 'other';
  const paidBy = row.paid_by_user
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  return {
    id: row.id,
    title: row.title || row.category,
    paidBy: paidBy.length > 0 ? paidBy : ['Someone'],
    notes: row.description,
    amount: row.amount,
    type,
    photos: row.photos,
  };
}

const CREW_COLORS = ['#E26D5A', '#3AA99A', '#E2B045', '#5B7CFA', '#8B6CC4'];

/** A trip's crew is the accounts on it, in the order they joined, then anyone added by name. */
function crewFromApi(members: ApiMember[], guests: ApiTrip['guests']): Crew[] {
  return [...members, ...guests].map((member, index) => ({
    id: member.id,
    name: member.name,
    initial: member.name.trim().charAt(0).toUpperCase() || '?',
    color: CREW_COLORS[index % CREW_COLORS.length],
  }));
}

const STOP_LOOKS = {
  start: { detail: 'Start', image: IMG.coast, time: '9:00 AM', stop: 'Departure', pin: '#E26D5A' },
  end: { detail: 'Destination', image: IMG.hills, time: '—', stop: 'Arrival', pin: '#5B7CFA' },
  suggestion: { detail: 'Suggested stop', image: IMG.lake, time: '—', stop: 'New suggestion', pin: '#8B6CC4' },
};

function stopFromApi(row: ApiWaypoint): Waypoint {
  const role = row.role ?? undefined;
  return {
    id: row.id,
    title: row.name,
    ...STOP_LOOKS[role ?? 'suggestion'],
    note: row.note || undefined,
    proposedBy: row.proposed_by ?? 'Someone',
    likes: row.likes,
    dislikes: row.dislikes,
    vote: row.my_vote,
    // Start and End are always on the route. Other stops follow your vote.
    status: role ? 'selected' : statusFor(row.my_vote),
    ...(row.latitude !== null && row.longitude !== null ? { latitude: row.latitude, longitude: row.longitude } : {}),
    role,
  };
}

/** Start first, End last, and suggestions in the order they were added. */
function stopsFromApi(rows: ApiWaypoint[]): Waypoint[] {
  const rank = (row: ApiWaypoint) => (row.role === 'start' ? 0 : row.role === 'end' ? 2 : 1);
  return [...rows].sort((a, b) => rank(a) - rank(b) || a.sequence_order - b.sequence_order).map(stopFromApi);
}

function datesText(start: string | null, end: string | null) {
  if (start && end) return formatTripDates(start, end);
  if (start) return formatIso(start);
  if (end) return `Until ${formatIso(end)}`;
  return 'Dates TBD';
}

/** The trip as the server has it. The trip list leaves out stops and expenses; `getTrip` fills them in. */
function tripFromApi(row: ApiTrip | ApiTripDetail): Trip {
  const waypoints = 'waypoints' in row ? stopsFromApi(row.waypoints) : [];
  const start = waypoints.find((stop) => stop.role === 'start')?.title;
  const end = waypoints.find((stop) => stop.role === 'end')?.title;
  return {
    id: row.id,
    shareCode: row.share_code,
    role: row.role,
    title: row.title,
    routeName: row.title,
    dates: datesText(row.start_date, row.end_date),
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    image: row.image ?? IMG.road,
    crew: crewFromApi(row.members, row.guests),
    waypoints,
    expenses: 'expenses' in row ? row.expenses.map(expenseFromApi) : [],
    budget: Number(row.budget) > 0 ? Number(row.budget) : 0,
    drivers: row.drivers,
    duration: '—',
    leg: start && end ? `${start} to ${end}` : 'Add a start and end on the Trip tab',
    rest: { place: 'Nearest safe pull-off', distance: '—', note: 'We’ll mark it once you’re moving' },
  };
}

function placeFor(name: string, spot: Spot | null): ApiPlace | null {
  if (!name) return null;
  return spot ? { name, latitude: spot.latitude, longitude: spot.longitude } : { name };
}

function CoDrive({ user, onSignOut }: { user: ApiUser; onSignOut: () => void }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home');
  // Set when something sends you to a field on the Trip tab, so it can scroll there and focus it.
  const [settingsFocus, setSettingsFocus] = useState<'budget' | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsError, setTripsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [rotationOpen, setRotationOpen] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [rotationNote, setRotationNote] = useState<string | null>(null);
  const [draftStop, setDraftStop] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [stopNote, setStopNote] = useState('');
  const [addingStop, setAddingStop] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
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
        setTrips(rows.map(tripFromApi));
        setSelectedId((current) => current || rows[0]?.id || '');
      })
      .catch((error: unknown) => {
        if (active) setTripsError(error instanceof Error ? error.message : 'Could not load your trips');
      })
      .finally(() => {
        if (active) setTripsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // The trip list has no stops or expenses, so load the open trip in full, and again on each tab
  // so changes from the rest of the crew show up.
  const tripId = trip?.id;
  useEffect(() => {
    if (!tripId || !isServerTrip(tripId)) return;
    let active = true;
    getTrip(tripId)
      .then((saved) => {
        if (active) setTrips((current) => current.map((item) => (item.id === tripId ? tripFromApi(saved) : item)));
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
      if (joinOpen) {
        setJoinOpen(false);
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
  }, [noteOpen, inviteOpen, rotationOpen, connectionOpen, createOpen, joinOpen, expenseOpen, profileOpen, tab]);

  const updateTrip = (id: string, recipe: (current: Trip) => Trip) => {
    setTrips((current) => current.map((item) => (item.id === id ? recipe(item) : item)));
  };

  const openTrip = (id: string) => {
    setSelectedId(id);
    setTab('plan');
  };

  /** Deletes a trip you own for the whole crew, or leaves one you joined. */
  const deleteTrip = async (id: string) => {
    try {
      await removeTrip(id);
    } catch (error) {
      setTripsError(error instanceof Error ? error.message : 'Could not remove the trip');
      return;
    }
    setTripsError(null);
    setTrips((current) => current.filter((item) => item.id !== id));
    if (selectedId === id) setSelectedId(trips.find((item) => item.id !== id)?.id ?? '');
  };

  const openJoin = () => {
    setJoinCode('');
    setJoinError(null);
    setJoinOpen(true);
  };

  const handleJoin = async () => {
    const code = joinCode.trim();
    if (code.length < 4 || joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const joined = tripFromApi(await joinTrip(code));
      setTrips((current) => (current.some((item) => item.id === joined.id) ? current : [joined, ...current]));
      setJoinOpen(false);
      openTrip(joined.id);
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : 'Could not join the trip');
    } finally {
      setJoining(false);
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
    let created: ApiTrip;
    try {
      created = await createTrip(title);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Could not create the trip');
      setCreating(false);
      return;
    }

    const id = created.id;
    setTrips((current) => [tripFromApi(created), ...current]);
    setSelectedId(id);
    setTripName('');
    setCreating(false);
    setCreateOpen(false);
    setInviteOpen(true);
  };

  /** Saves the Trip tab on the server. Throws if the save fails, so the form can say so. */
  const saveSettings = async (settings: TripSettings) => {
    if (!trip) return;
    const accounts = new Set(trip.crew.filter((member) => !isGuest(member)).map((member) => member.id));
    const saved = await saveTrip(trip.id, {
      title: settings.title,
      budget: settings.budget > 0 ? settings.budget : null,
      start_date: settings.startDate || null,
      end_date: settings.endDate || null,
      // Pictures can be megabytes, so only send one that changed.
      ...(settings.image !== trip.image ? { image: settings.image } : {}),
      drivers: settings.drivers,
      guests: settings.crew
        .filter((member) => !accounts.has(member.id))
        .map((member) => ({ id: member.id, name: member.name })),
      start: placeFor(settings.start, settings.startSpot),
      end: placeFor(settings.end, settings.endSpot),
    });
    updateTrip(trip.id, () => tripFromApi(saved));
  };

  const requestStop = () => {
    if (!draftStop.trim() || !trip) return;
    setStopNote('');
    setStopError(null);
    setNoteOpen(true);
  };

  const pickPlace = (place: AddressSuggestion) => {
    setDraftStop(place.name);
    setDraftPlace({ name: place.name, latitude: place.latitude, longitude: place.longitude });
    setStopNote('');
    setStopError(null);
    setNoteOpen(true);
  };

  const addStop = async () => {
    const title = draftStop.trim();
    if (!title || !trip || addingStop) return;
    const tripId = trip.id;
    setAddingStop(true);
    setStopError(null);
    try {
      const saved = await addWaypoint(tripId, {
        ...placeFor(title, spotFor(title, draftPlace))!,
        note: stopNote.trim(),
      });
      // New suggestions go before the End, where they will be after a reload.
      updateTrip(tripId, (current) => {
        const end = current.waypoints.filter((stop) => stop.role === 'end');
        const rest = current.waypoints.filter((stop) => stop.role !== 'end');
        return { ...current, waypoints: [...rest, stopFromApi(saved), ...end] };
      });
    } catch (error) {
      setStopError(error instanceof Error ? error.message : 'Could not add the stop');
      return;
    } finally {
      setAddingStop(false);
    }
    setDraftStop('');
    setDraftPlace(null);
    setStopNote('');
    setNoteOpen(false);
  };

  /** Shows the vote straight away, then keeps the server's counts, or puts the stop back if the vote did not save. */
  const vote = (id: string, direction: 'up' | 'down') => {
    if (!trip) return;
    const tripId = trip.id;
    const before = trip.waypoints.find((stop) => stop.id === id);
    if (!before) return;
    const after = castVote(before, direction);
    const replace = (next: Waypoint) =>
      updateTrip(tripId, (current) => ({
        ...current,
        waypoints: current.waypoints.map((stop) => (stop.id === id ? next : stop)),
      }));
    replace(before.role ? { ...after, status: 'selected' } : after);
    voteWaypoint(tripId, id, after.vote)
      .then((saved) => replace(stopFromApi(saved)))
      .catch(() => replace(before));
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
  const driverMember = firstDriver?.member ?? trip?.crew[0];
  const driver = driverMember?.name ?? 'Your driver';
  const driverLine =
    driverMember?.id === user.id
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
                onJoin={openJoin}
                onDelete={deleteTrip}
                onEdit={openEdit}
                onProfile={() => setProfileOpen(true)}
                loading={tripsLoading}
                loadError={tripsError}
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

        {joinOpen ? (
          <JoinTripDialog
            code={joinCode}
            onCode={setJoinCode}
            onSubmit={handleJoin}
            onClose={() => setJoinOpen(false)}
            submitting={joining}
            error={joinError}
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
            name={user.name}
            email={user.email}
            uri={profileUri}
            onPhoto={setProfileUri}
            onClear={() => setProfileUri(null)}
            onSignOut={onSignOut}
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
            submitting={addingStop}
            error={stopError}
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

/** Holds the signed-in account. Nothing about trips loads until the API has confirmed who you are. */
function Session() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [checking, setChecking] = useState(true);

  const endSession = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    clearToken().catch(() => undefined);
  }, []);

  useEffect(() => {
    onSessionEnded(endSession);
    let active = true;
    loadToken()
      .then(async (token) => {
        if (!token) return;
        setAuthToken(token);
        const me = await currentUser();
        if (active) setUser(me.user);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
      onSessionEnded(null);
    };
  }, [endSession]);

  const signedIn = (token: string, account: ApiUser) => {
    setAuthToken(token);
    saveToken(token).catch(() => undefined);
    setUser(account);
  };

  const signOutNow = () => {
    // The request reads the token before endSession clears it.
    signOut().catch(() => undefined);
    endSession();
  };

  if (user) return <CoDrive key={user.id} user={user} onSignOut={signOutNow} />;

  return (
    <View style={styles.stage}>
      <View style={[styles.phone, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar style="dark" />
        {checking ? (
          <View style={styles.emptyTab}>
            <ActivityIndicator color={C.teal} />
          </View>
        ) : (
          <AuthScreen onSignedIn={signedIn} />
        )}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Session />
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
