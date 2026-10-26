import 'package:flutter/material.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/meal_visual.dart';
import '../widgets/sheet.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';
import 'cook_mode.dart';
import 'shopping.dart';

const _weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/// "Mon 27" for a plan's day [day] (from 1), counting from the day it was made.
String planDayLabel(DateTime createdAt, int day) {
  final d = DateTime(createdAt.year, createdAt.month, createdAt.day + day - 1);
  return '${_weekdays[d.weekday - 1]} ${d.day}';
}

/// A few days of meals sized to your targets, from your pantry first and fitting your fasting plan, with
/// a shopping list for the rest. [onLog] logs a planned meal.
class MealPlanScreen extends StatefulWidget {
  const MealPlanScreen({super.key, required this.onLog});

  final Future<void> Function(PlanMeal meal) onLog;

  @override
  State<MealPlanScreen> createState() => _MealPlanScreenState();
}

class _MealPlanScreenState extends State<MealPlanScreen> {
  Future<MealPlan?>? _plan;
  var _making = false;
  String? _problem;
  var _days = 3;
  var _day = 0;

  /// The meal being swapped, as (day index, meal index).
  (int, int)? _swapping;
  var _adding = false;

  NeuroCalApi get _api => AppScope.of(context).api;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _plan ??= _api.mealPlan();
  }

  Future<void> _make() async {
    setState(() {
      _making = true;
      _problem = null;
    });
    try {
      final plan = await _api.createMealPlan(_days);
      if (!mounted) return;
      setState(() {
        _plan = Future.value(plan);
        _day = 0;
      });
    } on ApiException catch (e) {
      if (mounted) {
        setState(
          () => _problem = switch (e.status) {
            402 => 'Meal plans are part of your subscription.',
            >= 500 => 'The planner isn’t answering right now. Try again in a few minutes.',
            _ => e.message,
          },
        );
      }
    } catch (_) {
      if (mounted) setState(() => _problem = 'Check your connection and try again.');
    } finally {
      if (mounted) setState(() => _making = false);
    }
  }

  /// A different meal in the same slot, about the same size.
  Future<void> _swap(int day, int meal) async {
    setState(() => _swapping = (day, meal));
    try {
      final plan = await _api.swapMeal(day + 1, meal);
      if (!mounted) return;
      // A block, not an arrow: setState must not return the Future being stored.
      setState(() {
        _plan = Future.value(plan);
      });
      showToast(context, 'Meal swapped');
    } on ApiException catch (e) {
      if (mounted) {
        showToast(
          context,
          e.status == 402 ? 'Swapping meals is part of your subscription.' : "Couldn't find another meal right now.",
          ToastTone.problem,
        );
      }
    } catch (_) {
      if (mounted) showToast(context, "Couldn't swap the meal. Check your connection.", ToastTone.problem);
    } finally {
      if (mounted) setState(() => _swapping = null);
    }
  }

  /// The plan's shopping onto the shopping list, with amounts.
  Future<void> _addToList(MealPlan plan) async {
    setState(() => _adding = true);
    try {
      await _api.addToShoppingList([
        for (final s in plan.shoppingList) (name: s.name, quantity: planQuantity(s.grams)),
      ], fromPlan: true);
      if (!mounted) return;
      showToast(context, '${plan.shoppingList.length} items added to your shopping list');
      _openList();
    } catch (_) {
      if (mounted) showToast(context, "Couldn't add them to your list. Try again.", ToastTone.problem);
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  void _openList() => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const ShoppingScreen()));

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      appBar: AppBar(title: const Text('Meal plan'), backgroundColor: c.mist, surfaceTintColor: Colors.transparent),
      body: FutureBuilder(
        future: _plan,
        builder: (context, snapshot) {
          // A swap keeps showing the plan (and where you'd scrolled to) while the new one arrives.
          if (snapshot.connectionState != ConnectionState.done && !snapshot.hasData) {
            return const Padding(
              padding: EdgeInsets.all(Space.s4),
              child: ScreenLoading(label: 'Loading your plan', heights: [120, 200]),
            );
          }
          final plan = snapshot.data;
          return ListView(
            padding: const EdgeInsets.fromLTRB(Space.s4, 0, Space.s4, Space.s6),
            children: [
              if (plan == null)
                Text(
                  'Plan up to three days of meals sized to your calories and protein, from what’s in your pantry first, and fitting your fasting window. You get a shopping list for the rest.',
                  style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
                ),
              _MakePlan(
                days: _days,
                onDays: (d) => setState(() => _days = d),
                making: _making,
                again: plan != null,
                onMake: _make,
              ),
              if (_problem != null)
                Padding(
                  padding: const EdgeInsets.only(top: Space.s3),
                  child: SheetNote(lead: 'No plan made.', detail: _problem!),
                ),
              if (plan != null && !_making) ..._planView(context, plan),
            ],
          );
        },
      ),
    );
  }

  List<Widget> _planView(BuildContext context, MealPlan plan) {
    final c = context.colors;
    final day = plan.days[_day.clamp(0, plan.days.length - 1)];
    final diff = day.calories - plan.targetCalories;
    return [
      const SizedBox(height: Space.s4),
      Row(
        spacing: Space.s2,
        children: [
          for (final (i, d) in plan.days.indexed)
            Expanded(
              child: ChoicePill(
                label: planDayLabel(plan.createdAt, d.day),
                selected: i == _day,
                onTap: () => setState(() => _day = i),
              ),
            ),
        ],
      ),
      const SizedBox(height: Space.s3),
      AppCard(
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${day.calories} kcal',
                    style: const TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800),
                  ),
                  Text(
                    diff.abs() <= plan.targetCalories * 0.05
                        ? 'On your ${plan.targetCalories} kcal target'
                        : diff < 0
                        ? '${-diff} under your ${plan.targetCalories} kcal target'
                        : '$diff over your ${plan.targetCalories} kcal target',
                    style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: Space.s2),
      Row(
        spacing: Space.s2,
        children: [
          _Macro('Protein', day.macros.proteinG, target: plan.targetProteinG),
          _Macro('Carbs', day.macros.carbsG),
          _Macro('Fat', day.macros.fatG),
        ],
      ),
      for (final (i, meal) in day.meals.indexed)
        Padding(
          padding: const EdgeInsets.only(top: Space.s3),
          child: _MealCard(
            meal,
            onLog: widget.onLog,
            swapping: _swapping == (_day, i),
            onSwap: _swapping == null ? () => _swap(_day, i) : null,
          ),
        ),
      if (plan.shoppingList.isNotEmpty) ...[
        BlockTitle('To buy for this plan', note: '${plan.shoppingList.length} items'),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: Space.s2,
            children: [
              for (final item in plan.shoppingList)
                Row(
                  spacing: Space.s2,
                  children: [
                    Expanded(
                      child: Text(
                        item.name,
                        style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
                      ),
                    ),
                    Text(
                      '${planQuantity(item.grams)} · ${item.meals} ${item.meals == 1 ? 'meal' : 'meals'}',
                      style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                    ),
                  ],
                ),
              const SizedBox(height: Space.s1),
              FilledButton.icon(
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                onPressed: _adding ? null : () => _addToList(plan),
                icon: const Icon(Icons.add_shopping_cart_rounded, size: 20),
                label: Text(_adding ? 'Adding…' : 'Add to my shopping list'),
              ),
            ],
          ),
        ),
      ] else
        Padding(
          padding: const EdgeInsets.only(top: Space.s3),
          child: Text(
            'Everything for this plan is already in your pantry.',
            style: TextStyle(fontSize: TextSize.sm, color: c.chlorophyll),
          ),
        ),
      Padding(
        padding: const EdgeInsets.only(top: Space.s3),
        child: Text(
          'Calories use USDA values where ingredients match the food catalog; the rest are estimates.',
          style: TextStyle(fontSize: TextSize.xxs, height: 1.4, color: c.inkFaint),
        ),
      ),
    ];
  }
}

