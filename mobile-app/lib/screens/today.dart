import 'package:flutter/material.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/focus_ring.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';
import 'check_in_sheet.dart';
import 'log_meal_sheet.dart';
import 'sleep_sheets.dart';

class _Day {
  const _Day(this.focus, this.bio, this.meals, this.recipes);

  final FocusScore focus;
  final BioState bio;
  final List<Meal> meals;

  /// Null when suggestions didn't load; the rest of the day still shows.
  final List<Recipe>? recipes;
}

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

/// Today: the Focus Score with the four signals behind it, calories left, how you feel,
/// what to eat next and the day's meals.
class TodayScreen extends StatefulWidget {
  const TodayScreen({
    super.key,
    required this.profile,
    required this.changes,
    required this.onChanged,
    required this.onOpenSettings,
  });

  final Profile profile;

  /// Fires when something was logged on any tab; [onChanged] tells the other tabs about this one.
  final Listenable changes;
  final VoidCallback onChanged;
  final VoidCallback onOpenSettings;

  @override
  State<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends State<TodayScreen> {
  Future<_Day>? _day;

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

  Future<_Day> _load() async {
    final now = DateTime.now();
    final api = _api;
    final recipes = api.recommendations().then<List<Recipe>?>((r) => r).catchError((Object _) => null);
    final (focus, bio, meals) = await (api.focusScore(now), api.bioState(now), api.meals(now)).wait;
    return _Day(focus, bio, meals, await recipes);
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

  Future<void> _logMeal() async {
    final logged = await showLogMealSheet(context);
    if (logged == true && mounted) {
      showToast(context, 'Meal logged');
      widget.onChanged();
    }
  }

  Future<void> _checkIn() async {
    final saved = await showCheckInSheet(context);
    if (saved == true && mounted) {
      showToast(context, 'Check-in saved');
      widget.onChanged();
    }
  }

  Future<void> _log(Future<bool?> Function(BuildContext) sheet, String done) async {
    if (await sheet(context) == true && mounted) {
      showToast(context, done);
      widget.onChanged();
    }
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
    final first = widget.profile.displayName.trim().split(RegExp(r'\s+')).first;
    return SafeArea(
      bottom: false,
      child: Stack(
        children: [
          RefreshIndicator(
            onRefresh: _refresh,
            child: FutureBuilder(
              future: _day,
              builder: (context, snapshot) => ListView(
                padding: const EdgeInsets.fromLTRB(Space.s4, Space.s3, Space.s4, ActionBar.clearance + Space.s4),
                children: [
                  Padding(
                    padding: const EdgeInsets.only(left: Space.s1),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                longDate(now),
                                style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w600, color: c.inkSoft),
                              ),
                              const SizedBox(height: 2),
                              Semantics(
                                header: true,
                                child: Text(
                                  first.isEmpty ? greeting(now.hour) : '${greeting(now.hour)}, $first',
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
                        IconButton(
                          tooltip: 'Settings',
                          icon: Icon(Icons.settings_outlined, color: c.inkSoft),
                          onPressed: widget.onOpenSettings,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: Space.s4),
                  if (snapshot.hasError)
                    ScreenFailed(
                      title: "Couldn't load today",
                      detail: snapshot.error is ApiException && (snapshot.error as ApiException).unauthorized
                          ? 'Your session has ended. Sign out in Settings and sign in again.'
                          : 'Your meals and score are safe. Check your connection and try again.',
                      onRetry: _refresh,
                    )
                  else if (!snapshot.hasData)
                    const ScreenLoading(label: 'Loading today', heights: [232, 120, 64, 150])
                  else ...[
                    _FocusCard(
                      snapshot.data!.focus,
                      onCheckIn: _checkIn,
                      onLogSleep: () => _log(showLogSleepSheet, 'Sleep logged'),
                      onLogScreens: () => _log(showLogScreenTimeSheet, 'Screen time logged'),
                    ),
                    const SizedBox(height: Space.s3),
                    _Calories(snapshot.data!.bio),
                    const SizedBox(height: Space.s3),
                    _Feeling(snapshot.data!.bio.flags, onCheckIn: _checkIn),
                    const BlockTitle('What to eat next'),
                    _Suggestions(snapshot.data!.recipes),
                    BlockTitle(
                      'Meals today',
                      note: snapshot.data!.meals.isEmpty
                          ? null
                          : '${snapshot.data!.meals.length} logged · ${_kcal(snapshot.data!.bio.caloriesEaten)} kcal',
                    ),
                    if (snapshot.data!.meals.isEmpty)
                      EmptyCard(
                        title: 'No meals yet today',
                        detail: "Snap your first plate and we'll read it against your sleep and stress.",
                        action: SoftButton(label: '+ Log a meal', semanticLabel: 'Log a meal', onPressed: _logMeal),
                      )
                    else
                      AppCard(
                        padding: EdgeInsets.zero,
                        child: Column(
                          children: [
                            for (final (i, meal) in snapshot.data!.meals.indexed)
                              _MealRow(meal, divider: i > 0, onRemove: () => _remove(meal)),
                          ],
                        ),
                      ),
                  ],
                ],
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: ActionBar(
              children: [
                Expanded(
                  flex: 3,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(Radii.pill),
                      boxShadow: [
                        BoxShadow(color: c.synapse.withValues(alpha: 0.28), blurRadius: 24, offset: const Offset(0, 8)),
                      ],
                    ),
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56)),
                      onPressed: _logMeal,
                      icon: const Icon(Icons.photo_camera_outlined, size: 20),
                      label: const Text('Log a meal'),
                    ),
                  ),
                ),
                Expanded(
                  flex: 2,
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(56),
                      foregroundColor: c.synapseInk,
                      side: BorderSide(color: c.ruleStrong, width: 1.5),
                      textStyle: const TextStyle(fontSize: TextSize.base, fontWeight: FontWeight.w700),
                    ),
                    onPressed: _checkIn,
                    child: const Text('Check in'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The hero: the ring, a word for the score, the explanation, and the four signals behind it.
class _FocusCard extends StatelessWidget {
  const _FocusCard(this.focus, {required this.onCheckIn, required this.onLogSleep, required this.onLogScreens});

  final FocusScore focus;
  final VoidCallback onCheckIn;
  final VoidCallback onLogSleep;
  final VoidCallback onLogScreens;

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
    ];
    return AppCard(
      radius: Radii.hero,
      padding: const EdgeInsets.all(18),
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
                    Text(
                      'Focus Score',
                      style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w600, color: c.synapseInk),
                    ),
                    Text(
                      score == null ? 'No score yet' : scoreWord(score),
                      style: const TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800, height: 1.15),
                    ),
                    Text(
                      focus.explanation,
                      style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: Space.s4),
          for (var row = 0; row < 2; row++) ...[
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
    return Semantics(
      container: true,
      label: '$name: $word',
      child: Container(
        constraints: const BoxConstraints(minHeight: 74),
        padding: const EdgeInsets.symmetric(horizontal: Space.s3, vertical: 10),
        decoration: BoxDecoration(color: c.mist, borderRadius: BorderRadius.circular(Radii.option)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: Space.s1,
          children: [
            ExcludeSemantics(
              child: Text(
                name,
                style: TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w600, color: c.inkSoft),
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
      ('Protein', bio.macrosEaten.proteinG, bio.macroTargets.proteinG),
      ('Carbs', bio.macrosEaten.carbsG, bio.macroTargets.carbsG),
      ('Fat', bio.macrosEaten.fatG, bio.macroTargets.fatG),
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
                child: Text(
                  over ? '${_kcal(-left)} kcal over' : '${_kcal(left)} kcal left',
                  style: TextStyle(
                    fontSize: TextSize.xl,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                    color: over ? c.beet : c.ink,
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
              for (final (name, got, goal) in macros)
                Expanded(
                  child: MergeSemantics(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      spacing: 5,
                      children: [
                        Row(
                          children: [
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
                        Meter(value: goal <= 0 ? 0 : got / goal, color: got > goal ? c.glucose : c.ion, height: 5),
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
  const _Feeling(this.flags, {required this.onCheckIn});

  final List<CognitiveFlag> flags;
  final VoidCallback onCheckIn;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final words = [for (final (i, flag) in flags.indexed) i == 0 ? flag.label : flag.label.toLowerCase()].join(', ');
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
