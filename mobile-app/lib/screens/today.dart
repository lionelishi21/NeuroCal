import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../body_state.dart';
import '../combos.dart';
import '../theme/tokens.dart';
import '../widgets/feeling_face.dart';
import '../widgets/focus_ring.dart';
import '../widgets/now_status.dart';
import '../widgets/share_card.dart';
import '../widgets/sheet.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';
import '../health/sleep_sync.dart';
import '../plan/three_weeks.dart';
import '../weight_units.dart';
import '../reminders/reminders.dart';
import 'calf_routine.dart';
import 'capture.dart';
import 'environment_card.dart';
import 'exercise_sheet.dart';
import 'guide.dart';
import 'healthspan_card.dart';
import 'next_step.dart';
import 'plan_fast_sheet.dart';
import 'streak.dart';
import 'stack.dart';
import 'weight_cards.dart' show FastingCard;
import 'weekly_report.dart';
import '../theme/theme.dart' show fontFamily;

class _Day {
  const _Day(
    this.date,
    this.focus,
    this.bio,
    this.meals, {
    this.recipes,
    this.fasting,
    this.planLimitHours = 0,
    this.fastingAll,
    this.stack,
    this.brain,
    this.exercise,
    this.environment,
    this.streak,
    this.healthspan,
    this.weights,
    this.unit = WeightUnit.kg,
    this.plan,
    this.weightGoal,
    this.weighInDue = false,
    this.coffee,
  });

  final DateTime date;
  final FocusScore focus;
  final BioState bio;
  final List<Meal> meals;

  /// Null when suggestions didn't load, or for a past day; the rest of the day still shows.
  final List<Recipe>? recipes;

  /// Null when fasting is off or didn't load.
  final FastingStatus? fasting;

  /// The longest fast that can be planned; 0 when none can (or fasting didn't load).
  final int planLimitHours;

  /// The status as loaded, off included: planning a fast counts from its last meal.
  final FastingStatus? fastingAll;

  /// A planned fast is running: Today shows the fast instead of calories left.
  bool get fastPlanned => isToday && fasting?.planned == true;

  /// Null when the stack is empty or didn't load.
  final SupplementStack? stack;

  /// Null when it didn't load; the card then still offers the check.
  final BrainCheckHistory? brain;

  /// Null when it didn't load.
  final ExerciseDay? exercise;

  /// Null when it didn't load.
  final EnvironmentDay? environment;

  /// Today only; null when history didn't load.
  final Streak? streak;

  /// This week's healthspan; today only, null when it didn't load.
  final HealthspanWeek? healthspan;

  /// Today only, with a weight goal; null when it didn't load.
  final WeightHistory? weights;
  final WeightUnit unit;

  /// Where the 3-week challenge from onboarding stands; today only.
  final ThreeWeeks? plan;
  final WeightGoal? weightGoal;

  /// A weight goal and no weigh-in for a week: Up next asks for one.
  final bool weighInDue;

  /// Today's coffee; null when it didn't load or for a past day.
  final CoffeeDay? coffee;

  bool get isToday => _sameDay(date, DateTime.now());
}

/// What Up next and the home-screen widget read from the day.
DayStatus _statusOf(_Day day) {
  final stack = day.stack?.items ?? const <StackItem>[];
  return DayStatus(
    sleepLogged: day.focus.components.sleep != null,
    checkedIn: day.bio.flags.isNotEmpty,
    daylight: day.environment == null ? null : day.environment!.check[EnvironmentItem.daylight] == true,
    meals: day.meals.length,
    movedMinutes: day.exercise?.totalMinutes ?? 0,
    supplementsLeft: stack.where((i) => !i.takenToday).length,
    fastingNow: day.fasting?.kind == FastingKind.fasting,
    weighInDue: day.weighInDue,
  );
}

bool _sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

const _weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const _months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/// "Thursday 2 October".
String longDate(DateTime d) => '${_weekdays[d.weekday - 1]} ${d.day} ${_months[d.month - 1]}';

String greeting(int hour) => switch (hour) {
  >= 5 && < 12 => 'Good morning',
  >= 12 && < 18 => 'Good afternoon',
  _ => 'Good evening',
};

/// One word for the score, shown beside the ring.
String scoreWord(int score) => switch (score) {
  >= 80 => 'Great',
  >= 65 => 'Good',
  >= 45 => 'Fair',
  _ => 'Low',
};

