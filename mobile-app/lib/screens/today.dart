import 'package:flutter/material.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/focus_ring.dart';
import '../widgets/share_card.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';
import '../health/sleep_sync.dart';
import '../reminders/reminders.dart';
import 'calf_routine.dart';
import 'capture.dart';
import 'environment_card.dart';
import 'exercise_sheet.dart';
import 'guide.dart';
import 'next_step.dart';
import 'streak.dart';
import 'stack.dart';

class _Day {
  const _Day(this.date, this.focus, this.bio, this.meals, {this.recipes, this.fasting, this.stack, this.brain, this.exercise, this.environment, this.streak});

  final DateTime date;
  final FocusScore focus;
  final BioState bio;
  final List<Meal> meals;

  /// Null when suggestions didn't load, or for a past day; the rest of the day still shows.
  final List<Recipe>? recipes;

  /// Null when fasting is off or didn't load.
  final FastingStatus? fasting;

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

  bool get isToday => _sameDay(date, DateTime.now());
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
String initials(String name) => name.trim().split(RegExp(r'\s+')).take(2).map((w) => w.isEmpty ? '' : w[0].toUpperCase()).join();

/// Today: a top bar with the week to look back on, the Focus Score and Brain speed, calories and how
/// processed the food was, how you feel, your supplements, what to eat next and the day's meals.
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

  NeuroCalApi get _api => AppScope.of(context).api;

  @override
  void initState() {
    super.initState();
    widget.changes.addListener(_refresh);
  }

  @override
  void dispose() {
    widget.changes.removeListener(_refresh);
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _day ??= _load();
  }