class _MakePlan extends StatelessWidget {
  const _MakePlan({
    required this.days,
    required this.onDays,
    required this.making,
    required this.again,
    required this.onMake,
  });

  final int days;
  final ValueChanged<int> onDays;
  final bool making;
  final bool again;
  final VoidCallback onMake;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(top: Space.s3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s2,
        children: [
          Row(
            spacing: Space.s2,
            children: [
              Text(
                'Days',
                style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.inkSoft),
              ),
              for (final d in const [1, 2, 3])
                ChoicePill(
                  label: '$d',
                  semanticLabel: '$d days',
                  height: 40,
                  selected: days == d,
                  onTap: () => onDays(d),
                ),
            ],
          ),
          FilledButton.icon(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
            onPressed: making ? null : onMake,
            icon: making
                ? SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2, color: c.onAccent))
                : const Icon(Icons.restaurant_menu_rounded, size: 20),
            label: Text(
              making
                  ? 'Planning… (up to half a minute)'
                  : again
                  ? 'Make a new plan'
                  : 'Plan my meals',
            ),
          ),
        ],
      ),
    );
  }
}

/// One of the day's macros, against its target when there is one.
class _Macro extends StatelessWidget {
  const _Macro(this.label, this.grams, {this.target});

  final String label;
  final double grams;
  final double? target;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: Space.s3, vertical: Space.s2),
        decoration: BoxDecoration(color: c.paper, borderRadius: BorderRadius.circular(Radii.option)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${grams.round()} g',
              style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
            ),
            Text(
              target == null ? label : '$label of ${target!.round()} g',
              style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft),
            ),
          ],
        ),
      ),
    );
  }
}