String _kcal(num n) => n.round().toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+$)'), (_) => ',');
String _clock(DateTime t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
String _hm(Duration d) => d.inHours > 0 ? '${d.inHours}h ${d.inMinutes % 60}m' : '${d.inMinutes}m';

/// "SR" for "Sam Rivera".
String initials(String name) =>
    name.trim().split(RegExp(r'\s+')).take(2).map((w) => w.isEmpty ? '' : w[0].toUpperCase()).join();

/// Today, in four parts that read top to bottom: the Focus Score with its six inputs, the one next
/// step, food (calories, meals, what to eat next) and the day's habits (Brain speed, exercise, how you
/// feel, supplements, surroundings). A week strip looks back at earlier days.
class TodayScreen extends StatefulWidget {
  const TodayScreen({
    super.key,
    required this.profile,
    required this.changes,
    required this.onChanged,
    required this.onCapture,
    required this.onOpenMe,
    required this.onOpenKitchen,
    required this.onOpenPantry,
  });

  final Profile profile;

  /// Fires when something was logged on any tab; [onChanged] tells the other tabs about this one.
  final Listenable changes;
  final VoidCallback onChanged;

  /// Runs a flow from the add menu (log a meal, check in, …).
  final void Function(Capture) onCapture;
  final VoidCallback onOpenMe;

  /// The fasting timer lives in Kitchen.
  final VoidCallback onOpenKitchen;
  final VoidCallback onOpenPantry;

  @override
  State<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends State<TodayScreen> {
  Future<_Day>? _day;

  /// The day shown; null is today.
  DateTime? _date;

  /// Last week's report is ready and not opened yet (Monday to Wednesday).
  var _reportDue = false;

  NeuroCalApi get _api => AppScope.of(context).api;

  /// Moves "Now" along: caffeine rises and wears off, and the fast's hours grow.
  late final Timer _tick = Timer.periodic(const Duration(minutes: 1), (_) {
    if (mounted && _date == null) setState(() {});
  });

  @override
  void initState() {
    super.initState();
    widget.changes.addListener(_refresh);
  }

  @override
  void dispose() {
    _tick.cancel();
    widget.changes.removeListener(_refresh);
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_day == null) _checkReport();
    _day ??= _load();
    _tick;
  }

  Future<void> _checkReport() async {
    final due = await weeklyReportDue(DateTime.now());
    if (mounted && due != _reportDue) setState(() => _reportDue = due);
  }

  Future<void> _openReport() async {
    await openWeeklyReport(context);
    await _checkReport();
  }

  /// One call for the whole screen; the server leaves out an extra that failed, so the day still shows.
  Future<_Day> _load() async {
    final date = _date ?? DateTime.now();
    final scope = AppScope.of(context);
    final reminders = scope.reminders;
    // The API keeps 31 days, so a longer streak shows as 31 until history goes further back.
    final history = _date == null
        ? _api.history(31).then<List<HistoryDay>?>((h) => h).catchError((Object _) => null)
        : Future.value(null);
    final healthspan = _date == null
        ? _api.healthspan().then<HealthspanWeek?>((h) => h).catchError((Object _) => null)
        : Future<HealthspanWeek?>.value(null);
    final goal = widget.profile.weightGoal;
    final weightsLoad = _date == null && goal != null
        ? _api.weights(days: 120).then<WeightHistory?>((w) => w).catchError((Object _) => null)
        : Future<WeightHistory?>.value(null);
    final unitLoad = WeightUnit.load(Localizations.localeOf(context));
    final coffeeLoad = _date == null
        ? _api.coffee().then<CoffeeDay?>((c) => c).catchError((Object _) => null)
        : Future<CoffeeDay?>.value(null);
    final prefsLoad = SharedPreferences.getInstance().then<SharedPreferences?>((p) => p).catchError((Object _) => null);
    final d = await _api.today(_date);
    // Today's ticks decide which supplement nudges are still due.
    if (_date == null) reminders?.supplements(d.stack?.items ?? const []).catchError((Object _) {});
    final days = await history;
    final weights = await weightsLoad;
    final lastWeighIn = weights?.entries.lastOrNull?.date;
    final weighInDue =
        goal != null &&
        weights != null &&
        (lastWeighIn == null || DateTime.now().difference(DateTime.parse(lastWeighIn)).inDays >= 7);
    // The challenge counts from "Hold to commit"; accounts from before that use the weight goal's start.
    ThreeWeeks? plan;
    final starting = startingFromProfile(widget.profile);
    if (_date == null && days != null && starting != null) {
      final id = widget.profile.id;
      final startedOn = (id == null ? null : (await prefsLoad)?.getString(challengeKey(id))) ?? goal?.startedOn;
      if (startedOn != null) {
        plan = threeWeeks(started: DateTime.parse(startedOn), starting: starting, days: days, today: DateTime.now());
      }
    }
    final streak = days == null ? null : streakFrom(days, date);
    // The evening nudge follows what's logged: set while a streak is at risk, gone once today counts.
    if (streak != null) reminders?.streak(days: streak.days, todayDone: streak.todayDone).catchError((Object _) {});
    final homeWidget = scope.homeWidget;
    if (homeWidget != null && _date == null) {
      final status = _statusOf(
        _Day(
          date,
          d.focus,
          d.bio,
          d.meals,
          stack: d.stack,
          exercise: d.exercise,
          environment: d.environment,
          fasting: d.fasting,
          weighInDue: weighInDue,
        ),
      );
      final score = d.focus.score;
      homeWidget
          .show((
            score: score,
            word: score == null ? 'No score yet' : scoreWord(score),
            next: stepTitle(nextStep(status, DateTime.now())),
            streakDays: streak?.days ?? 0,
          ))
          .catchError((Object _) {});
    }
    // A first full week is a good moment to ask for a rating.
    if (streak case (days: 7, todayDone: true)) {
      scope.reviewPrompt?.maybeAsk().then(
        (asked) => asked ? scope.analytics.track('review_prompted', {'moment': 'week_streak'}) : null,
      );
    }
    return _Day(
      date,
      d.focus,
      d.bio,
      d.meals,
      recipes: d.recipes,
      fasting: d.fasting?.kind == FastingKind.off ? null : d.fasting,
      planLimitHours: d.fasting?.planLimitHours ?? 0,
      fastingAll: d.fasting,
      stack: d.stack == null || d.stack!.items.isEmpty ? null : d.stack,
      brain: d.brain,
      exercise: d.exercise,
      environment: d.environment,
      streak: streak,
      healthspan: await healthspan,
      weights: weights,
      unit: await unitLoad,
      plan: plan,
      weightGoal: goal,
      weighInDue: weighInDue,
      coffee: await coffeeLoad,
    );
  }

  Future<void> _refresh() async {
    final next = _load();
    setState(() {
      _day = next;
    });
    try {
      await next;
    } catch (_) {
      // The FutureBuilder shows the error.
    }
  }

  void _show(DateTime day) {
    _date = _sameDay(day, DateTime.now()) ? null : day;
    _refresh();
  }

  Future<void> _manageStack() async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const StackScreen()));
    if (mounted) _refresh();
  }

  /// Morning daylight from the checklist: the same answer as the environment card's.
  Future<void> _daylight() async {
    try {
      await _api.saveEnvironmentCheck({EnvironmentItem.daylight: true});
      if (mounted) showToast(context, 'Daylight ticked');
    } catch (_) {
      if (mounted) showToast(context, "Couldn't save that. Try again.", ToastTone.problem);
    }
    widget.onChanged();
  }

  /// Health Connect or Apple Health: asks for access and imports last night straight away.
  Future<void> _connectSleep() async {
    final sync = AppScope.of(context).sleepSync;
    if (sync == null) return;
    final analytics = AppScope.of(context).analytics;
    final imported = await sync.connect(_api);
    if (imported != null) analytics.track('sleep_connected');
    if (!mounted) return;
    if (imported == null) {
      showToast(context, "${sync.source.name} didn't give access. You can still log sleep by hand.", ToastTone.info);
    } else if (imported > 0) {
      showToast(context, 'Sleep connected. Last night is in');
      widget.onChanged();
    } else {
      showToast(context, 'Sleep connected. Nights will come in as ${sync.source.name} records them', ToastTone.info);
    }
  }

  /// Straight into the guided routine; logged when it's done.
  Future<void> _calfPump() async {
    final logged = await showCalfRoutine(context);
    if (logged == null || !mounted) return;
    showToast(context, 'Exercise logged · ${logged.kcal} kcal burned');
    widget.onChanged();
  }

  /// "Plan a fast": a day without meals, or a longer fast.
  Future<void> _planFast(FastingStatus? status) async {
    final planned = await showPlanFastSheet(context, status);
    if (planned == null || !mounted) return;
    showToast(context, 'Fasting until ${fastEnd(planned.planUntil!, DateTime.now())}');
    widget.onChanged();
  }

  Future<void> _endFast() async {
    try {
      await _api.endFast();
      if (mounted) showToast(context, 'Fast ended', ToastTone.info);
    } catch (_) {
      if (mounted) showToast(context, "Couldn't end the fast. Try again.", ToastTone.problem);
    }
    widget.onChanged();
  }

  Future<void> _removeExercise(Exercise e) async {
    try {
      await _api.deleteExercise(e.id);
      if (mounted) showToast(context, 'Exercise removed', ToastTone.info);
    } catch (_) {
      if (mounted) showToast(context, "Couldn't remove the exercise. Try again.", ToastTone.problem);
    }
    widget.onChanged();
  }

  Future<void> _remove(Meal meal) async {
    try {
      await _api.deleteMeal(meal.id);
      if (mounted) showToast(context, 'Meal removed', ToastTone.info);
    } catch (_) {
      if (mounted) showToast(context, "Couldn't remove the meal. Try again.", ToastTone.problem);
    }
    widget.onChanged();
  }

  /// The rows of the habits card: Brain speed, exercise, how you feel, supplements and surroundings
  /// today; a past day shows only the exercise logged on it.
  List<Widget> _habits(_Day day) => [
    if (day.healthspan case final week? when day.isToday)
      _HealthspanRow(
        week,
        onOpen: () => showAppSheet<void>(
          context,
          title: 'This week',
          builder: (_) => HealthspanCard(changes: widget.changes),
        ),
      ),
    if (day.isToday) _BrainSpeed(day.brain, onCheck: () => widget.onCapture(Capture.brain)),
    if (day.exercise case final exercise? when exercise.exercises.isNotEmpty || day.isToday)
      _ExerciseCard(exercise, onLog: () => widget.onCapture(Capture.exercise), onRemove: _removeExercise),
    if (day.isToday)
      _Feeling(
        day.bio.flags,
        reminders: AppScope.of(context).reminders,
        onCheckIn: () => widget.onCapture(Capture.checkIn),
      ),
    if (day.coffee case final coffee? when day.isToday)
      _CoffeeRow(coffee, onLog: () => widget.onCapture(Capture.coffee)),
    if (day.isToday && day.stack != null) StackCard(day.stack!, onManage: _manageStack, framed: false),
    if (day.isToday && day.environment != null)
      EnvironmentCard(day.environment!, onChanged: widget.onChanged, framed: false),
  ];

  /// What today's coffee and supplements do together.
  List<ComboNote> _notes(_Day day) =>
      comboNotes(cups: day.coffee?.cups ?? const [], stack: day.stack?.items ?? const []);

  /// What the coffee and the fast are doing now; null on a past day.
  BodyState? _now(_Day day) {
    if (!day.isToday) return null;
    final bio = widget.profile.bioProfile ?? const {};
    return bodyStateAt(
      DateTime.now(),
      cups: day.coffee?.cups ?? const [],
      fasting: day.fasting,
      wakeHour: AppScope.of(context).reminders?.wakeHour ?? wakeHours[bio['wake']] ?? 7.0,
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final now = DateTime.now();
    final date = _date ?? now;
    final today = _date == null;
    final first = widget.profile.displayName.trim().split(RegExp(r'\s+')).first;
    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder(
          future: _day,
          builder: (context, snapshot) {
            final day = snapshot.data;
            return ListView(
              padding: const EdgeInsets.fromLTRB(Space.s4, Space.s3, Space.s4, Space.s6),
              children: [
                _TopBar(
                  date: today ? longDate(now) : 'Looking back',
                  title: today
                      ? (first.isEmpty ? greeting(now.hour) : '${greeting(now.hour)}, $first')
                      : longDate(date),
                  initials: initials(widget.profile.displayName),
                  fasting: today ? day?.fasting : null,
                  onOpenMe: widget.onOpenMe,
                  onOpenFasting: widget.onOpenKitchen,
                ),
                const SizedBox(height: Space.s3),
                _WeekStrip(selected: date, onPick: _show),
                const SizedBox(height: Space.s4),
                if (snapshot.hasError)
                  ScreenFailed(
                    title: today ? "Couldn't load today" : "Couldn't load this day",
                    detail: snapshot.error is ApiException && (snapshot.error as ApiException).unauthorized
                        ? 'Your session has ended. Sign out in Me and sign in again.'
                        : 'Your meals and score are safe. Check your connection and try again.',
                    onRetry: _refresh,
                  )
                else if (day == null ||
                    snapshot.connectionState == ConnectionState.waiting && !_sameDay(day.date, date))
                  const ScreenLoading(label: 'Loading the day', heights: [232, 120, 64, 150])
                else ...[
                  if (_now(day) case final state? when !state.isEmpty || _notes(day).isNotEmpty) ...[
                    NowStatus(state, notes: _notes(day)),
                    const SizedBox(height: Space.s3),
                  ],
                  _FocusCard(
                    day.focus,
                    state: _now(day),
                    onCheckIn: () => widget.onCapture(Capture.checkIn),
                    onLogSleep: () => widget.onCapture(Capture.sleep),
                    onLogScreens: () => widget.onCapture(Capture.screenTime),
                    onLogExercise: () => widget.onCapture(Capture.exercise),
                    onBrainCheck: day.isToday ? () => widget.onCapture(Capture.brain) : null,
                    onShare: day.isToday && day.focus.score != null
                        ? () => showShareScore(
                            context,
                            score: day.focus.score!,
                            word: scoreWord(day.focus.score!),
                            streakDays: day.streak?.days ?? 0,
                          )
                        : null,
                    onSetUpEnvironment: () async {
                      if (await showPlaceSheet(context) != null && mounted) widget.onChanged();
                    },
                  ),
                  if (day.isToday) ...[
                    const SizedBox(height: Space.s3),
                    _UpNext(
                      day,
                      sleepSync: AppScope.of(context).sleepSync,
                      onConnectSleep: _connectSleep,
                      onCapture: widget.onCapture,
                      onDaylight: _daylight,
                      onCalfPump: _calfPump,
                      onStack: _manageStack,
                      onHowItWorks: () => showGuide(context),
                      onPlanFast: day.planLimitHours > 0 ? () => _planFast(day.fastingAll) : null,
                    ),
                    if (day.plan != null || day.weightGoal != null) ...[
                      const SizedBox(height: Space.s3),
                      _PlanCard(day, onLogWeight: () => widget.onCapture(Capture.weight)),
                    ],
                    if (_reportDue) ...[const SizedBox(height: Space.s3), WeeklyReportCard(onOpen: _openReport)],
                  ],
                  BlockTitle(
                    day.fastPlanned ? 'Fasting' : 'Food',
                    note: day.meals.isEmpty
                        ? null
                        : '${day.meals.length} logged · ${_kcal(day.bio.caloriesEaten)} kcal',
                  ),
                  if (day.fastPlanned)
                    FastingCard(day.fasting!, onBoundary: _refresh, onEnd: _endFast)
                  else ...[
                    _Calories(day.bio),
                    if (day.isToday && day.planLimitHours > 0)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton.icon(
                          style: TextButton.styleFrom(foregroundColor: c.synapseInk, minimumSize: const Size(0, 44)),
                          onPressed: () => _planFast(day.fastingAll),
                          icon: const Icon(Icons.timelapse_rounded, size: 18),
                          label: const Text('Fasting today? Plan a fast'),
                        ),
                      ),
                  ],
                  const SizedBox(height: Space.s3),
                  // While fasting, an empty day has nothing to log.
                  if (day.meals.isEmpty && day.fastPlanned)
                    const SizedBox.shrink()
                  else if (day.meals.isEmpty)
                    day.isToday
                        ? EmptyCard(
                            title: 'No meals yet today',
                            detail: "Snap your first plate and we'll read it against your sleep and stress.",
                            action: SoftButton(
                              label: '+ Log a meal',
                              semanticLabel: 'Log a meal',
                              onPressed: () => widget.onCapture(Capture.meal),
                            ),
                          )
                        : const EmptyCard(title: 'No meals logged', detail: 'Nothing was logged on this day.')
                  else
                    AppCard(
                      padding: EdgeInsets.zero,
                      child: Column(
                        children: [
                          for (final (i, meal) in day.meals.indexed)
                            _MealRow(meal, divider: i > 0, onRemove: () => _remove(meal)),
                        ],
                      ),
                    ),
                  // Suggestions wait until the last two hours of a planned fast, to break it well.
                  if (day.isToday &&
                      (!day.fastPlanned ||
                          day.fasting!.planUntil!.difference(DateTime.now()) <= const Duration(hours: 2))) ...[
                    BlockTitle(day.fastPlanned ? 'Break your fast' : 'What to eat next'),
                    if (day.fastPlanned)
                      Padding(
                        padding: const EdgeInsets.only(bottom: Space.s2),
                        child: Text(
                          'Start with protein and vegetables, and keep the first meal moderate.',
                          style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
                        ),
                      ),
                    _Suggestions(day.recipes),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        style: TextButton.styleFrom(foregroundColor: c.synapseInk, minimumSize: const Size(0, 44)),
                        onPressed: widget.onOpenPantry,
                        icon: const Icon(Icons.kitchen_rounded, size: 18),
                        label: const Text('Cook from your pantry'),
                      ),
                    ),
                  ],
                  if (_habits(day) case final rows when rows.isNotEmpty) ...[
                    BlockTitle(day.isToday ? 'Today’s habits' : 'Habits'),
                    AppCard(
                      padding: EdgeInsets.zero,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (final (i, row) in rows.indexed) ...[if (i > 0) Divider(height: 1, color: c.rule), row],
                        ],
                      ),
                    ),
                  ],
                  if (!day.isToday)
                    Padding(
                      padding: const EdgeInsets.only(top: Space.s3),
                      child: Center(
                        child: TextButton(
                          style: TextButton.styleFrom(foregroundColor: c.synapseInk, minimumSize: const Size(0, 44)),
                          onPressed: () => _show(now),
                          child: const Text('Back to today'),
                        ),
                      ),
                    ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

/// The date and greeting, the fasting timer when it runs, and your initial, which opens Me.
class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.date,
    required this.title,
    required this.initials,
    required this.fasting,
    required this.onOpenMe,
    required this.onOpenFasting,
  });

  final String date;
  final String title;
  final String initials;
  final FastingStatus? fasting;
  final VoidCallback onOpenMe;
  final VoidCallback onOpenFasting;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final f = fasting;
    final now = DateTime.now();
    final chip = switch (f?.kind) {
      FastingKind.fasting when f!.since != null => (
        Icons.timelapse_rounded,
        'Fasting ${_hm(now.difference(f.since!))}',
        c.synapseSoft,
        c.synapseInk,
      ),
      FastingKind.fasted => (Icons.check_circle_outline_rounded, 'Fast done', c.chlorophyll, c.onAccent),
      FastingKind.eating when f!.closesAt != null => (
        Icons.restaurant_rounded,
        'Eat until ${_clock(f.closesAt!)}',
        c.glucoseSoft,
        c.glucoseInk,
      ),
      _ => null,
    };
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: Space.s2,
      children: [
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(left: Space.s1),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 2,
              children: [
                Text(
                  date,
                  style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w600, color: c.inkSoft),
                ),
                Semantics(
                  header: true,
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: TextSize.xxl,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                      height: 1.15,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (chip case (final icon, final label, final fill, final ink))
          Semantics(
            container: true,
            button: true,
            label: label,
            excludeSemantics: true,
            child: Material(
              color: fill,
              shape: const StadiumBorder(),
              child: InkWell(
                customBorder: const StadiumBorder(),
                onTap: onOpenFasting,
                child: Container(
                  height: 36,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    spacing: Space.s1,
                    children: [
                      Icon(icon, size: 16, color: ink),
                      Text(
                        label,
                        style: TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w700, color: ink),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        // Its own node: otherwise the date and greeting merge into it for screen readers.
        Semantics(
          container: true,
          button: true,
          label: 'Me',
          excludeSemantics: true,
          child: Material(
            color: c.synapseSoft,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onOpenMe,
              child: Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                child: Text(
                  initials,
                  style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w800, color: c.synapseInk),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// The last seven days, today on the right. Picking one shows that day.
class _WeekStrip extends StatelessWidget {
  const _WeekStrip({required this.selected, required this.onPick});

  final DateTime selected;
  final ValueChanged<DateTime> onPick;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final now = DateTime.now();
    final days = [for (var i = 6; i >= 0; i--) DateTime(now.year, now.month, now.day - i)];
    return Row(
      spacing: Space.s1,
      children: [
        for (final d in days)
          Expanded(
            child: Semantics(
              button: true,
              selected: _sameDay(d, selected),
              label: _sameDay(d, now) ? 'Today' : longDate(d),
              excludeSemantics: true,
              child: AnimatedContainer(
                duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : Motion.select,
                curve: Motion.settle,
                decoration: BoxDecoration(
                  color: _sameDay(d, selected) ? c.synapse : c.paper,
                  borderRadius: BorderRadius.circular(Radii.option),
                ),
                child: Material(
                  type: MaterialType.transparency,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(Radii.option),
                    onTap: () => onPick(d),
                    // Seven days in a fixed strip: letters and dates grow with large text only so far.
                    child: MediaQuery.withClampedTextScaling(
                      maxScaleFactor: 1.3,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(minHeight: 48),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          mainAxisAlignment: MainAxisAlignment.center,
                          spacing: 2,
                          children: [
                            Text(
                              weekdayShort[d.weekday - 1][0],
                              style: TextStyle(
                                fontSize: TextSize.xxs,
                                fontWeight: FontWeight.w600,
                                color: _sameDay(d, selected) ? c.onAccent : c.inkSoft,
                              ),
                            ),
                            Text(
                              '${d.day}',
                              style: TextStyle(
                                fontSize: TextSize.md,
                                fontWeight: FontWeight.w800,
                                color: _sameDay(d, selected) ? c.onAccent : c.ink,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// The hero: the ring, a word for the score, the explanation, and the six inputs behind it as one row
/// of small rings. Tapping an input says what it measures and offers the way to log it.
class _FocusCard extends StatelessWidget {
  const _FocusCard(
    this.focus, {
    required this.onCheckIn,
    required this.onLogSleep,
    required this.onLogScreens,
    required this.onLogExercise,
    required this.onSetUpEnvironment,
    this.onShare,
    this.onBrainCheck,
    this.state,
  });

  final FocusScore focus;

  /// Tints the card and lights the ring in the colours of what's going on now.
  final BodyState? state;

  /// Null where there's nothing to share (no score, a past day).
  final VoidCallback? onShare;
  final VoidCallback onCheckIn;
  final VoidCallback onLogSleep;
  final VoidCallback onLogScreens;
  final VoidCallback onLogExercise;
  final VoidCallback onSetUpEnvironment;

  /// Today only: a Brain speed check, which measures the day and moves the score.
  final VoidCallback? onBrainCheck;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final score = focus.score;
    final parts = focus.components;
    final signals = [
      ('Sleep', 'Sleep', 'Last night', parts.sleep, null as String?),
      ('Evening timing', 'Evening', 'Late food and screens', parts.timing, null),
      focus.glycemicFromSensor
          ? ('Blood sugar', 'Sugar', 'From your glucose sensor', parts.glycemic, null)
          : ('Glycemic load', 'Food', "Yesterday's food", parts.glycemic, 'Builds from meals'),
      ('Stress', 'Stress', 'Recent check-ins', parts.stress, null),
      ('Movement', 'Move', "Yesterday's exercise", parts.movement, null),
      ('Environment', 'Air', 'Air and surroundings', parts.environment, null),
    ];
    // The one bold surface in the app: the ring's blue-to-teal, washed faintly across the card, or the
    // colours of what's going on now (amber caffeine, violet fat fast, teal fast).
    final now = state == null ? const <Color>[] : stateColors(state!, c);
    final tint = now.isEmpty ? [NeuroCalColors.ringFrom, NeuroCalColors.ringTo] : [now.first, now.last];
    return AnimatedContainer(
      duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : Motion.dial,
      curve: Motion.settle,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(Radii.hero),
        border: Border.all(color: c.rule),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color.alphaBlend(tint.first.withValues(alpha: now.isEmpty ? 0.14 : 0.18), c.paper),
            c.paper,
            Color.alphaBlend(tint.last.withValues(alpha: now.isEmpty ? 0.12 : 0.16), c.paper),
          ],
          stops: const [0, 0.55, 1],
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              StateAura(
                colors: now,
                intensity: state?.intensity ?? 0,
                child: FocusRing(
                  score: score,
                  size: 104,
                  // The number has to fit the ring: it grows with large text only so far.
                  child: MediaQuery.withClampedTextScaling(
                    maxScaleFactor: 1.3,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          score?.toString() ?? '–',
                          style: TextStyle(
                            fontSize: TextSize.xxxl,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -1,
                            height: 1,
                            color: score == null ? c.inkFaint : c.ink,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                        if (score != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 3),
                            child: Text(
                              'of 100',
                              style: TextStyle(fontSize: TextSize.xxxs, fontWeight: FontWeight.w500, color: c.inkSoft),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: Space.s4),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: Space.s1,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Focus Score',
                            style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w600, color: c.synapseInk),
                          ),
                        ),
                        // No check yet today: one tap measures the day.
                        if (onBrainCheck != null && focus.measured == null && score != null)
                          SizedBox.square(
                            dimension: 48,
                            child: IconButton(
                              tooltip: 'Measure today with a Brain speed check',
                              padding: EdgeInsets.zero,
                              onPressed: onBrainCheck,
                              icon: Icon(Icons.bolt_rounded, size: 20, color: c.synapseInk),
                            ),
                          ),
                        if (onShare != null)
                          SizedBox.square(
                            dimension: 48,
                            child: IconButton(
                              tooltip: 'Share my score',
                              padding: EdgeInsets.zero,
                              onPressed: onShare,
                              icon: Icon(Icons.ios_share_rounded, size: 18, color: c.synapseInk),
                            ),
                          ),
                      ],
                    ),
                    Text(
                      // Without sleep the score is only part of the day: no "Great" until it's in.
                      score == null ? 'No score yet' : (parts.sleep == null ? 'So far' : scoreWord(score)),
                      style: const TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800, height: 1.15),
                    ),
                    Text(
                      focus.explanation,
                      style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
                    ),
                    if (focus.measured case final m?) _MeasuredLine(m),
                    if (focus.tuned)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Row(
                          spacing: 4,
                          children: [
                            Icon(Icons.tune_rounded, size: 14, color: c.synapseInk),
                            Flexible(
                              child: Text(
                                'Weights tuned to your Brain speed',
                                style: TextStyle(
                                  fontSize: TextSize.xxs,
                                  fontWeight: FontWeight.w700,
                                  color: c.synapseInk,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: Space.s4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final (name, short, detail, value, waiting) in signals)
                Expanded(
                  child: _Input(
                    name: name,
                    short: short,
                    detail: detail,
                    value: value,
                    waiting: waiting,
                    action: switch (name) {
                      'Sleep' => (name: 'Log sleep', empty: 'Last night', run: onLogSleep),
                      'Evening timing' => (name: 'Log screen time', empty: 'Late food and screens', run: onLogScreens),
                      'Stress' => (name: 'Check in', empty: 'No check-ins yet', run: onCheckIn),
                      'Movement' => (name: 'Log exercise', empty: 'Counts once you log exercise', run: onLogExercise),
                      'Environment' => (
                        name: 'Set up environment',
                        empty: 'Your town’s air, or the check in your habits',
                        run: onSetUpEnvironment,
                      ),
                      _ => null,
                    },
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// What each input measures, said once in its sheet.
const _inputWhy = {
  'Sleep': 'Sleep counts most: one short night slows attention and reaction time the next day.',
  'Evening timing': 'Late meals and screens after 10 pm push your body clock back and cut deep sleep.',
  'Glycemic load': 'Meals that spike blood sugar bring a slump a couple of hours later.',
  'Blood sugar': 'Steady blood sugar means steady energy; big swings bring slumps.',
  'Stress': 'How you said you feel in your recent check-ins.',
  'Movement': 'Moving lifts focus for the next couple of hours, and helps you sleep.',
  'Environment': 'Morning daylight, a dark and quiet bedroom, clean water and the air where you live.',
};

/// One of the six inputs as a small ring in its body system's colour: full and green from 0.75,
/// amber below; a "+" when there's nothing yet and it can be logged.
/// What today's Brain speed check did to the score: the measured layer on top of the inputs.
class _MeasuredLine extends StatelessWidget {
  const _MeasuredLine(this.m);

  final MeasuredFocus m;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final (text, color) = m.usual == null
        ? ('Brain speed ${m.brainScore} today · a few more checks set your usual', c.inkSoft)
        : m.points > 0
        ? ('Brain speed +${m.points} · sharper than your usual', c.chlorophyll)
        : m.points < 0
        ? ('Brain speed −${-m.points} · slower than your usual', c.glucoseInk)
        : ('Brain speed at your usual · no change', c.inkSoft);
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Row(
        spacing: 4,
        children: [
          Icon(Icons.bolt_rounded, size: 14, color: color),
          Flexible(
            child: Text(
              text,
              style: TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w700, color: color),
            ),
          ),
        ],
      ),
    );
  }
}

class _Input extends StatelessWidget {
  const _Input({
    required this.name,
    required this.short,
    required this.detail,
    required this.value,
    this.waiting,
    this.action,
  });

  final String name;

  /// Fits under the ring, six across a phone.
  final String short;
  final String detail;
  final double? value;
  final String? waiting;

  /// The way to fill or update the input.
  final ({String name, String empty, VoidCallback run})? action;

  String get _word {
    final v = value;
    return v == null ? 'No data' : (v >= 0.75 ? 'Good' : (v >= 0.4 ? 'Moderate' : 'Low'));
  }

  (IconData, Color) _look(NeuroCalColors c) => switch (name) {
    'Sleep' => (Icons.bedtime_rounded, c.sleep),
    'Evening timing' => (Icons.nights_stay_rounded, c.ionInk),
    'Glycemic load' || 'Blood sugar' => (Icons.water_drop_rounded, c.glucoseInk),
    'Movement' => (Icons.directions_run_rounded, c.chlorophyll),
    'Environment' => (Icons.air_rounded, c.ionInk),
    _ => (Icons.spa_rounded, c.synapseInk),
  };

  void _open(BuildContext context) {
    final c = context.colors;
    final v = value;
    final good = v != null && v >= 0.75;
    final act = action;
    showAppSheet<void>(
      context,
      title: name,
      builder: (sheet) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 14,
        children: [
          Text(
            _word,
            style: TextStyle(
              fontSize: TextSize.xl,
              fontWeight: FontWeight.w800,
              color: v == null ? c.inkFaint : (good ? c.chlorophyll : c.glucoseInk),
            ),
          ),
          if (v != null) Meter(value: v, color: good ? c.chlorophyllBar : c.glucose, height: 8),
          Text(
            v != null ? detail : (waiting ?? act?.empty ?? 'Nothing logged yet'),
            style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
          ),
          if (_inputWhy[name] case final why?) Text(why, style: const TextStyle(fontSize: TextSize.sm, height: 1.4)),
          if (act != null)
            SheetAction(
              label: act.name,
              onPressed: () {
                Navigator.of(sheet).pop();
                act.run();
              },
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final v = value;
    final good = v != null && v >= 0.75;
    final (icon, ink) = _look(c);
    final add = v == null && action != null;
    return Semantics(
      button: true,
      label: '$name: $_word',
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.option),
        onTap: () => _open(context),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Column(
            spacing: 6,
            children: [
              SizedBox.square(
                dimension: 42,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox.expand(
                      child: CircularProgressIndicator(
                        value: v ?? 0,
                        strokeWidth: 3.5,
                        strokeCap: StrokeCap.round,
                        backgroundColor: c.track,
                        color: good ? c.chlorophyllBar : c.glucose,
                      ),
                    ),
                    Icon(
                      add ? Icons.add_rounded : icon,
                      size: 20,
                      color: v == null ? (add ? c.synapseInk : c.inkFaint) : ink,
                    ),
                  ],
                ),
              ),
              Text(
                short,
                maxLines: 1,
                style: TextStyle(
                  fontSize: TextSize.xxs,
                  fontWeight: FontWeight.w700,
                  color: v == null ? c.inkSoft : c.ink,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Calories extends StatelessWidget {
  const _Calories(this.bio);

  final BioState bio;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final left = bio.calorieTarget - bio.caloriesEaten.round();
    final over = left < 0;
    final stacked = MediaQuery.textScalerOf(context).scale(1) > 1.3;
    final macros = [
      ('Protein', bio.macrosEaten.proteinG, bio.macroTargets.proteinG, c.ion),
      ('Carbs', bio.macrosEaten.carbsG, bio.macroTargets.carbsG, c.glucose),
      ('Fat', bio.macrosEaten.fatG, bio.macroTargets.fatG, c.oil),
    ];
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(
                child: CountUp(
                  value: left.abs().toDouble(),
                  format: (v) => over ? '${_kcal(v)} kcal over' : '${_kcal(v)} kcal left',
                  style: TextStyle(
                    fontSize: TextSize.xl,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                    color: over ? c.beet : c.ink,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ),
              Flexible(
                child: Text(
                  bio.caloriesEaten > 0
                      ? '${_kcal(bio.caloriesEaten)} of ${_kcal(bio.calorieTarget)} eaten'
                      : 'Nothing eaten yet',
                  textAlign: TextAlign.end,
                  style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Meter(value: bio.caloriesEaten / bio.calorieTarget, color: over ? c.beet : c.synapse, height: 8),
          if (over)
            Padding(
              padding: const EdgeInsets.only(top: Space.s2),
              child: Text(
                "Over today's target. No need to make up for it tomorrow.",
                style: TextStyle(fontSize: TextSize.xs, color: c.beet),
              ),
            ),
          const SizedBox(height: 14),
          // Three across; stacked when large text wouldn't fit three.
          Flex(
            direction: stacked ? Axis.vertical : Axis.horizontal,
            // Full width when stacked; a row in a scrolling list has no height to stretch to.
            crossAxisAlignment: stacked ? CrossAxisAlignment.stretch : CrossAxisAlignment.start,
            spacing: 14,
            children: [
              for (final (name, got, goal, color) in macros)
                _Flexed(
                  stacked: stacked,
                  child: MergeSemantics(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      spacing: 5,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              margin: const EdgeInsets.only(right: 6),
                              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                            ),
                            Expanded(
                              child: Text(
                                name,
                                style: const TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700),
                              ),
                            ),
                            Text(
                              '${got.round()} g',
                              style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft),
                            ),
                          ],
                        ),
                        Meter(value: goal <= 0 ? 0 : got / goal, color: got > goal ? c.beet : color, height: 6),
                        Text(
                          'of ${goal.round()} g',
                          style: TextStyle(fontSize: TextSize.xxxs, color: c.inkFaint),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          if (bio.wholeKcal + bio.processedKcal + bio.ultraProcessedKcal > 0) ...[
            const SizedBox(height: 14),
            Divider(height: 1, color: c.rule),
            const SizedBox(height: Space.s3),
            _Processing(bio),
          ],
        ],
      ),
    );
  }
}

/// Expanded in a row; as it is in a column.
class _Flexed extends StatelessWidget {
  const _Flexed({required this.stacked, required this.child});

  final bool stacked;
  final Widget child;

  @override
  Widget build(BuildContext context) => stacked ? child : Expanded(child: child);
}

class _Feeling extends StatelessWidget {
  const _Feeling(this.flags, {required this.reminders, required this.onCheckIn});

  final List<CognitiveFlag> flags;

  /// For the check-in window open now; null where notifications aren't set up.
  final ReminderSettings? reminders;
  final VoidCallback onCheckIn;

  @override
  Widget build(BuildContext context) {
    final r = reminders;
    if (r == null) return _row(context, null);
    return ListenableBuilder(listenable: r, builder: (context, _) => _row(context, r));
  }

  Widget _row(BuildContext context, ReminderSettings? r) {
    final c = context.colors;
    final words = [for (final (i, flag) in flags.indexed) i == 0 ? flag.label : flag.label.toLowerCase()].join(', ');
    final now = DateTime.now();
    final window = r?.openAt(now);
    final done = window != null && r!.doneOn(now).contains(window);
    return Padding(
      padding: const EdgeInsets.fromLTRB(Space.s4, 14, Space.s3, 14),
      child: Row(
        children: [
          // The face of the first feeling picked, or a plain smile before the first check-in.
          Padding(
            padding: const EdgeInsets.only(right: Space.s3),
            child: flags.isEmpty
                ? Container(
                    width: 40,
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: c.synapseSoft, shape: BoxShape.circle),
                    child: Icon(Icons.mood_rounded, size: 22, color: c.synapseInk),
                  )
                : FeelingFace(flags.first, size: 44),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  flags.isEmpty ? 'How you feel' : 'You said you feel',
                  style: TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w600, color: c.inkSoft),
                ),
                const SizedBox(height: 2),
                Text(
                  flags.isEmpty ? 'No check-in yet today' : words,
                  style: TextStyle(
                    fontSize: TextSize.base,
                    fontWeight: FontWeight.w700,
                    color: flags.isEmpty ? c.inkFaint : c.ink,
                  ),
                ),
                if (window != null)
                  Padding(
                    padding: const EdgeInsets.only(top: Space.s1),
                    child: Row(
                      spacing: 4,
                      children: [
                        Icon(
                          done ? Icons.check_circle_rounded : Icons.schedule_rounded,
                          size: 14,
                          color: done ? c.chlorophyll : c.synapseInk,
                        ),
                        Flexible(
                          child: Text(
                            done
                                ? '${window.label} check-in done'
                                : '${window.label} window open until ${clock(window.on(now, r!.wakeHour).end)}',
                            style: TextStyle(
                              fontSize: TextSize.xxs,
                              fontWeight: FontWeight.w700,
                              color: done ? c.chlorophyll : c.synapseInk,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: Space.s3),
          SoftButton(label: 'Check in', onPressed: onCheckIn),
        ],
      ),
    );
  }
}

class _Suggestions extends StatefulWidget {
  const _Suggestions(this.recipes);

  final List<Recipe>? recipes;

  @override
  State<_Suggestions> createState() => _SuggestionsState();
}

class _SuggestionsState extends State<_Suggestions> {
  var _more = false;

  String _meta(Recipe r) => '${r.minutes} min · ${_kcal(r.calories)} kcal';

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final recipes = widget.recipes;
    if (recipes == null || recipes.isEmpty) {
      return AppCard(
        child: Text(
          recipes == null
              ? "Suggestions aren't available right now. They return on their own."
              : "No recipe fits what's left of today. Check back after your next meal.",
          style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
        ),
      );
    }
    final first = recipes.first;
    final chips = [(first.macros.proteinG, 'protein'), (first.macros.carbsG, 'carbs'), (first.macros.fatG, 'fat')];
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            first.title,
            style: const TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w800, height: 1.25),
          ),
          const SizedBox(height: Space.s1),
          Text(
            _meta(first),
            style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final (grams, label) in chips)
                // One run of text, so with large type a chip wraps instead of running off the card.
                Container(
                  constraints: const BoxConstraints(minHeight: 28),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: c.mist, borderRadius: BorderRadius.circular(Radii.pill)),
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: '${grams.round()} g ',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        TextSpan(text: label),
                      ],
                    ),
                    style: const TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w600),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Divider(height: 1, color: c.rule),
          const SizedBox(height: 10),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: 'Why it fits: ',
                  style: TextStyle(fontWeight: FontWeight.w700, color: c.ionInk),
                ),
                TextSpan(text: first.reasoning),
              ],
            ),
            style: const TextStyle(fontSize: TextSize.sm),
          ),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Recipe from ${first.sourceName}',
                  style: TextStyle(fontSize: TextSize.xxs, color: c.inkFaint),
                ),
              ),
              if (recipes.length > 1)
                TextButton(
                  style: TextButton.styleFrom(
                    minimumSize: const Size(0, 44),
                    textStyle: const TextStyle(
                      fontFamily: fontFamily,
                      fontSize: TextSize.sm,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  onPressed: () => setState(() => _more = !_more),
                  child: Text(_more ? 'Fewer ideas' : 'More ideas'),
                ),
            ],
          ),
          if (_more)
            for (final recipe in recipes.skip(1))
              Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: c.rule)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        recipe.title,
                        style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w600),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      _meta(recipe),
                      style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                    ),
                  ],
                ),
              ),
        ],
      ),
    );
  }
}

/// A small × that removes a logged meal or exercise: quieter than a word on every row, and still a
/// full-size tap target.
class _RemoveButton extends StatelessWidget {
  const _RemoveButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: label,
    excludeSemantics: true,
    child: SizedBox.square(
      dimension: 48,
      child: IconButton(
        padding: EdgeInsets.zero,
        onPressed: onPressed,
        icon: Icon(Icons.close_rounded, size: 18, color: context.colors.inkFaint),
      ),
    ),
  );
}

class _MealRow extends StatelessWidget {
  const _MealRow(this.meal, {required this.divider, required this.onRemove});

  final Meal meal;
  final bool divider;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final kind = meal.kind.name[0].toUpperCase() + meal.kind.name.substring(1);
    final name = meal.items.map((i) => i.name).join(', ');
    return Container(
      padding: const EdgeInsets.fromLTRB(14, Space.s3, Space.s2, Space.s2),
      decoration: BoxDecoration(
        border: divider ? Border(top: BorderSide(color: c.rule)) : null,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 44,
            child: Text(
              _clock(meal.eatenAt.toLocal()),
              style: TextStyle(
                fontSize: TextSize.xs,
                fontWeight: FontWeight.w600,
                color: c.inkSoft,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 3,
              children: [
                Text(
                  kind,
                  style: TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w700, color: c.inkSoft),
                ),
                Text(
                  name,
                  style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w600, height: 1.3),
                ),
                Text(
                  '${_kcal(meal.calories)} kcal',
                  style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: c.inkSoft),
                ),
                if (meal.highGlycemic)
                  Container(
                    margin: const EdgeInsets.only(top: 3),
                    padding: const EdgeInsets.symmetric(horizontal: Space.s2, vertical: 3),
                    decoration: BoxDecoration(color: c.glucoseSoft, borderRadius: BorderRadius.circular(Radii.pill)),
                    child: Text(
                      'High glycemic load',
                      style: TextStyle(fontSize: TextSize.xxxs, fontWeight: FontWeight.w700, color: c.glucoseInk),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          _RemoveButton(label: 'Remove $name', onPressed: onRemove),
        ],
      ),
    );
  }
}

/// How processed today's food was, inside the calories card: a bar of whole, processed and
/// ultra-processed calories, and the ultra-processed share in words. Items typed in by hand aren't counted.
class _Processing extends StatelessWidget {
  const _Processing(this.bio);

  final BioState bio;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final total = bio.wholeKcal + bio.processedKcal + bio.ultraProcessedKcal;
    final ultra = (bio.ultraProcessedKcal / total * 100).round();
    final parts = [
      (bio.wholeKcal, c.chlorophyll, 'Whole'),
      (bio.processedKcal, c.glucose, 'Processed'),
      (bio.ultraProcessedKcal, c.beet, 'Ultra-processed'),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: Space.s2,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: Space.s2,
          children: [
            const Expanded(
              child: Text(
                'How processed',
                style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800),
              ),
            ),
            // Both sides may wrap: with large text the label alone can be wider than the card.
            Flexible(
              child: Text(
                ultra == 0 ? 'No ultra-processed food' : '$ultra% ultra-processed',
                textAlign: TextAlign.end,
                style: TextStyle(
                  fontSize: TextSize.xs,
                  fontWeight: FontWeight.w700,
                  color: ultra >= 25 ? c.beet : c.inkSoft,
                ),
              ),
            ),
          ],
        ),
        Semantics(
          label: [
            for (final (kcal, _, name) in parts)
              if (kcal > 0) '$name ${(kcal / total * 100).round()}%',
          ].join(', '),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(Radii.pill),
            child: SizedBox(
              height: 10,
              child: Row(
                // Empty boxes take no height unless stretched to the bar's.
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final (kcal, color, _) in parts)
                    if (kcal > 0)
                      Expanded(
                        flex: kcal.round().clamp(1, 1 << 20),
                        child: ColoredBox(color: color),
                      ),
                ],
              ),
            ),
          ),
        ),
        Text(
          ultra >= 25
              ? 'Ultra-processed food is easy to overeat: in studies people ate about 500 kcal more a day on it without noticing. Swap one item for a whole food.'
              : 'Mostly whole food today. That keeps you full for fewer calories.',
          style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
        ),
      ],
    );
  }
}

/// "Your plan": the two halves of the promise side by side. The 3-week challenge (Focus Score from the
/// starting estimate towards its target, day by day) and the weight goal (the trend, what's gone, the
/// pace). Tapping the weight logs a weigh-in.
class _PlanCard extends StatelessWidget {
  const _PlanCard(this.day, {required this.onLogWeight});

  final _Day day;
  final VoidCallback onLogWeight;

  String _month(String iso) {
    final d = DateTime.parse(iso);
    return '${_months[d.month - 1]} ${d.year}';
  }

  /// "today", "yesterday" or "on 18 Oct" for a weigh-in's date.
  String _weighedOn(String iso) {
    final now = DateTime.now();
    final d = DateTime.parse(iso);
    final days = DateTime(now.year, now.month, now.day).difference(DateTime(d.year, d.month, d.day)).inDays;
    return days == 0 ? 'today' : (days == 1 ? 'yesterday' : 'on ${_since(iso)}');
  }

  String _since(String iso) {
    final d = DateTime.parse(iso);
    return '${d.day} ${_months[d.month - 1]}';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final plan = day.plan;
    final goal = day.weightGoal;
    final w = day.weights;
    final unit = day.unit;
    Widget pill(String text, bool good) =>
        Tag(text, fill: good ? c.chlorophyllSoft : c.glucoseSoft, ink: good ? c.chlorophyll : c.glucoseInk);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s3,
        children: [
          Semantics(
            header: true,
            child: Text(
              'Your plan',
              style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w800, color: c.synapseInk),
            ),
          ),
          if (plan != null)
            MergeSemantics(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: Space.s1,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          plan.day > challengeDays
                              ? '3 weeks done'
                              : '3-week challenge · day ${plan.day} of $challengeDays',
                          style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800),
                        ),
                      ),
                      if (plan.now != null && plan.day <= challengeDays)
                        pill(plan.onTrack ? 'On track' : 'Behind', plan.onTrack),
                    ],
                  ),
                  Text(
                    plan.now == null
                        ? 'Focus Score started at about ${plan.start}; aiming for ${plan.target}. Your first scores will show here.'
                        : plan.day > challengeDays
                        ? 'Focus Score from about ${plan.start} to ${plan.now} (aim was ${plan.target}). Keep the habits that got you here.'
                        : plan.now! >= plan.target
                        ? 'Focus Score ${plan.start} at the start, ${plan.now} this week: past your target of ${plan.target}.'
                        : 'Focus Score ${plan.start} at the start, ${plan.now} this week, aiming for ${plan.target}.',
                    style: TextStyle(fontSize: TextSize.xs, height: 1.35, color: c.inkSoft),
                  ),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(Radii.pill),
                    child: LinearProgressIndicator(
                      value: (plan.day / challengeDays).clamp(0.0, 1.0),
                      minHeight: 6,
                      backgroundColor: c.track,
                      color: c.synapse,
                    ),
                  ),
                ],
              ),
            ),
          if (goal != null)
            Semantics(
              button: true,
              label: 'Log weight',
              child: InkWell(
                onTap: onLogWeight,
                borderRadius: BorderRadius.circular(Radii.option),
                child: Row(
                  spacing: Space.s3,
                  children: [
                    Icon(Icons.monitor_weight_outlined, size: 22, color: c.ionInk),
                    Expanded(
                      child: w?.trendKg == null
                          ? Text(
                              'Weigh in to see your pace to ${unit.format(goal.targetKg)}.',
                              style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
                            )
                          : Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              spacing: 2,
                              children: [
                                Text(
                                  [
                                    // The weigh-in just entered, then the trend, which moves a tenth of the way
                                    // toward each weigh-in so a day's water doesn't swing it.
                                    if (w!.entries.lastOrNull case final last?) ...[
                                      '${unit.format(last.kg)} ${_weighedOn(last.date)}',
                                      'trend ${unit.format(w.trendKg!)}',
                                    ] else
                                      unit.format(w.trendKg!),
                                    if (goal.startKg - w.trendKg! >= 0.05)
                                      '${unit.format(goal.startKg - w.trendKg!)} down since ${_since(goal.startedOn)}',
                                  ].join(' · '),
                                  style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800),
                                ),
                                Text(
                                  w.toGoKg == null || w.toGoKg! <= 0
                                      ? 'At your target. Keep it there.'
                                      : w.projectedOn != null
                                      ? '${unit.format(w.toGoKg!)} to go · on pace for ${_month(w.projectedOn!)}'
                                      : '${unit.format(w.toGoKg!)} to go · not heading down yet. Protein first and a daily walk help most.',
                                  style: TextStyle(fontSize: TextSize.xs, height: 1.35, color: c.inkSoft),
                                ),
                              ],
                            ),
                    ),
                    Icon(Icons.add_rounded, color: c.synapseInk),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Today's coffee in the habits card: cups, caffeine, the last one and the curfew; "+ Cup" logs one.
class _CoffeeRow extends StatelessWidget {
  const _CoffeeRow(this.day, {required this.onLog});

  final CoffeeDay day;
  final VoidCallback onLog;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final cups = day.cups;
    final late = cups.any((cup) => cup.afterCurfew);
    final last = cups.isEmpty ? null : cups.last.takenAt;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Space.s4, 14, Space.s3, 14),
      child: Row(
        spacing: Space.s3,
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: c.glucoseSoft, shape: BoxShape.circle),
            child: Icon(Icons.coffee_rounded, size: 22, color: c.oil),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 2,
              children: [
                const Text(
                  'Coffee',
                  style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
                ),
                Text(
                  cups.isEmpty
                      ? 'Log each cup as you drink it. Black or Bulletproof keeps your fast. Last cup by ${day.curfew}.'
                      : '${cups.length} ${cups.length == 1 ? 'cup' : 'cups'} · ${day.caffeineMg} mg caffeine · last at ${_clock(last!)} · curfew ${day.curfew}',
                  style: TextStyle(fontSize: TextSize.xs, height: 1.35, color: c.inkSoft),
                ),
                if (late)
                  Text(
                    'A cup after ${day.curfew} can cost tonight’s deep sleep.',
                    style: TextStyle(
                      fontSize: TextSize.xs,
                      height: 1.35,
                      fontWeight: FontWeight.w700,
                      color: c.glucoseInk,
                    ),
                  ),
              ],
            ),
          ),
          SoftButton(label: '+ Cup', semanticLabel: 'Log a cup of coffee', onPressed: onLog),
        ],
      ),
    );
  }
}