  /// One call for the whole screen; the server leaves out an extra that failed, so the day still shows.
  Future<_Day> _load() async {
    final date = _date ?? DateTime.now();
    final reminders = AppScope.of(context).reminders;
    final history = _date == null ? _api.history(60).then<List<HistoryDay>?>((h) => h).catchError((Object _) => null) : Future.value(null);
    final d = await _api.today(_date);
    final days = await history;
    final streak = days == null ? null : streakFrom(days, date);
    // The evening nudge follows what's logged: set while a streak is at risk, gone once today counts.
    if (streak != null) reminders?.streak(days: streak.days, todayDone: streak.todayDone).catchError((Object _) {});
    return _Day(
      date,
      d.focus,
      d.bio,
      d.meals,
      recipes: d.recipes,
      fasting: d.fasting?.kind == FastingKind.off ? null : d.fasting,
      stack: d.stack == null || d.stack!.items.isEmpty ? null : d.stack,
      brain: d.brain,
      exercise: d.exercise,
      environment: d.environment,
      streak: streak,
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
                  title: today ? (first.isEmpty ? greeting(now.hour) : '${greeting(now.hour)}, $first') : longDate(date),
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
                else if (day == null || snapshot.connectionState == ConnectionState.waiting && !_sameDay(day.date, date))
                  const ScreenLoading(label: 'Loading the day', heights: [232, 120, 64, 150])
                else ...[
                  if (day.isToday) ...[
                    _UpNext(
                      day,
                      sleepSync: AppScope.of(context).sleepSync,
                      onConnectSleep: _connectSleep,
                      onCapture: widget.onCapture,
                      onDaylight: _daylight,
                      onCalfPump: _calfPump,
                      onStack: _manageStack,
                      onHowItWorks: () => showGuide(context),
                    ),
                    const SizedBox(height: Space.s3),
                  ],
                  _FocusCard(
                    day.focus,
                    onCheckIn: () => widget.onCapture(Capture.checkIn),
                    onLogSleep: () => widget.onCapture(Capture.sleep),
                    onLogScreens: () => widget.onCapture(Capture.screenTime),
                    onLogExercise: () => widget.onCapture(Capture.exercise),
                    onShare: day.isToday && day.focus.score != null
                        ? () => showShareScore(context, score: day.focus.score!, word: scoreWord(day.focus.score!), streakDays: day.streak?.days ?? 0)
                        : null,
                    onSetUpEnvironment: () async {
                      if (await showPlaceSheet(context) != null && mounted) widget.onChanged();
                    },
                  ),
                  if (day.isToday) ...[
                    const SizedBox(height: Space.s3),
                    _BrainSpeed(day.brain, onCheck: () => widget.onCapture(Capture.brain)),
                  ],
                  const SizedBox(height: Space.s3),
                  _Calories(day.bio),
                  if (day.bio.wholeKcal + day.bio.processedKcal + day.bio.ultraProcessedKcal > 0) ...[
                    const SizedBox(height: Space.s3),
                    _Processing(day.bio),
                  ],
                  if (day.exercise case final exercise? when exercise.exercises.isNotEmpty || day.isToday) ...[
                    const SizedBox(height: Space.s3),
                    _ExerciseCard(exercise, onLog: () => widget.onCapture(Capture.exercise), onRemove: _removeExercise),
                  ],
                  if (day.isToday && day.environment != null) ...[
                    const SizedBox(height: Space.s3),
                    EnvironmentCard(day.environment!, onChanged: widget.onChanged),
                  ],
                  if (day.isToday) ...[
                    const SizedBox(height: Space.s3),
                    _Feeling(day.bio.flags, reminders: AppScope.of(context).reminders, onCheckIn: () => widget.onCapture(Capture.checkIn)),
                    if (day.stack != null) ...[
                      const SizedBox(height: Space.s3),
                      StackCard(day.stack!, onManage: _manageStack),
                    ],
                    const BlockTitle('What to eat next'),
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
                  BlockTitle(
                    day.isToday ? 'Meals today' : 'Meals',
                    note: day.meals.isEmpty ? null : '${day.meals.length} logged · ${_kcal(day.bio.caloriesEaten)} kcal',
                  ),
                  if (day.meals.isEmpty)
                    day.isToday
                        ? EmptyCard(
                            title: 'No meals yet today',
                            detail: "Snap your first plate and we'll read it against your sleep and stress.",
                            action: SoftButton(label: '+ Log a meal', semanticLabel: 'Log a meal', onPressed: () => widget.onCapture(Capture.meal)),
                          )
                        : const EmptyCard(title: 'No meals logged', detail: 'Nothing was logged on this day.')
                  else
                    AppCard(
                      padding: EdgeInsets.zero,
                      child: Column(
                        children: [
                          for (final (i, meal) in day.meals.indexed) _MealRow(meal, divider: i > 0, onRemove: () => _remove(meal)),
                        ],
                      ),
                    ),
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
      FastingKind.fasting when f!.since != null => (Icons.timelapse_rounded, 'Fasting ${_hm(now.difference(f.since!))}', c.synapseSoft, c.synapseInk),
      FastingKind.fasted => (Icons.check_circle_outline_rounded, 'Fast done', c.chlorophyll, c.onAccent),
      FastingKind.eating when f!.closesAt != null => (Icons.restaurant_rounded, 'Eat until ${_clock(f.closesAt!)}', c.glucoseSoft, c.glucoseInk),
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
                Text(date, style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w600, color: c.inkSoft)),
                Semantics(
                  header: true,
                  child: Text(title, style: const TextStyle(fontSize: TextSize.xxl, fontWeight: FontWeight.w800, letterSpacing: -0.5, height: 1.15)),
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
                      Text(label, style: TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w700, color: ink)),
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
                child: Text(initials, style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w800, color: c.synapseInk)),
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
                  boxShadow: [
                    if (_sameDay(d, selected)) BoxShadow(color: c.synapse.withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, 4)),
                  ],
                ),
                child: Material(
                  type: MaterialType.transparency,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(Radii.option),
                    onTap: () => onPick(d),
                    child: SizedBox(
                      height: 56,
                      child: Column(
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
      ],
    );
  }
}

