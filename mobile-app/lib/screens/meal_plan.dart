import 'package:flutter/material.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/meal_visual.dart';
import '../widgets/sheet.dart';
import '../widgets/ui.dart';
import 'cook_mode.dart';

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

  /// Shopping items ticked off, for this plan only (kept while the screen is open).
  final _bought = <String>{};

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
        _bought.clear();
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

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      appBar: AppBar(title: const Text('Meal plan'), backgroundColor: c.mist, surfaceTintColor: Colors.transparent),
      body: FutureBuilder(
        future: _plan,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Padding(padding: EdgeInsets.all(Space.s4), child: ScreenLoading(label: 'Loading your plan', heights: [120, 200]));
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
              if (_problem != null) Padding(padding: const EdgeInsets.only(top: Space.s3), child: SheetNote(lead: 'No plan made.', detail: _problem!)),
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
            Expanded(child: ChoicePill(label: 'Day ${d.day}', selected: i == _day, onTap: () => setState(() => _day = i))),
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
                  Text('${day.calories} kcal', style: const TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800)),
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
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('${day.macros.proteinG.round()} g', style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800)),
                Text('protein of ${plan.targetProteinG.round()} g', style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft)),
              ],
            ),
          ],
        ),
      ),
      for (final meal in day.meals) Padding(padding: const EdgeInsets.only(top: Space.s3), child: _MealCard(meal, onLog: widget.onLog)),
      if (plan.shoppingList.isNotEmpty) ...[
        BlockTitle('Shopping list', note: '${plan.shoppingList.length} items'),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (final (i, item) in plan.shoppingList.indexed)
                CheckboxListTile(
                  value: _bought.contains(item.name),
                  onChanged: (v) => setState(() => v == true ? _bought.add(item.name) : _bought.remove(item.name)),
                  controlAffinity: ListTileControlAffinity.leading,
                  shape: i == 0 ? null : Border(top: BorderSide(color: c.rule)),
                  title: Text(
                    item.name,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      decoration: _bought.contains(item.name) ? TextDecoration.lineThrough : null,
                      color: _bought.contains(item.name) ? c.inkSoft : c.ink,
                    ),
                  ),
                  subtitle: Text('About ${item.grams} g · ${item.meals} ${item.meals == 1 ? 'meal' : 'meals'}'),
                ),
            ],
          ),
        ),
      ],
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
  const _MakePlan({required this.days, required this.onDays, required this.making, required this.again, required this.onMake});

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
              Text('Days', style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.inkSoft)),
              for (final d in const [1, 2, 3]) ChoicePill(label: '$d', semanticLabel: '$d days', height: 40, selected: days == d, onTap: () => onDays(d)),
            ],
          ),
          FilledButton.icon(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
            onPressed: making ? null : onMake,
            icon: making
                ? SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2, color: c.onAccent))
                : const Icon(Icons.restaurant_menu_rounded, size: 20),
            label: Text(making ? 'Planning… (up to half a minute)' : again ? 'Make a new plan' : 'Plan my meals'),
          ),
        ],
      ),
    );
  }
}

class _MealCard extends StatefulWidget {
  const _MealCard(this.meal, {required this.onLog});

  final PlanMeal meal;
  final Future<void> Function(PlanMeal) onLog;

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
          Text(kind, style: TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w700, color: c.inkSoft)),
          Text(m.title, style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800, height: 1.25)),
          Text('${m.calories} kcal · ${m.macros.proteinG.round()} g protein', style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft)),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final i in m.ingredients)
                Tag(
                  i.inPantry ? '✓ ${i.name}' : '+ ${i.name}',
                  fill: i.inPantry ? c.chlorophyllSoft : c.glucoseSoft,
                  ink: i.inPantry ? c.chlorophyll : c.glucoseInk,
                ),
            ],
          ),
          if (_open) ...[
            for (final i in m.ingredients)
              Text('${i.quantity.isEmpty ? '${i.grams.round()} g' : i.quantity} ${i.name}', style: const TextStyle(fontSize: TextSize.sm)),
            for (final (n, step) in m.steps.indexed) Text('${n + 1}. $step', style: const TextStyle(fontSize: TextSize.sm, height: 1.4)),
          ],
          CookActions(
            title: m.title,
            ingredients: [for (final i in m.ingredients) '${i.quantity.isEmpty ? '${i.grams.round()} g' : i.quantity} ${i.name}'],
            steps: m.steps,
          ),
          Row(
            children: [
              Expanded(
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(onPressed: () => setState(() => _open = !_open), child: Text(_open ? 'Hide recipe' : 'Show recipe')),
                ),
              ),
              SoftButton(label: 'Log it', semanticLabel: 'Log ${m.title}', onPressed: () => widget.onLog(m)),
            ],
          ),
        ],
      ),
    );
  }
}