/// The week's healthspan score in the habits card; opens the habits behind it.
class _HealthspanRow extends StatelessWidget {
  const _HealthspanRow(this.week, {required this.onOpen});

  final HealthspanWeek week;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final score = week.score;
    return Semantics(
      button: true,
      label: 'Healthspan${score == null ? '' : ' $score out of 100'}, ${week.done} of ${week.counted} habits this week',
      excludeSemantics: true,
      child: InkWell(
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Space.s4, 14, Space.s3, 14),
          child: Row(
            spacing: Space.s3,
            children: [
              if (score != null)
                HealthspanRing(score)
              else
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: c.chlorophyllSoft, shape: BoxShape.circle),
                  child: Icon(Icons.favorite_rounded, size: 22, color: c.chlorophyll),
                ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 2,
                  children: [
                    const Text(
                      'Healthspan',
                      style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
                    ),
                    Text(
                      '${week.done} of ${week.counted} longevity habits this week',
                      style: TextStyle(fontSize: TextSize.xs, height: 1.35, color: c.inkSoft),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: c.inkSoft),
            ],
          ),
        ),
      ),
    );
  }
}

/// Today's Brain speed against your usual, or the way into today's check.
class _BrainSpeed extends StatelessWidget {
  const _BrainSpeed(this.history, {required this.onCheck});

