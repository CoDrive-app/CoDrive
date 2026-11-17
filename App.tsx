import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
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
  type AddressSuggestion,
  type ApiExpense,
  type ApiMember,
  type ApiTrip,
  type ApiUser,
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
    paidBy: paidBy.length > 0 ? paidBy : ['Someone'],
    notes: row.description,
    amount: row.amount,
    type,
    photos: row.photos,
  };
}

const CREW_COLORS = ['#E26D5A', '#3AA99A', '#E2B045', '#5B7CFA', '#8B6CC4'];

/** A trip's crew is the accounts on it, in the order they joined. */
function crewFromMembers(members: ApiMember[]): Crew[] {
  return members.map((member, index) => ({
    id: member.id,
    name: member.name,
    initial: member.name.trim().charAt(0).toUpperCase() || '?',
    color: CREW_COLORS[index % CREW_COLORS.length],
  }));
}

function tripFromApi(row: ApiTrip): Trip {
  const created = new Date(row.created_at);
  const dates = Number.isNaN(created.getTime())
    ? 'Dates TBD'
    : created.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  return {
    id: row.id,
    shareCode: row.share_code,
    role: row.role,
    title: row.title,
    routeName: row.title,
    dates,
    image: IMG.road,
    crew: crewFromMembers(row.members),
    waypoints: [],
    expenses: [],
    budget: Number(row.budget) > 0 ? Number(row.budget) : 0,
    drivers: [],
    duration: '—',
    leg: row.title,
    rest: { place: 'Nearest safe pull-off', distance: '—', note: 'We’ll mark it once you’re moving' },
  };
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

  const tripId = trip?.id;
  useEffect(() => {
    if (tab !== 'costs' || !tripId || !isServerTrip(tripId)) return;
    let active = true;
    getTrip(tripId)
      .then((saved) => {
        if (!active) return;
        setTrips((current) =>
          current.map((item) =>
            item.id === tripId
              ? { ...item, crew: crewFromMembers(saved.members), expenses: saved.expenses.map(expenseFromApi) }
              : item,
          ),
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
    const next: Trip = { ...tripFromApi(created), dates: 'Dates TBD', leg: 'Add a start and end on the Trip tab' };
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
          proposedBy: user.name,
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
