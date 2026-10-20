import 'package:flutter/material.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/meal_visual.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';
import 'cook_mode.dart';

/// What's in the kitchen, and recipes cooked from it that fit what's left of today.
/// [onCook] logs a recipe as a meal (Log a meal, filled in).
class PantryScreen extends StatefulWidget {
  const PantryScreen({super.key, required this.onCook});

  final Future<void> Function(PantryRecipe recipe) onCook;

  @override
  State<PantryScreen> createState() => _PantryScreenState();
}

/// Common staples offered as one tap, when not already in the pantry.
const _staples = [
  'Eggs',
  'Oats',
  'Rice',
  'Spinach',
  'Chicken breast',
  'Greek yogurt',
  'Lentils',
  'Canned tuna',
  'Tomatoes',
  'Onions',
  'Garlic',
  'Sweet potatoes',
  'Black beans',
  'Frozen berries',
  'Broccoli',
  'Cheese',
];

String _key(String name) => name.toLowerCase().replaceAll(RegExp(r'(?<=[a-z]{3})(es|s)$'), '');

class _PantryScreenState extends State<PantryScreen> {
  Future<List<PantryItem>>? _items;
  final _field = TextEditingController();

  /// Null until asked; then loading, the recipes, or the reason there are none.
  Future<List<PantryRecipe>>? _recipes;

  NeuroCalApi get _api => AppScope.of(context).api;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _items ??= _api.pantry();
  }

  @override
  void dispose() {
    _field.dispose();
    super.dispose();
  }

  Future<void> _add(List<String> names) async {
    final clean = [for (final n in names) if (n.trim().isNotEmpty) n.trim()];
    if (clean.isEmpty) return;
    final next = _api.addToPantry(clean);
    setState(() {
      _items = next;
    });
    try {
      await next;
      _field.clear();
    } catch (_) {
      if (mounted) showToast(context, "Couldn't add that. Check your connection and try again.", ToastTone.problem);
      _reload();
    }
  }

  Future<void> _remove(PantryItem item) async {
    try {
      await _api.removeFromPantry(item.id);
    } catch (_) {
      if (mounted) showToast(context, "Couldn't remove ${item.name}. Try again.", ToastTone.problem);
    }
    _reload();
  }

  void _reload() {
    if (!mounted) return;
    setState(() {
      _items = _api.pantry();
    });
  }

  void _cookSomething() => setState(() {
    _recipes = _api.pantryRecipes();
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      appBar: AppBar(title: const Text('Your pantry'), backgroundColor: c.mist, surfaceTintColor: Colors.transparent),
      body: FutureBuilder(
        future: _items,
        builder: (context, snapshot) {
          final items = snapshot.data ?? const <PantryItem>[];
          final have = items.map((i) => _key(i.name)).toSet();
          final staples = [for (final s in _staples) if (!have.contains(_key(s))) s];
          return ListView(
            padding: const EdgeInsets.fromLTRB(Space.s4, 0, Space.s4, Space.s6),
            children: [
              Text(
                'Add what’s in your kitchen and we’ll suggest meals that use it and fit what’s left of today.',
                style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
              ),
              const SizedBox(height: Space.s3),
              Row(
                spacing: Space.s2,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _field,
                      textCapitalization: TextCapitalization.sentences,
                      textInputAction: TextInputAction.done,
                      decoration: const InputDecoration(labelText: 'Add items', hintText: 'e.g. eggs, spinach, rice'),
                      onSubmitted: (v) => _add(v.split(',')),
                    ),
                  ),
                  SoftButton(label: 'Add', onPressed: () => _add(_field.text.split(','))),
                ],
              ),
              if (snapshot.hasError)
                Padding(
                  padding: const EdgeInsets.only(top: Space.s3),
                  child: ScreenFailed(title: "Couldn't load your pantry", detail: 'Check your connection and try again.', onRetry: _reload),
                )
              else if (!snapshot.hasData)
                const Padding(padding: EdgeInsets.only(top: Space.s3), child: ScreenLoading(label: 'Loading your pantry', heights: [96]))
              else ...[
                BlockTitle('In your kitchen', note: items.isEmpty ? null : '${items.length} items'),
                if (items.isEmpty)
                  Text('Nothing yet. Type items above or tap a staple below.', style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft))
                else
                  Wrap(
                    spacing: Space.s2,
                    runSpacing: Space.s2,
                    children: [
                      for (final item in items)
                        InputChip(
                          label: Text(item.name),
                          deleteButtonTooltipMessage: 'Remove ${item.name}',
                          onDeleted: () => _remove(item),
                          backgroundColor: c.paper,
                          side: BorderSide(color: c.rule),
                        ),
                    ],
                  ),
                if (staples.isNotEmpty) ...[
                  const BlockTitle('Quick add'),
                  Wrap(
                    spacing: Space.s2,
                    runSpacing: Space.s2,
                    children: [
                      for (final s in staples)
                        ActionChip(
                          avatar: Icon(Icons.add_rounded, size: 16, color: c.synapseInk),
                          label: Text(s),
                          onPressed: () => _add([s]),
                          backgroundColor: c.synapseSoft,
                          side: BorderSide.none,
                        ),
                    ],
                  ),
                ],
                const SizedBox(height: Space.s5),
                FilledButton.icon(
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56)),
                  onPressed: items.length < 3 ? null : _cookSomething,
                  icon: const Icon(Icons.restaurant_menu_rounded, size: 20),
                  label: const Text('What can I make?'),
                ),
                if (items.length < 3)
                  Padding(
                    padding: const EdgeInsets.only(top: Space.s2),
                    child: Text('Add at least 3 items first.', textAlign: TextAlign.center, style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft)),
                  ),
                if (_recipes != null) _Recipes(_recipes!, onRetry: _cookSomething, onCook: widget.onCook),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _Recipes extends StatelessWidget {
  const _Recipes(this.recipes, {required this.onRetry, required this.onCook});

  final Future<List<PantryRecipe>> recipes;
  final VoidCallback onRetry;
  final Future<void> Function(PantryRecipe) onCook;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return FutureBuilder(
      future: recipes,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return Padding(
            padding: const EdgeInsets.only(top: Space.s4),
            child: Column(
              spacing: Space.s3,
              children: [
                const CircularProgressIndicator(),
                Text('Thinking up recipes from your kitchen…', style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft)),
              ],
            ),
          );
        }
        if (snapshot.hasError) {
          final e = snapshot.error;
          return Padding(
            padding: const EdgeInsets.only(top: Space.s4),
            child: ScreenFailed(
              title: "Couldn't suggest recipes",
              detail: switch (e) {
                ApiException(status: 402) => 'Recipe ideas are part of your subscription.',
                ApiException(status: 400, :final message) when message.contains('at least') =>
                  'Add at least 3 items to your pantry first.',
                // The server answered but the recipe service didn't: not the phone's connection.
                ApiException(status: >= 500) => 'Recipe ideas aren’t available right now. Try again in a few minutes.',
                _ => 'Check your connection and try again.',
              },
              onRetry: onRetry,
            ),
          );
        }
        final list = snapshot.data!;
        if (list.isEmpty) {
          return Padding(
            padding: const EdgeInsets.only(top: Space.s4),
            child: Text(
              'Nothing sensible to make from this yet. Add a protein (eggs, beans, chicken) and a vegetable.',
              style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
            ),
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const BlockTitle('You could make'),
            for (final r in list) Padding(padding: const EdgeInsets.only(bottom: Space.s3), child: RecipeCard(r, onCook: onCook)),
          ],
        );
      },
    );
  }
}