  final BrainCheckHistory? history;
  final VoidCallback onCheck;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final latest = history?.checks.firstOrNull;
    final now = DateTime.now();
    final today =
        latest != null &&
            latest.takenAt.year == now.year &&
            latest.takenAt.month == now.month &&
            latest.takenAt.day == now.day
        ? latest
        : null;
    final usual = history?.baselineScore;
    final diff = today != null && usual != null ? today.score - usual : null;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Space.s4, 14, Space.s3, 14),
      child: Row(
        spacing: Space.s3,
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [NeuroCalColors.ringFrom, NeuroCalColors.ringTo],
              ),
            ),
            child: const Icon(Icons.bolt_rounded, color: NeuroCalColors.onSignal),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 2,
              children: [
                const Text(
                  'Brain speed',
                  style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
                ),
                Text(
                  // Against your own usual, not a second 0-100 number beside the Focus Score.
                  today == null
                      ? 'A 2-minute reaction check. Do it daily to see what sharpens you.'
                      : diff == null
                      ? '${today.medianMs} ms typical reaction. A few more checks set your usual.'
                      : diff >= 0
                      ? '${today.medianMs} ms: as sharp as your usual or sharper.'
                      : '${today.medianMs} ms: slower than your usual. Sleep and daylight help most.',
                  style: TextStyle(fontSize: TextSize.xs, height: 1.35, color: c.inkSoft),
                ),
              ],
            ),
          ),
          if (today == null) SoftButton(label: 'Start', onPressed: onCheck),
        ],
      ),
    );
  }
}

