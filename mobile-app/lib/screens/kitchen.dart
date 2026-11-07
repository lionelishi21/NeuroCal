import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/food_image.dart';
import '../widgets/ui.dart';
import 'weight_cards.dart';
import '../widgets/toast.dart';
import 'plan_fast_sheet.dart';

/// The Kitchen tab: everything about food that isn't logging it. The fasting timer when fasting is on,
/// then planning and cooking, shopping, and the food catalog.
class KitchenScreen extends StatefulWidget {
  const KitchenScreen({
    super.key,
    required this.changes,
    required this.onOpenMealPlan,
    required this.onOpenPantry,
    required this.onOpenRecipe,
    this.onCookThis,
    required this.onOpenShopping,
    required this.onScanPackage,
    required this.onBrowseFoods,
    required this.onOpenCoffee,
  });

  final Listenable changes;
  // Screens that change what this tab shows: it reloads when they close.
  final Future<void> Function() onOpenMealPlan;
  final Future<void> Function() onOpenPantry;
  final VoidCallback onOpenRecipe;

  /// A photo of a dish → a recipe and shopping list; also under the + button.
  final VoidCallback? onCookThis;
  final Future<void> Function() onOpenShopping;
  final VoidCallback onScanPackage;
  final VoidCallback onBrowseFoods;
  final Future<void> Function() onOpenCoffee;

  @override
  State<KitchenScreen> createState() => _KitchenScreenState();
}

/// What the Kitchen tab shows: each part is null when it didn't load, and the rest still shows.
typedef _Kitchen = ({
  FastingStatus? fasting,
  MealPlan? plan,
  List<PantryItem>? pantry,
  ShoppingListData? shopping,
  CoffeeDay? coffee,
});

class _KitchenScreenState extends State<KitchenScreen> {
  Future<_Kitchen>? _data;

  @override
  void initState() {
    super.initState();
    widget.changes.addListener(_reload);
  }

  @override
  void dispose() {
    widget.changes.removeListener(_reload);
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _data ??= _load();
  }

  Future<_Kitchen> _load() async {
    final api = AppScope.of(context).api;
    Future<T?> soft<T>(Future<T> f) => f.then<T?>((v) => v).catchError((Object _) => null);
    final fasting = soft(api.fasting());
    final plan = soft(api.mealPlan());
    final pantry = soft(api.pantry());
    final shopping = soft(api.shoppingList());
    final coffee = soft(api.coffee());
    final f = await fasting;
    return (
      fasting: f == null || f.kind == FastingKind.off ? null : f,
      plan: await plan,
      pantry: await pantry,
      shopping: await shopping,
      coffee: await coffee,
    );
  }

  void _reload() {
    setState(() {
      _data = _load();
    });
  }

  /// Opens a screen, then reloads, since it may have changed the plan, the pantry, the list or the coffee.
  VoidCallback _then(Future<void> Function() open) => () async {
    await open();
    if (mounted) _reload();
  };

  Future<void> _plan(FastingStatus status) async {
    final planned = await showPlanFastSheet(context, status);
    if (planned == null || !mounted) return;
    showToast(context, 'Fasting until ${fastEnd(planned.planUntil!, DateTime.now())}');
    _reload();
  }

