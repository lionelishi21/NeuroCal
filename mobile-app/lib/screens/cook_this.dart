import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/sheet.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';
import 'cook_mode.dart';
import 'log_meal_sheet.dart' show PhotoTile, maxPhotoBytes;

/// "Cook this": a photo of a dish (a restaurant plate, a friend's dinner, a screenshot) becomes a recipe
/// for it, adjusted for steady energy, with nutrition per serving, what's already in the pantry, the
/// missing ingredients onto the shopping list in one tap, and a serving to log. [onLog] logs one.
class CookThisScreen extends StatefulWidget {
  const CookThisScreen({super.key, required this.onLog, this.picker});

  final Future<void> Function(CookThisRecipe recipe) onLog;

  /// Tests pass a fake.
  final ImagePicker? picker;

  @override
  State<CookThisScreen> createState() => _CookThisScreenState();
}

class _CookThisScreenState extends State<CookThisScreen> {
  late final _picker = widget.picker ?? ImagePicker();
  Uint8List? _photo;
  String _filename = 'dish.jpg';
  Future<CookThisResult>? _result;

  Future<void> _choose(ImageSource source) async {
    final file = await _picker.pickImage(source: source, maxWidth: 1600, imageQuality: 85);
    if (file == null || !mounted) return;
    final bytes = await file.readAsBytes();
    if (!mounted) return;
    if (bytes.length > maxPhotoBytes) {
      showToast(context, 'That photo is larger than 8 MB. Choose a smaller one.', ToastTone.problem);
      return;
    }
    _filename = file.name;
    setState(() {
      _photo = bytes;
      _result = AppScope.of(context).api.cookThis(bytes, file.name);
    });
  }

  void _retry() => setState(() => _result = AppScope.of(context).api.cookThis(_photo!, _filename));

  void _again() => setState(() {
    _photo = null;
    _result = null;
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      appBar: AppBar(title: const Text('Cook this'), backgroundColor: c.mist, surfaceTintColor: Colors.transparent),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(Space.s4, 0, Space.s4, Space.s6),
        children: [
          if (_photo == null) ...[
            Text(
              'Snap a dish you’d like to make: a restaurant plate, a friend’s dinner or a screenshot. '
              'NeuroCal writes the recipe, tuned for steady energy, and what you need to buy.',
              style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
            ),
            const SizedBox(height: Space.s4),
            _Choose(onChoose: _choose),
          ] else ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(Radii.card),
              child: Image.memory(
                _photo!,
                height: 180,
                width: double.infinity,
                fit: BoxFit.cover,
                semanticLabel: 'Your photo',
                errorBuilder: (_, _, _) => const SizedBox.shrink(),
              ),
            ),
            const SizedBox(height: Space.s3),
            _Result(_result!, onRetry: _retry, onAgain: _again, onChoose: _choose, onLog: widget.onLog),
          ],
        ],
      ),
    );
  }
}

class _Choose extends StatelessWidget {
  const _Choose({required this.onChoose});

  final void Function(ImageSource) onChoose;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Row(
      spacing: 10,
      children: [
        Expanded(
          child: PhotoTile(
            label: 'Take a photo',
            icon: Icons.photo_camera_outlined,
            fill: c.synapse,
            ink: c.onAccent,
            onTap: () => onChoose(ImageSource.camera),
          ),
        ),
        Expanded(
          child: PhotoTile(
            label: 'Choose a photo',
            icon: Icons.image_outlined,
            fill: c.synapseSoft,
            ink: c.synapseInk,
            onTap: () => onChoose(ImageSource.gallery),
          ),
        ),
      ],
    );
  }
}

const _problems = {
  'too_dark': ('That photo is too dark.', 'Try again in better light.'),
  'blurry': ('That photo is blurry.', 'Hold still and try again.'),
  'no_food_found': ('No dish found in that photo.', 'Get the whole plate in, or try a screenshot of the dish.'),
};

class _Result extends StatelessWidget {
  const _Result(
    this.result, {
    required this.onRetry,
    required this.onAgain,
    required this.onChoose,
    required this.onLog,
  });

  final Future<CookThisResult> result;
  final VoidCallback onRetry;
  final VoidCallback onAgain;
  final void Function(ImageSource) onChoose;
  final Future<void> Function(CookThisRecipe) onLog;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return FutureBuilder(
      future: result,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return Padding(
            padding: const EdgeInsets.only(top: Space.s4),
            child: Column(
              spacing: Space.s3,
              children: [
                const CircularProgressIndicator(),
                Text(
                  'Writing the recipe…',
                  style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
                ),
              ],
            ),
          );
        }
        if (snapshot.hasError) {
          return switch (snapshot.error) {
            ApiException(status: 402) => const SheetNote(
              lead: 'Part of your subscription.',
              detail: 'Cook this comes with NeuroCal Pro.',
            ),
            ApiException(status: 400, :final message) => SheetNote(lead: 'Check the photo.', detail: message),
            // The server answered but the photo reader didn't: not the phone's connection.
            ApiException(status: >= 500) => ScreenFailed(
              title: 'Photo reading isn’t working right now',
              detail: 'Try again in a few minutes.',
              onRetry: onRetry,
            ),
            _ => ScreenFailed(
              title: 'Couldn’t write the recipe',
              detail: 'Check your connection and try again.',
              onRetry: onRetry,
            ),
          };
        }
        final (:recipe, :problem) = snapshot.data!;
        if (recipe == null) {
          final (lead, detail) = _problems[problem] ?? _problems['no_food_found']!;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: Space.s3,
            children: [
              SheetNote(lead: lead, detail: detail),
              _Choose(onChoose: onChoose),
            ],
          );
        }
        return _Recipe(recipe, onLog: onLog, onAgain: onAgain);
      },
    );
  }
}