/// The day's exercise: minutes and calories burned, each session, and the way to log one.
class _ExerciseCard extends StatelessWidget {
  const _ExerciseCard(this.day, {required this.onLog, required this.onRemove});

  final ExerciseDay day;
  final VoidCallback onLog;
  final void Function(Exercise) onRemove;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final empty = day.exercises.isEmpty;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Space.s4, 14, Space.s3, Space.s2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            spacing: Space.s3,
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: c.chlorophyllSoft, shape: BoxShape.circle),
                child: Icon(Icons.directions_run_rounded, size: 22, color: c.chlorophyll),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Exercise',
                      style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
                    ),
                    Text(
                      empty
                          ? 'Even a 20-minute walk lifts focus for the next couple of hours.'
                          : '${day.totalMinutes} min · ${_kcal(day.totalKcal)} kcal burned',
                      style: TextStyle(
                        fontSize: TextSize.xs,
                        height: 1.35,
                        color: empty ? c.inkSoft : c.chlorophyll,
                        fontWeight: empty ? null : FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              SoftButton(label: '+ Log', semanticLabel: 'Log exercise', onPressed: onLog),
            ],
          ),
          if (!empty) const SizedBox(height: Space.s2),
          // Each under the card's icon: what it was in bold, how long, how hard and the calories below,
          // and a small × to remove it.
          for (final e in day.exercises)
            Container(
              padding: const EdgeInsets.symmetric(vertical: Space.s1),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: c.rule)),
              ),
              child: Row(
                spacing: Space.s3,
                children: [
                  SizedBox(
                    width: 40,
                    child: Center(
                      child: Container(
                        width: 32,
                        height: 32,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: c.chlorophyllSoft, borderRadius: BorderRadius.circular(10)),
                        child: Icon(exerciseIcon(e.kind), size: 18, color: c.chlorophyll),
                      ),
                    ),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          e.kind.label,
                          style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
                        ),
                        Text(
                          '${e.minutes} min · ${e.intensity.label.toLowerCase()} · ${e.kcal} kcal',
                          style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                        ),
                      ],
                    ),
                  ),
                  _RemoveButton(label: 'Remove ${e.kind.label.toLowerCase()}', onPressed: () => onRemove(e)),
                ],
              ),
            ),
          if (day.estimatedWeight && !empty)
            Padding(
              padding: const EdgeInsets.only(top: Space.s2, left: 52),
              child: Text(
                'Calories assume 70 kg until you log your weight.',
                style: TextStyle(fontSize: TextSize.xxs, color: c.inkFaint),
              ),
            ),
          const SizedBox(height: Space.s1),
        ],
      ),
    );
  }
}

