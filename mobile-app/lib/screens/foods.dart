import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/food_image.dart';
import '../widgets/sheet.dart';
import '../widgets/ui.dart';

/// A food someone picked, and how many servings.
typedef PickedFood = ({CatalogFood food, double servings});

/// Browse the food catalog: search, filter by goal or diet, open a food to see why it helps.
/// With [onLog], a food's sheet offers to log it; [showFoodPicker] uses the same screen to pick one.
class FoodsScreen extends StatefulWidget {
  const FoodsScreen({super.key, this.picking = false, this.onLog});

  /// Opened from "Log a meal": choosing a food returns it instead of logging it.
  final bool picking;

  /// Logs a meal with the food (browse mode).
  final void Function(PickedFood picked)? onLog;

  @override
  State<FoodsScreen> createState() => _FoodsScreenState();
}

/// Opens the catalog to pick one food for a meal. Null if they backed out.
Future<PickedFood?> showFoodPicker(BuildContext context) =>
    Navigator.of(context).push<PickedFood>(MaterialPageRoute(builder: (_) => const FoodsScreen(picking: true)));

const _goals = ['focus', 'energy', 'sleep', 'calm'];
const _goalNames = {'focus': 'Focus', 'energy': 'Energy', 'sleep': 'Sleep', 'calm': 'Calm'};