/// A recipe with what to buy, steps on demand, cook mode and Log it. Also the homemade version on a food scan.
class RecipeCard extends StatefulWidget {
  const RecipeCard(this.recipe, {super.key, required this.onCook});

  final PantryRecipe recipe;
  final Future<void> Function(PantryRecipe) onCook;

  @override
  State<RecipeCard> createState() => _RecipeCardState();
}

class _RecipeCardState extends State<RecipeCard> {
  var _steps = false;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final r = widget.recipe;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s2,
        children: [
          MealVisual(ingredients: [for (final i in r.ingredients) i.name], height: 112),
          Text(r.title, style: const TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w800, height: 1.25)),
          Text(
            '${r.minutes} min · ${r.calories} kcal · ${r.macros.proteinG.round()} g protein',
            style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
          ),
          Text(r.whyItFits, style: const TextStyle(fontSize: TextSize.sm, height: 1.4)),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final i in r.ingredients)
                Tag(
                  i.inPantry ? '✓ ${i.name}' : '+ ${i.name}',
                  fill: i.inPantry ? c.chlorophyllSoft : c.glucoseSoft,
                  ink: i.inPantry ? c.chlorophyll : c.glucoseInk,
                ),
            ],
          ),
          if (r.missing.isNotEmpty)
            Text('To buy: ${r.missing.join(', ')}', style: TextStyle(fontSize: TextSize.xs, color: c.glucoseInk)),
          if (_steps)
            for (final (n, step) in r.steps.indexed)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: Space.s2,
                children: [
                  Text('${n + 1}.', style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800, color: c.synapseInk)),
                  Expanded(child: Text(step, style: const TextStyle(fontSize: TextSize.sm, height: 1.4))),
                ],
              ),
          CookActions(
            title: r.title,
            ingredients: [for (final i in r.ingredients) i.quantity.isEmpty ? i.name : '${i.quantity} ${i.name}'],
            steps: r.steps,
          ),
          Row(
            children: [
              Expanded(
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(
                    onPressed: () => setState(() => _steps = !_steps),
                    child: Text(_steps ? 'Hide steps' : 'Show steps'),
                  ),
                ),
              ),
              SoftButton(label: 'Log it', semanticLabel: 'Log ${r.title}', onPressed: () => widget.onCook(r)),
            ],
          ),
        ],
      ),
    );
  }
}