  Future<void> _end() async {
    try {
      await AppScope.of(context).api.endFast();
      if (mounted) showToast(context, 'Fast ended', ToastTone.info);
    } catch (_) {
      if (mounted) showToast(context, "Couldn't end the fast. Try again.", ToastTone.problem);
    }
    if (mounted) _reload();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: FutureBuilder(
        future: _data,
        builder: (context, snapshot) {
          final k = snapshot.data;
          final next = k?.plan == null ? null : nextPlannedMeal(k!.plan!, DateTime.now());
          return ListView(
            padding: const EdgeInsets.fromLTRB(Space.s4, Space.s4, Space.s4, Space.s6),
            children: [
              const ScreenTitle('Kitchen', detail: 'Plan, cook and shop for steady energy'),
              if (k?.fasting case final fasting?) ...[
                const BlockTitle('Fasting'),
                FastingCard(fasting, onBoundary: _reload, onPlan: () => _plan(fasting), onEnd: _end),
              ],
              const BlockTitle('Next up'),
              if (k == null)
                const ScreenLoading(label: 'Loading your kitchen', heights: [150])
              else if (next != null)
                _NextMeal(next, onOpen: _then(widget.onOpenMealPlan))
              else
                _NoPlan(
                  pantryCount: k.pantry?.length ?? 0,
                  onPlan: _then(widget.onOpenMealPlan),
                  onPantry: _then(widget.onOpenPantry),
                ),
              const BlockTitle('Your kitchen'),
              _Stock(
                k,
                next: next,
                onShopping: _then(widget.onOpenShopping),
                onPantry: _then(widget.onOpenPantry),
                onCoffee: _then(widget.onOpenCoffee),
                onPlan: _then(widget.onOpenMealPlan),
              ),
              const BlockTitle('Quick tools'),
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  spacing: Space.s2,
                  children: [
                    if (widget.onCookThis case final cookThis?)
                      Expanded(
                        child: _Tool(
                          icon: Icons.restaurant_menu_rounded,
                          title: 'Cook this',
                          detail: 'Photo of a dish',
                          tone: _Tone.amber,
                          onTap: cookThis,
                        ),
                      ),
                    Expanded(
                      child: _Tool(
                        icon: Icons.calculate_outlined,
                        title: 'Work out a recipe',
                        detail: 'Per serving',
                        tone: _Tone.blue,
                        onTap: widget.onOpenRecipe,
                      ),
                    ),
                    Expanded(
                      child: _Tool(
                        icon: Icons.qr_code_scanner_rounded,
                        title: 'Scan a package',
                        detail: 'Is it ultra-processed?',
                        tone: _Tone.green,
                        onTap: widget.onScanPackage,
                      ),
                    ),
                  ],
                ),
              ),
              const BlockTitle('Learn'),
              BrowseFoodsCard(onTap: widget.onBrowseFoods),
            ],
          );
        },
      ),
    );
  }
}

String _thousands(int n) => n.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+$)'), (_) => ',');

/// The plan's next meal from [now]: today's next one by the time of day, else tomorrow's first.
/// Null when the plan doesn't cover today, or it's done.
({PlanMeal meal, String when, int day, int days, int targetCalories})? nextPlannedMeal(MealPlan plan, DateTime now) {
  final made = plan.createdAt.toLocal();
  final today = DateTime(now.year, now.month, now.day);
  final index = today.difference(DateTime(made.year, made.month, made.day)).inDays + 1;
  // From this hour on, a meal kind has passed: breakfast at 10, lunch at 15, dinner at 21.
  const ends = {MealKind.breakfast: 10, MealKind.lunch: 15, MealKind.snack: 18, MealKind.dinner: 21};
  const order = [MealKind.breakfast, MealKind.lunch, MealKind.snack, MealKind.dinner];
  List<PlanMeal> mealsOn(int day) {
    final d = plan.days.where((x) => x.day == day).firstOrNull;
    return [...?d?.meals]..sort((a, b) => order.indexOf(a.kind).compareTo(order.indexOf(b.kind)));
  }

  String name(MealKind k) => switch (k) {
    MealKind.breakfast => 'breakfast',
    MealKind.lunch => 'lunch',
    MealKind.snack => 'snack',
    MealKind.dinner => 'dinner',
  };
  final days = plan.days.length;
  if (index >= 1 && index <= days) {
    for (final m in mealsOn(index)) {
      if (now.hour < ends[m.kind]!) {
        final when = m.kind == MealKind.dinner && now.hour >= 15 ? 'Dinner tonight' : 'Today’s ${name(m.kind)}';
        return (meal: m, when: when, day: index, days: days, targetCalories: plan.targetCalories);
      }
    }
  }
  if (index + 1 >= 1 && index + 1 <= days) {
    final first = mealsOn(index + 1).firstOrNull;
    if (first != null) {
      return (
        meal: first,
        when: 'Tomorrow’s ${name(first.kind)}',
        day: index + 1,
        days: days,
        targetCalories: plan.targetCalories,
      );
    }
  }
  return null;
}