class _MealCard extends StatefulWidget {
  const _MealCard(this.meal, {required this.onLog, this.onSwap, this.swapping = false});

  final PlanMeal meal;
  final Future<void> Function(PlanMeal) onLog;

  /// Null while another meal is being swapped.
  final VoidCallback? onSwap;
  final bool swapping;

  @override
  State<_MealCard> createState() => _MealCardState();
}

class _MealCardState extends State<_MealCard> {
  var _open = false;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final m = widget.meal;
    final kind = m.kind.name[0].toUpperCase() + m.kind.name.substring(1);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s2,
        children: [
          MealVisual(ingredients: [for (final i in m.ingredients) i.name], height: 112),
          Text(
            kind,
            style: TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w700, color: c.inkSoft),
          ),
          Text(
            m.title,
            style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800, height: 1.25),
          ),
          Text(
            '${m.calories} kcal · ${m.macros.proteinG.round()} g protein',
            style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
          ),
          if (m.ingredients.where((i) => i.inPantry).toList() case final have when have.isNotEmpty)
            _Have(Icons.check_circle_rounded, 'In your kitchen', have.map((i) => i.name).join(', '), c.chlorophyll),
          if (m.ingredients.where((i) => !i.inPantry).toList() case final need when need.isNotEmpty)
            _Have(Icons.add_shopping_cart_rounded, 'To buy', need.map((i) => i.name).join(', '), c.glucoseInk),
          if (_open) ...[
            for (final i in m.ingredients)
              Text(
                '${i.quantity.isEmpty ? '${i.grams.round()} g' : i.quantity} ${i.name}',
                style: const TextStyle(fontSize: TextSize.sm),
              ),
            for (final (n, step) in m.steps.indexed)
              Text('${n + 1}. $step', style: const TextStyle(fontSize: TextSize.sm, height: 1.4)),
          ],
          CookActions(
            title: m.title,
            ingredients: [
              for (final i in m.ingredients) '${i.quantity.isEmpty ? '${i.grams.round()} g' : i.quantity} ${i.name}',
            ],
            steps: m.steps,
          ),
          Wrap(
            spacing: Space.s1,
            runSpacing: Space.s1,
            crossAxisAlignment: WrapCrossAlignment.center,
            alignment: WrapAlignment.spaceBetween,
            children: [
              TextButton(
                onPressed: () => setState(() => _open = !_open),
                child: Text(_open ? 'Hide recipe' : 'Show recipe'),
              ),
              TextButton.icon(
                onPressed: widget.onSwap,
                icon: widget.swapping
                    ? const SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.autorenew_rounded, size: 18),
                label: Text(widget.swapping ? 'Swapping…' : 'Swap'),
              ),
              SoftButton(label: 'Log it', semanticLabel: 'Log ${m.title}', onPressed: () => widget.onLog(m)),
            ],
          ),
        ],
      ),
    );
  }
}

/// "In your kitchen: oats, berries" or "To buy: salmon".
class _Have extends StatelessWidget {
  const _Have(this.icon, this.label, this.items, this.color);

  final IconData icon;
  final String label;
  final String items;
  final Color color;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    spacing: 6,
    children: [
      Padding(
        padding: const EdgeInsets.only(top: 1),
        child: Icon(icon, size: 16, color: color),
      ),
      Expanded(
        child: Text.rich(
          TextSpan(
            children: [
              TextSpan(
                text: '$label: ',
                style: TextStyle(fontWeight: FontWeight.w700, color: color),
              ),
              TextSpan(text: items),
            ],
          ),
          style: const TextStyle(fontSize: TextSize.xs, height: 1.35),
        ),
      ),
    ],
  );
}