/// "Up next": the one thing to do now, with the button that does it, so nobody has to work out what
/// comes next. It moves on by itself as things are logged; the whole day folds out below.
class _UpNext extends StatefulWidget {
  const _UpNext(
    this.day, {
    required this.sleepSync,
    required this.onConnectSleep,
    required this.onCapture,
    required this.onDaylight,
    required this.onCalfPump,
    required this.onStack,
    required this.onHowItWorks,
    this.onPlanFast,
  });

  final _Day day;

  /// Rebuilds the card when sleep is connected or disconnected.
  final SleepSync? sleepSync;
  final VoidCallback onConnectSleep;
  final void Function(Capture) onCapture;
  final VoidCallback onDaylight;
  final VoidCallback onCalfPump;
  final VoidCallback onStack;
  final VoidCallback onHowItWorks;

  /// Null when a fast can't be planned.
  final VoidCallback? onPlanFast;

  @override
  State<_UpNext> createState() => _UpNextState();
}

class _UpNextState extends State<_UpNext> {
  var _open = false;

  @override
  void initState() {
    super.initState();
    widget.sleepSync?.addListener(_rebuild);
  }

  @override
  void didUpdateWidget(_UpNext old) {
    super.didUpdateWidget(old);
    if (old.sleepSync != widget.sleepSync) {
      old.sleepSync?.removeListener(_rebuild);
      widget.sleepSync?.addListener(_rebuild);
    }
  }