/// The next planned meal, big: what it is, its calories and protein, and the way into the plan.
class _NextMeal extends StatelessWidget {
  const _NextMeal(this.next, {required this.onOpen});

  final ({PlanMeal meal, String when, int day, int days, int targetCalories}) next;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final m = next.meal;
    return Semantics(
      button: true,
      label: '${next.when}: ${m.title}. Open the meal plan',
      excludeSemantics: true,
      child: Material(
        color: c.glucoseSoft,
        borderRadius: BorderRadius.circular(Radii.card),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onOpen,
          child: Padding(
            padding: const EdgeInsets.all(Space.s4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: Space.s1,
              children: [
                Text(
                  next.when,
                  style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: c.glucoseInk),
                ),
                Text(
                  m.title,
                  style: const TextStyle(
                    fontSize: TextSize.xl,
                    fontWeight: FontWeight.w800,
                    height: 1.2,
                    letterSpacing: -0.3,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: Space.s1),
                  child: Wrap(
                    spacing: Space.s2,
                    runSpacing: Space.s1,
                    children: [
                      Tag('${_thousands(m.calories)} kcal', fill: c.paper, ink: c.ink),
                      Tag('${m.macros.proteinG.round()} g protein', fill: c.paper, ink: c.ink),
                      Tag('${m.ingredients.length} ingredients', fill: c.paper, ink: c.ink),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: Space.s2),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Day ${next.day} of ${next.days} of your plan',
                          style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                        ),
                      ),
                      Text(
                        'See the recipe',
                        style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.glucoseInk),
                      ),
                      Icon(Icons.chevron_right_rounded, color: c.glucoseInk),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// No plan for today: an invitation to make one, and the pantry when it has food in it.
class _NoPlan extends StatelessWidget {
  const _NoPlan({required this.pantryCount, required this.onPlan, required this.onPantry});

  final int pantryCount;
  final VoidCallback onPlan;
  final VoidCallback onPantry;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(Space.s4),
      decoration: BoxDecoration(color: c.glucoseSoft, borderRadius: BorderRadius.circular(Radii.card)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s2,
        children: [
          const Text(
            'Plan the next 3 days',
            style: TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800, letterSpacing: -0.3),
          ),
          Text(
            'Meals that fit your calories and protein, with one shopping list for all of them.',
            style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.ink),
          ),
          const SizedBox(height: Space.s1),
          FilledButton(onPressed: onPlan, child: const Text('Make a meal plan')),
          if (pantryCount > 0)
            TextButton(
              onPressed: onPantry,
              child: Text('Cook from your pantry ($pantryCount ${pantryCount == 1 ? 'item' : 'items'})'),
            ),
        ],
      ),
    );
  }
}

/// Where things stand: the shopping list, the pantry, today's coffee and the plan, one row each.
class _Stock extends StatelessWidget {
  const _Stock(
    this.k, {
    required this.next,
    required this.onShopping,
    required this.onPantry,
    required this.onCoffee,
    required this.onPlan,
  });