/// The hero: the ring, a word for the score, the explanation, and the four signals behind it.
class _FocusCard extends StatelessWidget {
  const _FocusCard(
    this.focus, {
    required this.onCheckIn,
    required this.onLogSleep,
    required this.onLogScreens,
    required this.onLogExercise,
    required this.onSetUpEnvironment,
    this.onShare,
  });

  final FocusScore focus;

  /// Null where there's nothing to share (no score, a past day).
  final VoidCallback? onShare;
  final VoidCallback onCheckIn;
  final VoidCallback onLogSleep;
  final VoidCallback onLogScreens;
  final VoidCallback onLogExercise;
  final VoidCallback onSetUpEnvironment;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final score = focus.score;
    final parts = focus.components;
    final signals = [
      ('Sleep', 'Last night', parts.sleep, null as String?),
      ('Evening timing', 'Late food and screens', parts.timing, null),
      ('Glycemic load', "Yesterday's food", parts.glycemic, 'Builds from meals'),
      ('Stress', 'Recent check-ins', parts.stress, null),
      ('Movement', "Yesterday's exercise", parts.movement, null),
      ('Environment', 'Air and surroundings', parts.environment, null),
    ];
    // The one bold surface in the app: the ring's blue-to-teal, washed faintly across the card.
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(Radii.hero),
        border: Border.all(color: c.rule),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color.alphaBlend(NeuroCalColors.ringFrom.withValues(alpha: 0.14), c.paper),
            c.paper,
            Color.alphaBlend(NeuroCalColors.ringTo.withValues(alpha: 0.12), c.paper),
          ],
          stops: const [0, 0.55, 1],
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              FocusRing(
                score: score,
                size: 104,
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
                        if (onShare != null)
                          SizedBox.square(
                            dimension: 32,
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
                      score == null ? 'No score yet' : scoreWord(score),
                      style: const TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800, height: 1.15),
                    ),
                    Text(
                      focus.explanation,
                      style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
                    ),
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
                                style: TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w700, color: c.synapseInk),
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
          for (var row = 0; row < (signals.length + 1) ~/ 2; row++) ...[
            if (row > 0) const SizedBox(height: Space.s2),
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: Space.s2,
                children: [
                  for (final (name, detail, value, waiting) in signals.skip(row * 2).take(2))
                    Expanded(
                      child: _Signal(
                        name: name,
                        detail: detail,
                        value: value,
                        waiting: waiting,
                        action: switch (name) {
                          'Sleep' => (label: 'Log', name: 'Log sleep', empty: 'Last night', run: onLogSleep),
                          'Evening timing' => (
                            label: 'Log',
                            name: 'Log screen time',
                            empty: 'Late food and screens',
                            run: onLogScreens,
                          ),
                          'Stress' => (label: 'Check in', name: 'Check in', empty: 'No check-ins yet', run: onCheckIn),
                          'Movement' => (label: 'Log', name: 'Log exercise', empty: 'Counts once you log exercise', run: onLogExercise),
                          'Environment' => (label: 'Set up', name: 'Set up environment', empty: 'Your town’s air, or the check below', run: onSetUpEnvironment),
                          _ => null,
                        },
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// One of the four inputs: good from 0.75, otherwise "watch this"; without data it says what fills it.
class _Signal extends StatelessWidget {
  const _Signal({required this.name, required this.detail, required this.value, this.waiting, this.action});

  final String name;
  final String detail;
  final double? value;
  final String? waiting;

  /// What fills the signal when it has no data yet.
  final ({String label, String name, String empty, VoidCallback run})? action;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final v = value;
    final good = v != null && v >= 0.75;
    final word = v == null ? 'No data' : (good ? 'Good' : (v >= 0.4 ? 'Moderate' : 'Low'));
    final small = TextStyle(fontSize: TextSize.xxs, color: c.inkFaint);
    // Each signal wears its body system's colour.
    final (icon, ink, fill) = switch (name) {
      'Sleep' => (Icons.bedtime_rounded, c.sleep, c.sleepSoft),
      'Evening timing' => (Icons.nights_stay_rounded, c.ionInk, c.ionSoft),
      'Glycemic load' => (Icons.water_drop_rounded, c.glucoseInk, c.glucoseSoft),
      'Movement' => (Icons.directions_run_rounded, c.chlorophyll, c.chlorophyllSoft),
      'Environment' => (Icons.air_rounded, c.ionInk, c.ionSoft),
      _ => (Icons.spa_rounded, c.synapseInk, c.synapseSoft),
    };
    return Semantics(
      container: true,
      label: '$name: $word',
      child: Container(
        constraints: const BoxConstraints(minHeight: 74),
        padding: const EdgeInsets.symmetric(horizontal: Space.s3, vertical: 10),
        decoration: BoxDecoration(color: fill.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(Radii.option)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: Space.s1,
          children: [
            ExcludeSemantics(
              child: Row(
                spacing: 5,
                children: [
                  Icon(icon, size: 14, color: ink),
                  Flexible(
                    child: Text(
                      name,
                      style: TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w700, color: ink),
                    ),
                  ),
                ],
              ),
            ),
            if (v != null) ...[
              ExcludeSemantics(
                child: Text(
                  word,
                  style: TextStyle(
                    fontSize: TextSize.md,
                    fontWeight: FontWeight.w700,
                    color: good ? c.chlorophyll : c.glucoseInk,
                  ),
                ),
              ),
              Meter(value: v, color: good ? c.chlorophyllBar : c.glucose),
              Text(detail, style: small),
            ] else if (action != null) ...[
              SoftButton(label: '+ ${action!.label}', semanticLabel: action!.name, height: 32, onPressed: action!.run),
              Text(action!.empty, style: small),
            ] else ...[
              ExcludeSemantics(
                child: Text(
                  '–',
                  style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700, color: c.inkFaint),
                ),
              ),
              Text(waiting ?? 'Nothing logged yet', style: small),
            ],
          ],
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
              Text(
                bio.caloriesEaten > 0
                    ? '${_kcal(bio.caloriesEaten)} of ${_kcal(bio.calorieTarget)} eaten'
                    : 'Nothing eaten yet',
                style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
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
          Row(
            spacing: 14,
            children: [
              for (final (name, got, goal, color) in macros)
                Expanded(
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
        ],
      ),
    );
  }
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
    if (r == null) return _card(context, null);
    return ListenableBuilder(listenable: r, builder: (context, _) => _card(context, r));
  }

  Widget _card(BuildContext context, ReminderSettings? r) {
    final c = context.colors;
    final words = [for (final (i, flag) in flags.indexed) i == 0 ? flag.label : flag.label.toLowerCase()].join(', ');
    final now = DateTime.now();
    final window = r?.openAt(now);
    final done = window != null && r!.doneOn(now).contains(window);
    return AppCard(
      padding: const EdgeInsets.fromLTRB(Space.s4, Space.s3, Space.s3, Space.s3),
      child: Row(
        children: [
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
                        Icon(done ? Icons.check_circle_rounded : Icons.schedule_rounded, size: 14, color: done ? c.chlorophyll : c.synapseInk),
                        Flexible(
                          child: Text(
                            done
                                ? '${window.label} check-in done'
                                : '${window.label} window open until ${clock(window.on(now, r!.wakeHour).end)}',
                            style: TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w700, color: done ? c.chlorophyll : c.synapseInk),
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
                Container(
                  height: 28,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(color: c.mist, borderRadius: BorderRadius.circular(Radii.pill)),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${grams.round()} g ',
                        style: const TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w800),
                      ),
                      Text(
                        label,
                        style: const TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w600),
                      ),
                    ],
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
                    textStyle: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
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
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: Text(
                  '${_kcal(meal.calories)} kcal',
                  style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
                ),
              ),
              Semantics(
                button: true,
                label: 'Remove $name',
                excludeSemantics: true,
                child: InkWell(
                  borderRadius: BorderRadius.circular(Radii.pill),
                  onTap: onRemove,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
                    child: Text(
                      'Remove',
                      style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w600, color: c.inkSoft),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// How processed today's food was: a bar of whole, processed and ultra-processed calories, and the
/// ultra-processed share in words. Items typed in by hand aren't counted.
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
    return AppCard(
      padding: const EdgeInsets.all(Space.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s2,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: Space.s2,
            children: [
              const Expanded(
                child: Text('How processed', style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800)),
              ),
              // Both sides may wrap: with large text the label alone can be wider than the card.
              Flexible(
                child: Text(
                  ultra == 0 ? 'No ultra-processed food' : '$ultra% ultra-processed',
                  textAlign: TextAlign.end,
                  style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: ultra >= 25 ? c.beet : c.inkSoft),
                ),
              ),
            ],
          ),
          Semantics(
            label: [for (final (kcal, _, name) in parts) if (kcal > 0) '$name ${(kcal / total * 100).round()}%'].join(', '),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(Radii.pill),
              child: SizedBox(
                height: 10,
                child: Row(
                  // Empty boxes take no height unless stretched to the bar's.
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final (kcal, color, _) in parts)
                      if (kcal > 0) Expanded(flex: kcal.round().clamp(1, 1 << 20), child: ColoredBox(color: color)),
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
    final today = latest != null && latest.takenAt.year == now.year && latest.takenAt.month == now.month && latest.takenAt.day == now.day ? latest : null;
    final usual = history?.baselineScore;
    final diff = today != null && usual != null ? today.score - usual : null;
    return AppCard(
      padding: const EdgeInsets.fromLTRB(Space.s4, 14, Space.s3, 14),
      child: Row(
        spacing: Space.s3,
        children: [
          Container(
            width: 52,
            height: 52,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [NeuroCalColors.ringFrom, NeuroCalColors.ringTo],
              ),
            ),
            child: today == null
                ? const Icon(Icons.bolt_rounded, color: NeuroCalColors.onSignal)
                : Text('${today.score}', style: const TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w800, color: NeuroCalColors.onSignal)),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 2,
              children: [
                const Text('Brain speed', style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800)),
                Text(
                  today == null
                      ? 'A 2-minute reaction check. Do it daily to see what sharpens you.'
                      : diff == null
                      ? '${today.medianMs} ms typical reaction. A few more days and you\'ll have your usual.'
                      : diff >= 0
                      ? '$diff above your usual (${usual!}).'
                      : '${-diff} below your usual (${usual!}). Sleep and daylight help most.',
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
    return AppCard(
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
                    const Text('Exercise', style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800)),
                    Text(
                      empty ? 'Even a 20-minute walk lifts focus for the next couple of hours.' : '${day.totalMinutes} min · ${_kcal(day.totalKcal)} kcal burned',
                      style: TextStyle(fontSize: TextSize.xs, height: 1.35, color: empty ? c.inkSoft : c.chlorophyll, fontWeight: empty ? null : FontWeight.w700),
                    ),
                  ],
                ),
              ),
              SoftButton(label: '+ Log', semanticLabel: 'Log exercise', onPressed: onLog),
            ],
          ),
          for (final e in day.exercises)
            Container(
              margin: const EdgeInsets.only(top: Space.s2),
              padding: const EdgeInsets.only(top: Space.s2),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: c.rule))),
              child: Row(
                spacing: 10,
                children: [
                  Icon(exerciseIcon(e.kind), size: 20, color: c.inkSoft),
                  Expanded(
                    child: Text(
                      '${e.kind.label} · ${e.minutes} min · ${e.intensity.label.toLowerCase()}',
                      style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w600),
                    ),
                  ),
                  Text('${e.kcal} kcal', style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700)),
                  Semantics(
                    button: true,
                    label: 'Remove ${e.kind.label.toLowerCase()}',
                    excludeSemantics: true,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(Radii.pill),
                      onTap: () => onRemove(e),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
                        child: Text('Remove', style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w600, color: c.inkSoft)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          if (day.estimatedWeight && !empty)
            Padding(
              padding: const EdgeInsets.only(top: Space.s2),
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
    final daylight = day.environment?.check[EnvironmentItem.daylight];
    final status = DayStatus(
      sleepLogged: day.focus.components.sleep != null,
      checkedIn: day.bio.flags.isNotEmpty,
      daylight: day.environment == null ? null : daylight == true,
      meals: day.meals.length,
      movedMinutes: day.exercise?.totalMinutes ?? 0,
      supplementsLeft: stack.where((i) => !i.takenToday).length,
      fastingNow: day.fasting?.kind == FastingKind.fasting,
    );
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
        'Log last night’s sleep',
        access == SleepAccess.connected
            ? 'Nothing from $store for last night yet. Log it by hand, or check your watch or sleep app saves to $store.'
            : 'Sleep is the biggest part of your Focus Score.',
        'Log sleep',
        () => widget.onCapture(Capture.sleep),
      ),
      DayStep.checkIn => (Icons.mood_rounded, 'Check in', 'Tap how you feel right now. It takes ten seconds.', 'Check in', () => widget.onCapture(Capture.checkIn)),
      DayStep.daylight => (
        Icons.wb_sunny_rounded,
        'Get 10 minutes of daylight',
        'Morning light sets your body clock, so you sleep better tonight. Step outside, then tap below.',
        'I’ve been outside',
        widget.onDaylight,
      ),
      DayStep.meal => (
        Icons.photo_camera_rounded,
        'Log your next meal',
        'Snap your plate before you eat. NeuroCal works out the rest.',
        'Log a meal',
        () => widget.onCapture(Capture.meal),
      ),
      DayStep.move => (
        Icons.directions_run_rounded,
        'Move for 5 minutes',
        'A guided calf pump you can do at your desk. It’s logged when you finish.',
        'Start the calf pump',
        widget.onCalfPump,
      ),
      DayStep.supplements => (
        Icons.medication_rounded,
        'Take your supplements',
        '${status.supplementsLeft} still to take today. Tick them off in your stack.',
        'Open my stack',
        widget.onStack,
      ),
      DayStep.allDone => (
        Icons.check_circle_rounded,
        'You’re done for now',
        status.fastingNow && day.meals.isEmpty
            ? 'You’re fasting. Log your first meal when your eating window opens.'
            : 'Tomorrow’s score has what it needs. Log meals as you eat them.',
        'Log a meal',
        () => widget.onCapture(Capture.meal),
      ),
    };
    final secondary = switch (step) {
      DayStep.move => ('Log other exercise', () => widget.onCapture(Capture.exercise)),
      DayStep.sleep when access == SleepAccess.notConnected => ('Log it by hand', () => widget.onCapture(Capture.sleep)),
      _ => null,
    };

    final items = <({String title, bool done})>[
      (title: 'Log last night’s sleep', done: status.sleepLogged),
      (title: 'Check in', done: status.checkedIn),
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
                    style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w800, color: finished ? c.chlorophyll : c.synapseInk),
                  ),
                ),
              ),
              Text('$done of ${items.length} done', style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: c.inkSoft)),
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
                    style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: streak.days > 0 ? c.glucoseInk : c.inkSoft),
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
              child: SlideTransition(position: Tween(begin: const Offset(0.15, 0), end: Offset.zero).animate(a), child: child),
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
                        decoration: BoxDecoration(color: finished ? c.chlorophyllSoft : c.synapseSoft, shape: BoxShape.circle),
                        child: Icon(icon, size: 26, color: finished ? c.chlorophyll : c.synapseInk),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          spacing: 2,
                          children: [
                            Text(title, style: const TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w800, height: 1.2)),
                            Text(why, style: TextStyle(fontSize: TextSize.sm, height: 1.35, color: c.inkSoft)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  FilledButton(
                    style: finished ? FilledButton.styleFrom(backgroundColor: c.chlorophyllSoft, foregroundColor: c.chlorophyll) : null,
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
                          style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w600, color: item.done ? c.inkSoft : c.ink),
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