  @override
  void dispose() {
    widget.sleepSync?.removeListener(_rebuild);
    super.dispose();
  }

  void _rebuild() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final sync = widget.sleepSync;
    final access = sync?.access ?? SleepAccess.unavailable;
    final store = sync?.source.name ?? '';
    final day = widget.day;
    final stack = day.stack?.items ?? const <StackItem>[];
    final status = _statusOf(day);
    final step = nextStep(status, DateTime.now());
    final (icon, title, why, action, onAction) = switch (step) {
      DayStep.sleep when access == SleepAccess.notConnected => (
        Icons.bedtime_rounded,
        'Connect your sleep',
        'NeuroCal reads last night’s sleep from $store, so you never have to type it in.',
        'Connect $store',
        widget.onConnectSleep,
      ),
      DayStep.sleep => (
        Icons.bedtime_rounded,
        stepTitle(DayStep.sleep),
        access == SleepAccess.connected
            ? 'Nothing from $store for last night yet. Log it by hand, or check your watch or sleep app saves to $store.'
            : 'Sleep is the biggest part of your Focus Score.',
        'Log sleep',
        () => widget.onCapture(Capture.sleep),
      ),
      DayStep.checkIn => (
        Icons.mood_rounded,
        stepTitle(DayStep.checkIn),
        'Tap how you feel right now. It takes ten seconds.',
        'Check in',
        () => widget.onCapture(Capture.checkIn),
      ),
      DayStep.weigh => (
        Icons.monitor_weight_outlined,
        stepTitle(DayStep.weigh),
        'Once a week, first thing in the morning before you eat. Your trend smooths out water swings.',
        'Log weight',
        () => widget.onCapture(Capture.weight),
      ),
      DayStep.daylight => (
        Icons.wb_sunny_rounded,
        stepTitle(DayStep.daylight),
        'Morning light sets your body clock, so you sleep better tonight. Step outside, then tap below.',
        'I’ve been outside',
        widget.onDaylight,
      ),
      DayStep.meal => (
        Icons.photo_camera_rounded,
        stepTitle(DayStep.meal),
        'Snap your plate before you eat. NeuroCal works out the rest.',
        'Log a meal',
        () => widget.onCapture(Capture.meal),
      ),
      DayStep.move => (
        Icons.directions_run_rounded,
        stepTitle(DayStep.move),
        'A guided calf pump you can do at your desk. It’s logged when you finish.',
        'Start the calf pump',
        widget.onCalfPump,
      ),
      DayStep.supplements => (
        Icons.medication_rounded,
        stepTitle(DayStep.supplements),
        '${status.supplementsLeft} still to take today. Tick them off in your stack.',
        'Open my stack',
        widget.onStack,
      ),
      DayStep.allDone => (
        Icons.check_circle_rounded,
        stepTitle(DayStep.allDone),
        day.fastPlanned
            ? 'You’re fasting until ${fastEnd(day.fasting!.planUntil!, DateTime.now())}. Water, black coffee and plain tea don’t break it.'
            : status.fastingNow && day.meals.isEmpty
            ? 'You’re fasting. Log your first meal when your eating window opens.'
            : 'Tomorrow’s score has what it needs. Log meals as you eat them.',
        'Log a meal',
        () => widget.onCapture(Capture.meal),
      ),
    };
    final secondary = switch (step) {
      DayStep.meal when widget.onPlanFast != null => ('I’m fasting today', widget.onPlanFast!),
      DayStep.move => ('Log other exercise', () => widget.onCapture(Capture.exercise)),
      DayStep.sleep when access == SleepAccess.notConnected => (
        'Log it by hand',
        () => widget.onCapture(Capture.sleep),
      ),
      _ => null,
    };

