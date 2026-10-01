import 'package:flutter/material.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/focus_ring.dart';
import '../widgets/logo.dart';
import 'check_in_sheet.dart';
import 'log_meal_sheet.dart';
import 'settings.dart';

class _Day {
  const _Day(this.focus, this.bio, this.meals);

  final FocusScore focus;
  final BioState bio;
  final List<Meal> meals;
}

/// Today: the Focus Score and what it is made of, calories left, and the meals logged so far.
class TodayScreen extends StatefulWidget {
  const TodayScreen({super.key});

  @override
  State<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends State<TodayScreen> {
  Future<_Day>? _day;

  NeuroCalApi get _api => AppScope.of(context).api;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _day ??= _load();
  }

  Future<_Day> _load() async {
    final now = DateTime.now();
    final (focus, bio, meals) = await (_api.focusScore(now), _api.bioState(now), _api.meals(now)).wait;
    return _Day(focus, bio, meals);
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

  void _toast(String message) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));

  Future<void> _logMeal() async {
    final logged = await showLogMealSheet(context);
    if (logged == true) {
      _toast('Meal logged');
      await _refresh();
    }
  }

  Future<void> _checkIn() async {
    final saved = await showCheckInSheet(context);
    if (saved == true) {
      _toast('Check-in saved');
      await _refresh();
    }
  }

  Future<void> _delete(Meal meal) async {
    try {
      await _api.deleteMeal(meal.id);
      _toast('Meal deleted');
    } catch (_) {
      _toast("Couldn't delete that meal. Try again.");
    }
    await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: FutureBuilder(
            future: _day,
            builder: (context, snapshot) => ListView(
              padding: const EdgeInsets.fromLTRB(Space.s4, Space.s4, Space.s4, 120),
              children: [
                Row(
                  children: [
                    const LogoMark(size: 26),
                    const SizedBox(width: Space.s2),
                    Expanded(child: Text('Today', style: text.headlineSmall)),
                    IconButton(
                      tooltip: 'Settings',
                      icon: Icon(Icons.tune_rounded, color: c.inkSoft),
                      onPressed: () =>
                          Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
                    ),
                  ],
                ),
                const SizedBox(height: Space.s5),
                if (snapshot.hasError)
                  _Problem(
                    onRetry: _refresh,
                    unauthorized: snapshot.error is ApiException && (snapshot.error as ApiException).unauthorized,
                  )
                else if (!snapshot.hasData)
                  const Padding(
                    padding: EdgeInsets.only(top: Space.s7),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else ...[
                  Center(child: FocusRing(score: snapshot.data!.focus.score)),
                  const SizedBox(height: Space.s5),
                  _Components(snapshot.data!.focus.components),
                  const SizedBox(height: Space.s5),
                  _Panel(child: Text(snapshot.data!.focus.explanation, style: text.bodyLarge)),
                  const SizedBox(height: Space.s4),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(onPressed: _checkIn, child: const Text('Check in')),
                  ),
                  const SizedBox(height: Space.s4),
                  _Calories(snapshot.data!.bio),
                  const SizedBox(height: Space.s6),
                  Text('Meals today', style: text.titleMedium),
                  const SizedBox(height: Space.s3),
                  if (snapshot.data!.meals.isEmpty)
                    Text(
                      'No meals yet. Log one to see how it moves your score.',
                      style: text.bodyLarge?.copyWith(color: c.inkSoft),
                    )
                  else
                    for (final meal in snapshot.data!.meals) _MealRow(meal, onDelete: () => _delete(meal)),
                ],
              ],
            ),
          ),
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: Padding(
        padding: const EdgeInsets.symmetric(horizontal: Space.s4),
        child: SizedBox(
          width: double.infinity,
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(Radii.pill),
              boxShadow: [
                BoxShadow(
                  color: c.synapse.withValues(alpha: 0.45),
                  blurRadius: 28,
                  offset: const Offset(0, 10),
                  spreadRadius: -10,
                ),
              ],
            ),
            child: FilledButton.icon(
              onPressed: _logMeal,
              icon: const Icon(Icons.photo_camera_outlined),
              label: const Text('Log a meal'),
            ),
          ),
        ),
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Space.s4, vertical: 14),
      decoration: BoxDecoration(
        color: c.paper,
        borderRadius: BorderRadius.circular(Radii.card),
        border: Border.all(color: c.rule),
      ),
      child: child,
    );
  }
}