class _Recipe extends StatefulWidget {
  const _Recipe(this.recipe, {required this.onLog, required this.onAgain});

  final CookThisRecipe recipe;
  final Future<void> Function(CookThisRecipe) onLog;
  final VoidCallback onAgain;

  @override
  State<_Recipe> createState() => _RecipeState();
}

class _RecipeState extends State<_Recipe> {
  var _adding = false;
  var _added = false;

  Future<void> _addMissing() async {
    final missing = widget.recipe.missing;
    setState(() => _adding = true);
    try {
      await AppScope.of(context).api.addToShoppingList([
        for (final i in missing) (name: i.name, quantity: i.quantity.isEmpty ? null : i.quantity),
      ]);
      if (!mounted) return;
      setState(() => _added = true);
      showToast(
        context,
        missing.length == 1
            ? 'Added 1 item to your shopping list'
            : 'Added ${missing.length} items to your shopping list',
      );
    } catch (_) {
      if (mounted) showToast(context, "Couldn't add them. Try again.", ToastTone.problem);
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final r = widget.recipe;
    final missing = r.missing;
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
        if (r.dish != r.title)
          Text(
            'From your photo: ${r.dish}',
            style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w600, color: c.inkSoft),
          ),
        Text(
          r.title,
          style: const TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800, height: 1.2),
        ),
        const SizedBox(height: Space.s1),
        Text(
          '${r.minutes} min · serves ${r.servings}',
          style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
        ),
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
            ],
          ),
        ),
        if (r.swaps.isNotEmpty) ...[
          const BlockTitle('Made for steady energy'),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: Space.s2,
              children: [
                for (final swap in r.swaps)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: Space.s2,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Icon(Icons.swap_horiz_rounded, size: 18, color: c.chlorophyll),
                      ),
                      Expanded(
                        child: Text(swap, style: const TextStyle(fontSize: TextSize.sm, height: 1.4)),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ],
        BlockTitle('Ingredients', note: missing.isEmpty ? 'All in your pantry' : '${missing.length} to buy'),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (final (n, i) in r.ingredients.indexed)
                Container(
                  constraints: const BoxConstraints(minHeight: 48),
                  padding: const EdgeInsets.symmetric(horizontal: Space.s4, vertical: Space.s2),
                  decoration: BoxDecoration(
                    border: n == 0 ? null : Border(top: BorderSide(color: c.rule)),
                  ),
                  child: Row(
                    spacing: Space.s2,
                    children: [
                      Expanded(
                        child: Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(
                                text: i.name,
                                style: const TextStyle(fontWeight: FontWeight.w700),
                              ),
                              if (i.quantity.isNotEmpty)
                                TextSpan(
                                  text: '  ${i.quantity}',
                                  style: TextStyle(color: c.inkSoft),
                                ),
                            ],
                          ),
                          style: const TextStyle(fontSize: TextSize.sm),
                        ),
                      ),
                      if (i.inPantry) Tag('In your pantry', fill: c.chlorophyllSoft, ink: c.chlorophyll),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: Space.s3),
        if (missing.isNotEmpty)
          SheetAction(
            label: _added
                ? 'Added to your shopping list'
                : (_adding ? 'Adding…' : 'Add ${missing.length} to shopping list'),
            onPressed: _added || _adding ? null : _addMissing,
          ),
        const BlockTitle('Steps'),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: Space.s3,
            children: [
              for (final (n, step) in r.steps.indexed)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: Space.s2,
                  children: [
                    Text(
                      '${n + 1}.',
                      style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800, color: c.synapseInk),
                    ),
                    Expanded(
                      child: Text(step, style: const TextStyle(fontSize: TextSize.sm, height: 1.4)),
                    ),
                  ],
                ),
              CookActions(
                title: r.title,
                ingredients: [for (final i in r.ingredients) i.quantity.isEmpty ? i.name : '${i.quantity} ${i.name}'],
                steps: r.steps,
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: Space.s2),
          child: Text(
            'Nutrition is worked out from USDA FoodData Central values where the ingredients match them '
            '(${(r.catalogShare * 100).round()}% of the calories); the rest is estimated.',
            style: TextStyle(fontSize: TextSize.xxs, height: 1.4, color: c.inkFaint),
          ),
        ),
        const SizedBox(height: Space.s4),
        Row(
          spacing: Space.s2,
          children: [
            Expanded(
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                onPressed: widget.onAgain,
                child: const Text('Another photo'),
              ),
            ),
            Expanded(
              child: FilledButton(
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                onPressed: () => widget.onLog(r),
                child: const Text('Log a serving'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