class _FoodsScreenState extends State<FoodsScreen> {
  Future<(List<CatalogFood>, String?)>? _load;
  final _search = TextEditingController();
  String? _goal;
  var _myDiet = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _load ??= _fetch();
  }

  Future<(List<CatalogFood>, String?)> _fetch() async {
    final api = AppScope.of(context).api;
    final foods = await api.foods();
    String? diet;
    try {
      diet = (await api.me())?.diet;
    } catch (_) {
      // The diet filter is optional.
    }
    return (foods, diet);
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _open(CatalogFood food) async {
    final picked = await showFoodSheet(context, food, action: widget.picking ? 'Add to meal' : 'Log it');
    if (picked == null || !mounted) return;
    if (widget.picking) {
      Navigator.of(context).pop(picked);
    } else {
      widget.onLog?.call(picked);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.picking ? 'Add a food' : 'Foods'),
        backgroundColor: c.mist,
        surfaceTintColor: Colors.transparent,
      ),
      body: FutureBuilder(
        future: _load,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Padding(
              padding: const EdgeInsets.all(Space.s4),
              child: ScreenFailed(
                title: "Couldn't load foods",
                detail: 'Check your connection and try again.',
                onRetry: () => setState(() => _load = _fetch()),
              ),
            );
          }
          if (!snapshot.hasData) {
            return const Padding(
              padding: EdgeInsets.all(Space.s4),
              child: ScreenLoading(label: 'Loading foods', heights: [48, 220, 220]),
            );
          }
          final (foods, diet) = snapshot.data!;
          final term = _search.text.trim().toLowerCase();
          final shown = [
            for (final f in foods)
              if ((term.isEmpty || f.name.toLowerCase().contains(term)) &&
                  (_goal == null || f.goals.contains(_goal)) &&
                  (!_myDiet || diet == null || f.diets.contains(diet)))
                f,
          ];
          return CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(Space.s4, 0, Space.s4, Space.s3),
                sliver: SliverList.list(
                  children: [
                    TextField(
                      controller: _search,
                      onChanged: (_) => setState(() {}),
                      textInputAction: TextInputAction.search,
                      decoration: const InputDecoration(
                        hintText: 'Search foods',
                        prefixIcon: Icon(Icons.search_rounded),
                      ),
                    ),
                    const SizedBox(height: Space.s3),
                    Wrap(
                      spacing: Space.s2,
                      runSpacing: Space.s2,
                      children: [
                          ChoicePill(label: 'All', selected: _goal == null, onTap: () => setState(() => _goal = null)),
                          for (final g in _goals)
                            ChoicePill(
                              label: _goalNames[g]!,
                              selected: _goal == g,
                              onTap: () => setState(() => _goal = _goal == g ? null : g),
                            ),
                          if (diet != null && diet != 'omnivore' && diet != 'standard')
                            ChoicePill(
                              label: 'Fits my diet',
                              selected: _myDiet,
                              onTap: () => setState(() => _myDiet = !_myDiet),
                            ),
                      ],
                    ),
                  ],
                ),
              ),
              if (shown.isEmpty)
                SliverPadding(
                  padding: const EdgeInsets.all(Space.s4),
                  sliver: SliverToBoxAdapter(
                    child: EmptyCard(
                      title: 'No foods match',
                      detail: widget.picking ? 'Try another word, or add it by hand.' : 'Try another word or filter.',
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(Space.s4, 0, Space.s4, Space.s6),
                  sliver: SliverGrid.builder(
                    gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                      maxCrossAxisExtent: 220,
                      mainAxisSpacing: Space.s3,
                      crossAxisSpacing: Space.s3,
                      childAspectRatio: 0.74,
                    ),
                    itemCount: shown.length,
                    itemBuilder: (context, i) => _FoodTile(shown[i], onTap: () => _open(shown[i])),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _FoodTile extends StatelessWidget {
  const _FoodTile(this.food, {required this.onTap});

  final CatalogFood food;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      button: true,
      label: '${food.name}, ${food.serving}, ${food.calories.round()} calories',
      excludeSemantics: true,
      child: Material(
        color: c.paper,
        borderRadius: BorderRadius.circular(Radii.card),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(Space.s2),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AspectRatio(aspectRatio: 1, child: FoodImage(id: food.id, category: food.category)),
                const SizedBox(height: Space.s2),
                Text(
                  food.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
                ),
                Text(
                  '${food.calories.round()} kcal · ${food.serving}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A food up close: photo, why it helps, nutrition and a servings choice. Returns the choice when
/// [action] is tapped.
Future<PickedFood?> showFoodSheet(BuildContext context, CatalogFood food, {required String action}) =>
    showAppSheet<PickedFood>(context, title: food.name, builder: (_) => _FoodSheet(food, action: action));

const _servingChoices = [0.5, 1.0, 1.5, 2.0, 3.0];

class _FoodSheet extends StatefulWidget {
  const _FoodSheet(this.food, {required this.action});

  final CatalogFood food;
  final String action;

  @override
  State<_FoodSheet> createState() => _FoodSheetState();
}

class _FoodSheetState extends State<_FoodSheet> {
  var _servings = 1.0;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final f = widget.food;
    final item = f.toItem(_servings);
    String n(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toStringAsFixed(1);
    Widget stat(String value, String label) => Expanded(
      child: Column(
        children: [
          Text(value, style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800)),
          Text(label, style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft)),
        ],
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        SizedBox(height: 180, child: FoodImage(id: f.id, category: f.category, radius: Radii.hero)),
        Text(f.why, style: const TextStyle(fontSize: TextSize.sm, height: 1.45)),
        if (f.goals.isNotEmpty)
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final g in f.goals) Tag('Good for ${_goalNames[g]!.toLowerCase()}', fill: c.synapseSoft, ink: c.synapseInk),
              Tag(switch (f.glycemicLoad) {
                GlycemicLoad.low => 'Low glycemic load',
                GlycemicLoad.medium => 'Medium glycemic load',
                GlycemicLoad.high => 'High glycemic load',
              }, fill: c.mist, ink: c.inkSoft),
            ],
          ),
        AppCard(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Row(
            children: [
              stat('${item.calories.round()}', 'kcal'),
              stat('${n(item.macros.proteinG)} g', 'protein'),
              stat('${n(item.macros.carbsG)} g', 'carbs'),
              stat('${n(item.macros.fatG)} g', 'fat'),
            ],
          ),
        ),
        Text('Servings · ${f.serving} each', style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft)),
        Wrap(
          spacing: Space.s2,
          runSpacing: Space.s2,
          children: [
            for (final s in _servingChoices)
              ChoicePill(label: n(s), selected: _servings == s, onTap: () => setState(() => _servings = s)),
          ],
        ),
        Text('Nutrition from USDA FoodData Central.', style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft)),
        SheetAction(label: widget.action, onPressed: () => Navigator.of(context).pop((food: f, servings: _servings))),
      ],
    );
  }
}