/// The four inputs of the score, each in the colour of the body system it measures.
class _Components extends StatelessWidget {
  const _Components(this.components);

  final FocusComponents components;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final rows = [
      ('Sleep', 'last night', components.sleep, c.sleep),
      ('Evening timing', 'late food and screens', components.timing, c.synapse),
      ('Glycemic load', "yesterday's food", components.glycemic, c.glucose),
      ('Stress', 'recent check-ins', components.stress, c.chlorophyll),
    ];
    return LayoutBuilder(
      builder: (context, box) {
        final width = (box.maxWidth - Space.s5) / 2;
        return Wrap(
          spacing: Space.s5,
          runSpacing: Space.s4,
          children: [
            for (final (label, hint, value, color) in rows)
              SizedBox(width: width, child: _Component(label, hint, value, color)),
          ],
        );
      },
    );
  }
}

class _Component extends StatelessWidget {
  const _Component(this.label, this.hint, this.value, this.color);

  final String label;
  final String hint;
  final double? value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Semantics(
      label: '$label, $hint: ${value == null ? 'no data' : '${(value! * 100).round()} out of 100'}',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: text.bodyMedium),
          Text(
            hint,
            style: text.labelSmall?.copyWith(color: c.inkSoft, fontWeight: FontWeight.w400),
          ),
          const SizedBox(height: Space.s1),
          Text(
            value == null ? 'No data' : '${(value! * 100).round()}',
            style: text.titleMedium?.copyWith(color: value == null ? c.inkSoft : c.ink),
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(Radii.pill),
            child: LinearProgressIndicator(value: value ?? 0, minHeight: 4, backgroundColor: c.rule, color: color),
          ),
        ],
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
    final text = Theme.of(context).textTheme;
    final left = bio.calorieTarget - bio.caloriesEaten.round();
    return _Panel(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  left >= 0 ? '$left kcal left' : '${-left} kcal over',
                  style: text.titleMedium?.copyWith(color: left >= 0 ? c.ink : c.beet),
                ),
                Text(
                  '${bio.caloriesEaten.round()} of ${bio.calorieTarget} kcal eaten',
                  style: text.bodyMedium?.copyWith(color: c.inkSoft),
                ),
              ],
            ),
          ),
          SizedBox.square(
            dimension: 40,
            child: CircularProgressIndicator(
              value: (bio.caloriesEaten / bio.calorieTarget).clamp(0, 1),
              strokeWidth: 5,
              backgroundColor: c.rule,
              color: left >= 0 ? c.glucose : c.beet,
            ),
          ),
        ],
      ),
    );
  }
}

class _MealRow extends StatelessWidget {
  const _MealRow(this.meal, {required this.onDelete});

  final Meal meal;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final time = TimeOfDay.fromDateTime(meal.eatenAt.toLocal()).format(context);
    final kind = meal.kind.name[0].toUpperCase() + meal.kind.name.substring(1);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: Space.s3),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.rule)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 64,
            child: Text(time, style: text.bodyMedium?.copyWith(color: c.inkSoft)),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: Space.s2,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(kind, style: text.labelLarge),
                    if (meal.highGlycemic)
                      Text('High glycemic load', style: text.labelSmall?.copyWith(color: c.glucoseInk)),
                  ],
                ),
                Text(meal.items.map((i) => i.name).join(', '), style: text.bodyMedium?.copyWith(color: c.inkSoft)),
              ],
            ),
          ),
          Text('${meal.calories.round()} kcal', style: text.bodyMedium),
          IconButton(
            tooltip: 'Delete $kind',
            visualDensity: VisualDensity.compact,
            icon: Icon(Icons.delete_outline_rounded, color: c.inkSoft, size: 20),
            onPressed: onDelete,
          ),
        ],
      ),
    );
  }
}

class _Problem extends StatelessWidget {
  const _Problem({required this.onRetry, required this.unauthorized});

  final VoidCallback onRetry;
  final bool unauthorized;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          unauthorized
              ? 'Your session has ended. Sign in again from Settings.'
              : "Today didn't load. Check your connection and try again.",
          style: TextStyle(color: c.beet),
        ),
        TextButton(onPressed: onRetry, child: const Text('Try again')),
      ],
    );
  }
}