  final _Kitchen? k;
  final ({PlanMeal meal, String when, int day, int days, int targetCalories})? next;
  final VoidCallback onShopping;
  final VoidCallback onPantry;
  final VoidCallback onCoffee;
  final VoidCallback onPlan;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final toBuy = k?.shopping?.items.where((i) => !i.checked).length;
    final pantry = k?.pantry?.length;
    final coffee = k?.coffee;
    final rows = <(IconData, _Tone, String, String, VoidCallback)>[
      (
        Icons.shopping_basket_outlined,
        _Tone.green,
        'Shopping list',
        switch (toBuy) {
          null => 'By aisle, ticked off as you shop',
          0 => 'Nothing to buy',
          1 => '1 thing to buy',
          final n => '$n things to buy',
        },
        onShopping,
      ),
      (
        Icons.kitchen_rounded,
        _Tone.amber,
        'Pantry',
        switch (pantry) {
          null => 'What can I make from it?',
          0 => 'Add what you have to get recipes from it',
          1 => '1 item · see what you can make',
          final n => '$n items · see what you can make',
        },
        onPantry,
      ),
      (
        Icons.coffee_rounded,
        _Tone.amber,
        'Coffee',
        switch (coffee) {
          null => 'Mould check and your caffeine curfew',
          final d when d.cups.isEmpty => 'None yet today · curfew ${d.curfew}',
          final d =>
            '${d.cups.length} ${d.cups.length == 1 ? 'cup' : 'cups'} · ${d.caffeineMg} mg caffeine · curfew ${d.curfew}',
        },
        onCoffee,
      ),
      if (next case final n?)
        (
          Icons.calendar_month_rounded,
          _Tone.violet,
          'Meal plan',
          'Day ${n.day} of ${n.days} · ${_thousands(n.targetCalories)} kcal a day',
          onPlan,
        ),
    ];
    return Material(
      color: c.paper,
      borderRadius: BorderRadius.circular(Radii.card),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (final (i, (icon, tone, title, detail, onTap)) in rows.indexed) ...[
            if (i > 0) Divider(height: 1, indent: 68, color: c.rule),
            Semantics(
              button: true,
              label: '$title: $detail',
              excludeSemantics: true,
              child: InkWell(
                onTap: onTap,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(Space.s4, Space.s3, Space.s3, Space.s3),
                  child: Row(
                    spacing: Space.s3,
                    children: [
                      _Badge(icon, tone),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
                            ),
                            Text(
                              detail,
                              style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                            ),
                          ],
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded, color: c.inkSoft),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// A one-off tool: a small tile, three to a row.
class _Tool extends StatelessWidget {
  const _Tool({required this.icon, required this.title, required this.detail, required this.tone, required this.onTap});

  final IconData icon;
  final String title;
  final String detail;
  final _Tone tone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      button: true,
      label: '$title: $detail',
      excludeSemantics: true,
      child: Material(
        color: c.paper,
        borderRadius: BorderRadius.circular(Radii.option),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(Space.s3),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Badge(icon, tone, size: 32),
                const SizedBox(height: Space.s2),
                const Spacer(),
                Text(
                  title,
                  maxLines: 2,
                  style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, height: 1.2),
                ),
                const SizedBox(height: 2),
                Text(
                  detail,
                  maxLines: 2,
                  style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft, height: 1.3),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// An icon on a soft circle in its tone's colour.
class _Badge extends StatelessWidget {
  const _Badge(this.icon, this.tone, {this.size = 40});

  final IconData icon;
  final _Tone tone;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final (fill, ink) = switch (tone) {
      _Tone.amber => (c.glucoseSoft, c.glucoseInk),
      _Tone.green => (c.chlorophyllSoft, c.chlorophyll),
      _Tone.violet => (c.synapseSoft, c.synapseInk),
      _Tone.blue => (c.ionSoft, c.ionInk),
    };
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: fill, shape: BoxShape.circle),
      child: Icon(icon, size: size * 0.55, color: ink),
    );
  }
}

/// A way into the food catalog: a strip of foods for focus and a link.
class BrowseFoodsCard extends StatelessWidget {
  const BrowseFoodsCard({super.key, required this.onTap});

  final VoidCallback onTap;

  static const _preview = [
    ('salmon', 'fish'),
    ('blueberries', 'fruit'),
    ('walnuts', 'nuts_seeds'),
    ('eggs', 'eggs_dairy'),
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      button: true,
      label: 'Browse foods for focus, energy and sleep',
      excludeSemantics: true,
      child: Material(
        color: c.paper,
        borderRadius: BorderRadius.circular(Radii.card),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(Space.s4, 14, Space.s3, 14),
            child: Row(
              spacing: Space.s3,
              children: [
                SizedBox(
                  width: 104,
                  height: 40,
                  child: Stack(
                    children: [
                      for (final (i, (id, category)) in _preview.indexed)
                        Positioned(
                          left: i * 21.0,
                          child: Container(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: c.paper, width: 2),
                            ),
                            child: ClipOval(
                              child: FoodImage(id: id, category: category, size: 36, radius: 18),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Browse foods',
                        style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
                      ),
                      Text('For focus, energy, sleep and calm', style: TextStyle(fontSize: TextSize.xs)),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right_rounded, color: c.inkSoft),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

enum _Tone { amber, green, violet, blue }
