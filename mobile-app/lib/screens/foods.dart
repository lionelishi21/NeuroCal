import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/food_image.dart';
import '../widgets/sheet.dart';
import '../widgets/ui.dart';

/// A food someone picked, and how many servings.
typedef PickedFood = ({CatalogFood food, double servings});

/// Browse the food catalog: search, filter by goal or diet, open a food to see why it helps. "Eating
/// out" switches to chain-restaurant menus for the phone's country, one chain at a time; a search
/// finds those items too. With [onLog], a food's sheet offers to log it; [showFoodPicker] uses the
/// same screen to pick one.
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

/// Countries with eating-out menus, in the order they're offered.
const _regionNames = {'US': 'United States', 'GB': 'United Kingdom', 'JM': 'Jamaica'};

/// The phone's country when there are menus for it, else the US.
String _regionOf(Locale locale) => _regionNames.containsKey(locale.countryCode) ? locale.countryCode! : 'US';

class _FoodsScreenState extends State<FoodsScreen> {
  Future<(List<CatalogFood>, String?)>? _load;
  final _search = TextEditingController();
  String? _goal;
  var _myDiet = false;
  var _eatingOut = false;
  String? _region;
  String? _chain;

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

  Future<void> _open(CatalogFood food, List<CatalogFood> all) async {
    final picked = await showFoodSheet(context, food, action: widget.picking ? 'Add to meal' : 'Log it', all: all);
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
          final region = _region ?? _regionOf(Localizations.localeOf(context));
          final regions = [for (final r in _regionNames.keys) if (foods.any((f) => f.regions.contains(r))) r];
          final menu = [for (final f in foods) if (f.eatingOut && f.regions.contains(region)) f];
          final chains = <String, String>{for (final f in menu) f.chain!.id: f.chain!.name};
          final shown = _eatingOut
              ? [
                  for (final f in menu)
                    if ((_chain == null || f.chain!.id == _chain) && (term.isEmpty || f.fullName.toLowerCase().contains(term))) f,
                ]
              : [
                  for (final f in foods)
                    // Chain items only show up for a search, so browsing stays on whole foods.
                    if ((term.isEmpty ? !f.eatingOut : f.fullName.toLowerCase().contains(term) && (!f.eatingOut || f.regions.contains(region))) &&
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
                      decoration: InputDecoration(
                        hintText: _eatingOut ? 'Search menus' : 'Search foods, or a place like KFC',
                        prefixIcon: const Icon(Icons.search_rounded),
                      ),
                    ),
                    const SizedBox(height: Space.s3),
                    Wrap(
                      spacing: Space.s2,
                      runSpacing: Space.s2,
                      children: [
                          ChoicePill(
                            label: 'All',
                            selected: _goal == null && !_eatingOut,
                            onTap: () => setState(() {
                              _goal = null;
                              _eatingOut = false;
                            }),
                          ),
                          if (menu.isNotEmpty)
                            ChoicePill(
                              label: 'Eating out',
                              selected: _eatingOut,
                              onTap: () => setState(() {
                                _eatingOut = !_eatingOut;
                                _goal = null;
                                _chain = null;
                              }),
                            ),
                          if (!_eatingOut)
                            for (final g in _goals)
                              ChoicePill(
                                label: _goalNames[g]!,
                                selected: _goal == g,
                                onTap: () => setState(() => _goal = _goal == g ? null : g),
                              ),
                          if (!_eatingOut && diet != null && diet != 'omnivore' && diet != 'standard')
                            ChoicePill(
                              label: 'Fits my diet',
                              selected: _myDiet,
                              onTap: () => setState(() => _myDiet = !_myDiet),
                            ),
                      ],
                    ),
                    if (_eatingOut) ...[
                      const SizedBox(height: Space.s3),
                      _Chains(
                        chains: chains,
                        selected: _chain,
                        onSelect: (id) => setState(() => _chain = _chain == id ? null : id),
                      ),
                      if (regions.length > 1)
                        Padding(
                          padding: const EdgeInsets.only(top: Space.s2),
                          child: Wrap(
                            spacing: Space.s2,
                            runSpacing: Space.s2,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text('Menus in', style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft)),
                              for (final r in regions)
                                ChoicePill(
                                  label: _regionNames[r]!,
                                  height: 36,
                                  selected: r == region,
                                  onTap: () => setState(() {
                                    _region = r;
                                    _chain = null;
                                  }),
                                ),
                            ],
                          ),
                        ),
                    ],
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
                    itemBuilder: (context, i) => _FoodTile(shown[i], onTap: () => _open(shown[i], foods)),
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
      label: '${food.fullName}, ${food.serving}, ${food.calories.round()} calories',
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
                  food.chain == null ? '${food.calories.round()} kcal · ${food.serving}' : '${food.chain!.name} · ${food.calories.round()} kcal',
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
/// [all] is the catalog, for an eating-out item's better pick.
Future<PickedFood?> showFoodSheet(BuildContext context, CatalogFood food, {required String action, List<CatalogFood> all = const []}) =>
    showAppSheet<PickedFood>(context, title: food.fullName, builder: (_) => _FoodSheet(food, action: action, all: all));

const _servingChoices = [0.5, 1.0, 1.5, 2.0, 3.0];

class _FoodSheet extends StatefulWidget {
  const _FoodSheet(this.food, {required this.action, this.all = const []});