    final items = <({String title, bool done})>[
      (title: 'Log last night’s sleep', done: status.sleepLogged),
      (title: 'Check in', done: status.checkedIn),
      if (day.weightGoal != null) (title: 'Weigh in this week', done: !status.weighInDue),
      if (status.daylight != null) (title: 'Get morning daylight', done: status.daylight!),
      (title: 'Log your meals', done: status.meals > 0),
      (title: 'Move', done: status.movedMinutes > 0),
      if (stack.isNotEmpty) (title: 'Take your supplements', done: status.supplementsLeft == 0),
    ];
    final done = items.where((i) => i.done).length;
    final still = MediaQuery.disableAnimationsOf(context);
    final finished = step == DayStep.allDone;

    return AppCard(
      padding: const EdgeInsets.fromLTRB(Space.s4, Space.s3, Space.s2, Space.s3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Semantics(
                  header: true,
                  child: Text(
                    finished ? 'Your day' : 'Up next',
                    style: TextStyle(
                      fontSize: TextSize.xs,
                      fontWeight: FontWeight.w800,
                      color: finished ? c.chlorophyll : c.synapseInk,
                    ),
                  ),
                ),
              ),
              Flexible(
                child: Text(
                  '$done of ${items.length} done',
                  textAlign: TextAlign.end,
                  style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: c.inkSoft),
                ),
              ),
              IconButton(
                tooltip: 'How NeuroCal works',
                onPressed: widget.onHowItWorks,
                icon: Icon(Icons.help_outline_rounded, size: 20, color: c.inkSoft),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(right: Space.s2),
            child: TweenAnimationBuilder<double>(
              tween: Tween(end: items.isEmpty ? 0 : done / items.length),
              duration: still ? Duration.zero : Motion.select,
              curve: Motion.settle,
              builder: (context, v, _) => ClipRRect(
                borderRadius: BorderRadius.circular(Radii.pill),
                child: LinearProgressIndicator(value: v, minHeight: 6, backgroundColor: c.track, color: c.chlorophyll),
              ),
            ),
          ),
          if (day.streak case final streak?) ...[
            const SizedBox(height: Space.s2),
            Row(
              spacing: 6,
              children: [
                Icon(Icons.local_fire_department_rounded, size: 18, color: streak.days > 0 ? c.glucoseInk : c.inkFaint),
                Expanded(
                  child: Text(
                    streak.days == 0
                        ? 'Log something today to start a streak'
                        : streak.todayDone
                        ? '${streak.days}-day streak. Today counts'
                        : '${streak.days}-day streak. Log a meal or your sleep to keep it',
                    style: TextStyle(
                      fontSize: TextSize.xs,
                      fontWeight: FontWeight.w700,
                      color: streak.days > 0 ? c.glucoseInk : c.inkSoft,
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: Space.s3),
          // The step slides in when the last one is done.
          AnimatedSwitcher(
            duration: still ? Duration.zero : Motion.select,
            transitionBuilder: (child, a) => FadeTransition(
              opacity: a,
              child: SlideTransition(
                position: Tween(begin: const Offset(0.15, 0), end: Offset.zero).animate(a),
                child: child,
              ),
            ),
            child: Padding(
              key: ValueKey(step),
              padding: const EdgeInsets.only(right: Space.s2),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: Space.s3,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: Space.s3,
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: finished ? c.chlorophyllSoft : c.synapseSoft,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(icon, size: 26, color: finished ? c.chlorophyll : c.synapseInk),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          spacing: 2,
                          children: [
                            Text(
                              title,
                              style: const TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w800, height: 1.2),
                            ),
                            Text(
                              why,
                              style: TextStyle(fontSize: TextSize.sm, height: 1.35, color: c.inkSoft),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  FilledButton(
                    style: finished
                        ? FilledButton.styleFrom(backgroundColor: c.chlorophyllSoft, foregroundColor: c.chlorophyll)
                        : null,
                    onPressed: () {
                      AppScope.of(context).analytics.track('up_next_tapped', {'step': step.name});
                      onAction();
                    },
                    child: Text(action),
                  ),
                  if (secondary != null) TextButton(onPressed: secondary.$2, child: Text(secondary.$1)),
                ],
              ),
            ),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              style: TextButton.styleFrom(foregroundColor: c.inkSoft),
              onPressed: () => setState(() => _open = !_open),
              icon: Icon(_open ? Icons.expand_less_rounded : Icons.expand_more_rounded, size: 20),
              label: Text(_open ? 'Hide the day' : 'See the whole day'),
            ),
          ),
          if (_open)
            for (final item in items)
              Semantics(
                container: true,
                label: '${item.title}, ${item.done ? 'done' : 'not done yet'}',
                excludeSemantics: true,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    spacing: Space.s3,
                    children: [
                      Icon(
                        item.done ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                        size: 22,
                        color: item.done ? c.chlorophyll : c.inkFaint,
                      ),
                      Expanded(
                        child: Text(
                          item.title,
                          style: TextStyle(
                            fontSize: TextSize.sm,
                            fontWeight: FontWeight.w600,
                            color: item.done ? c.inkSoft : c.ink,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
        ],
      ),
    );
  }
}
