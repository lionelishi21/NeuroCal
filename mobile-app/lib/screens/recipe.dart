import 'package:flutter/material.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/meal_visual.dart';
import '../widgets/sheet.dart';
import '../widgets/ui.dart';

/// Work out a recipe's calories: paste or type the ingredients with amounts, set the servings, and see
/// calories and macros per serving. Ingredients matched to the food catalog use its USDA values; the
/// rest are estimates, and each says which. [onLog] logs one serving.
class RecipeScreen extends StatefulWidget {
  const RecipeScreen({super.key, required this.onLog});

  final Future<void> Function(RecipeAnalysis recipe) onLog;

  @override
  State<RecipeScreen> createState() => _RecipeScreenState();
}

class _RecipeScreenState extends State<RecipeScreen> {
  final _text = TextEditingController();
  int? _servings;
  Future<RecipeAnalysis>? _result;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  void _work() {
    if (_text.text.trim().length < 10) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _result = AppScope.of(context).api.analyzeRecipe(_text.text, servings: _servings);
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Work out a recipe'),
        backgroundColor: c.mist,
        surfaceTintColor: Colors.transparent,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(Space.s4, 0, Space.s4, Space.s6),
        children: [
          Text(
            'Paste or type the ingredients with their amounts. We’ll work out the calories and macros per serving.',
            style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
          ),
          const SizedBox(height: Space.s3),
          TextField(
            controller: _text,
            minLines: 5,
            maxLines: 14,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              labelText: 'Ingredients',
              hintText: 'e.g.\n1 cup rolled oats\n2 eggs\n1 tbsp olive oil\n200 g spinach',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: Space.s3),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Servings',
                  style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.inkSoft),
                ),
              ),
              IconButton(
                tooltip: 'Fewer servings',
                onPressed: (_servings ?? 2) > 1 ? () => setState(() => _servings = (_servings ?? 2) - 1) : null,
                icon: const Icon(Icons.remove_circle_outline_rounded),
              ),
              Semantics(
                liveRegion: true,
                child: Text(
                  _servings == null ? 'As written' : '$_servings',
                  style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
                ),
              ),
              IconButton(
                tooltip: 'More servings',
                onPressed: (_servings ?? 1) < 24 ? () => setState(() => _servings = (_servings ?? 1) + 1) : null,
                icon: const Icon(Icons.add_circle_outline_rounded),
              ),
            ],
          ),
          const SizedBox(height: Space.s2),
          FilledButton.icon(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
            onPressed: _work,
            icon: const Icon(Icons.calculate_outlined, size: 20),
            label: const Text('Work it out'),
          ),
          if (_result != null) _Result(_result!, onRetry: _work, onLog: widget.onLog),
        ],
      ),
    );
  }
}

class _Result extends StatelessWidget {
  const _Result(this.result, {required this.onRetry, required this.onLog});

  final Future<RecipeAnalysis> result;
  final VoidCallback onRetry;
  final Future<void> Function(RecipeAnalysis) onLog;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return FutureBuilder(
      future: result,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return Padding(
            padding: const EdgeInsets.only(top: Space.s5),
            child: Column(
              spacing: Space.s3,
              children: [
                const CircularProgressIndicator(),
                Text(
                  'Reading the recipe…',
                  style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
                ),
              ],
            ),
          );
        }
        if (snapshot.hasError) {
          return Padding(
            padding: const EdgeInsets.only(top: Space.s4),
            child: switch (snapshot.error) {
              ApiException(status: 402) => const SheetNote(
                lead: 'Part of your subscription.',
                detail: 'Recipe calories come with NeuroCal Pro.',
              ),
              ApiException(status: 400, :final message) => SheetNote(lead: 'Check the recipe.', detail: message),
              ApiException(status: >= 500) => ScreenFailed(
                title: "Couldn't read the recipe",
                detail: 'The recipe service isn’t answering right now. Try again in a few minutes.',
                onRetry: onRetry,
              ),
              _ => ScreenFailed(
                title: "Couldn't read the recipe",
                detail: 'Check your connection and try again.',
                onRetry: onRetry,
              ),
            },
          );
        }
        final r = snapshot.data!;
        if (r.problem != null) {
          return const Padding(
            padding: EdgeInsets.only(top: Space.s4),
            child: SheetNote(
              lead: 'That doesn’t look like a recipe.',
              detail: 'List the ingredients with their amounts, one per line.',
            ),
          );
        }
        final (fill, ink) = switch (r.processing) {
          FoodProcessing.whole => (c.chlorophyllSoft, c.chlorophyll),
          FoodProcessing.processed => (c.glucoseSoft, c.glucoseInk),
          FoodProcessing.ultraProcessed => (c.beetSoft, c.beet),
        };
        Widget stat(String value, String label) => Expanded(
          child: Column(
            children: [
              Text(
                value,
                style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
              ),
              Text(
                label,
                style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft),
              ),
            ],
          ),
        );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            BlockTitle(r.title, note: r.servings == 1 ? '1 serving' : '${r.servings} servings'),
            MealVisual(ingredients: [for (final i in r.ingredients) i.name]),
            const SizedBox(height: Space.s3),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: Space.s3,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Expanded(
                        child: Text(
                          '${r.calories} kcal',
                          style: const TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800),
                        ),
                      ),
                      Text(
                        'per serving',
                        style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      stat('${r.macros.proteinG.round()} g', 'protein'),
                      stat('${r.macros.carbsG.round()} g', 'carbs'),
                      stat('${r.macros.fatG.round()} g', 'fat'),
                    ],
                  ),
                  Row(
                    children: [
                      Expanded(
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: Tag(r.processing.label, fill: fill, ink: ink),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: () => AppScope.of(context).openLink(videoSearchFor(r.title)),
                        icon: const Icon(Icons.play_circle_outline_rounded, size: 18),
                        label: const Text('Watch how'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const BlockTitle('Ingredients'),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (final (n, i) in r.ingredients.indexed)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: Space.s4, vertical: Space.s3),
                      decoration: BoxDecoration(
                        border: n == 0 ? null : Border(top: BorderSide(color: c.rule)),
                      ),
                      child: Row(
                        spacing: Space.s2,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  i.name,
                                  style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
                                ),
                                Text(
                                  [
                                    if (i.quantity.isNotEmpty) i.quantity,
                                    '${i.grams.round()} g',
                                    if (!i.fromCatalog) 'estimated',
                                  ].join(' · '),
                                  style: TextStyle(
                                    fontSize: TextSize.xxs,
                                    color: i.fromCatalog ? c.inkSoft : c.glucoseInk,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '${i.calories} kcal',
                            style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: Space.s2),
              child: Text(
                '${(r.catalogShare * 100).round()}% of the calories come from USDA FoodData Central values; ingredients marked estimated are approximate.',
                style: TextStyle(fontSize: TextSize.xxs, height: 1.4, color: c.inkFaint),
              ),
            ),
            const SizedBox(height: Space.s4),
            SheetAction(label: 'Log a serving', onPressed: () => onLog(r)),
          ],
        );
      },
    );
  }
}