  final CatalogFood food;
  final String action;
  final List<CatalogFood> all;

  @override
  State<_FoodSheet> createState() => _FoodSheetState();
}

class _FoodSheetState extends State<_FoodSheet> {
  var _servings = 1.0;
  late var _food = widget.food;

  /// The better pick, in this same sheet.
  void _switchTo(CatalogFood food) => setState(() {
    _food = food;
    _servings = 1;
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final f = _food;
    final item = f.toItem(_servings);
    final better = f.betterPick == null ? null : widget.all.where((x) => x.id == f.betterPick).firstOrNull;
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
        if (f != widget.food) Text(f.fullName, style: const TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w800)),
        SizedBox(height: 180, child: FoodImage(id: f.id, category: f.category, radius: Radii.hero)),
        Text(f.why, style: const TextStyle(fontSize: TextSize.sm, height: 1.45)),
        if (f.eatingOut)
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              Tag(_glycemicLabel(f.glycemicLoad), fill: f.glycemicLoad == GlycemicLoad.high ? c.glucoseSoft : c.mist, ink: f.glycemicLoad == GlycemicLoad.high ? c.glucoseInk : c.inkSoft),
              Tag(f.processing.label, fill: c.mist, ink: c.inkSoft),
            ],
          )
        else if (f.goals.isNotEmpty)
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final g in f.goals) Tag('Good for ${_goalNames[g]!.toLowerCase()}', fill: c.synapseSoft, ink: c.synapseInk),
              Tag(_glycemicLabel(f.glycemicLoad), fill: c.mist, ink: c.inkSoft),
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
        if (better case final b?) _BetterPick(b, onTap: () => _switchTo(b)),
        Text(_sourceNote(f), style: TextStyle(fontSize: TextSize.xxs, height: 1.35, color: c.inkSoft)),
        if (f.sourceUrl case final url?)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: () => AppScope.of(context).openLink(Uri.parse(url)),
              child: Text('See it on ${f.chain?.name ?? 'the menu'}'),
            ),
          ),
        SheetAction(label: widget.action, onPressed: () => Navigator.of(context).pop((food: f, servings: _servings))),
      ],
    );
  }
}

String _sourceNote(CatalogFood f) => switch (f.source) {
  'usda' => "Nutrition from USDA's analysis of the US menu (FoodData Central). Recipes and portions change, so treat it as close, not exact.",
  'chain' => "Nutrition as ${f.chain?.name ?? 'the chain'} publishes it${f.fiberG == 0 ? '; fibre isn\'t published' : ''}.",
  'recipe' => 'Estimated from a typical recipe with USDA ingredient data. Portions and recipes vary from place to place.',
  _ => 'Nutrition from USDA FoodData Central.',
};

String _glycemicLabel(GlycemicLoad load) => switch (load) {
  GlycemicLoad.low => 'Low glycemic load',
  GlycemicLoad.medium => 'Medium glycemic load',
  GlycemicLoad.high => 'High glycemic load',
};

/// The chains on the phone's country's menus, one tap to show only that chain.
class _Chains extends StatelessWidget {
  const _Chains({required this.chains, required this.selected, required this.onSelect});

  final Map<String, String> chains;
  final String? selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: Space.s2,
    runSpacing: Space.s2,
    children: [
      for (final MapEntry(key: id, value: name) in chains.entries)
        ChoicePill(label: name, height: 36, selected: selected == id, onTap: () => onSelect(id)),
    ],
  );
}

/// "Better pick here": a choice at the same place with more protein for its calories, or fewer calories
/// and carbs. Tapping it shows it in the sheet, ready to log instead.
class _BetterPick extends StatelessWidget {
  const _BetterPick(this.food, {required this.onTap});

  final CatalogFood food;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      button: true,
      label: 'Better pick here: ${food.name}, ${food.calories.round()} calories, ${food.macros.proteinG.round()} grams of protein',
      excludeSemantics: true,
      child: Material(
        color: c.chlorophyllSoft,
        borderRadius: BorderRadius.circular(Radii.control),
        child: InkWell(
          borderRadius: BorderRadius.circular(Radii.control),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(Space.s3),
            child: Row(
              spacing: Space.s3,
              children: [
                FoodImage(id: food.id, category: food.category, size: 44),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 2,
                    children: [
                      Text('Better pick here', style: TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w700, color: c.chlorophyll)),
                      Text(food.name, style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700)),
                      Text(
                        '${food.calories.round()} kcal, ${food.macros.proteinG.round()} g protein',
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
    );
  }
}
