import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';

/// Log a meal: take or choose a photo, check what NeuroCal found (or add items by hand), then save.
/// Returns true when a meal was logged.
Future<bool?> showLogMealSheet(BuildContext context, {ImagePicker? picker}) => showModalBottomSheet<bool>(
  context: context,
  isScrollControlled: true,
  builder: (_) => _LogMealSheet(picker: picker ?? ImagePicker()),
);

MealKind kindFor(DateTime t) => switch (t.hour) {
  < 11 => MealKind.breakfast,
  < 16 => MealKind.lunch,
  < 21 => MealKind.dinner,
  _ => MealKind.snack,
};

const _problems = {
  PhotoProblem.tooDark: "That photo is too dark to read. Try again in better light, or add items by hand.",
  PhotoProblem.blurry: "That photo is blurry. Hold still and try again, or add items by hand.",
  PhotoProblem.noFoodFound: "We couldn't find food in that photo. Try again, or add items by hand.",
};

class _LogMealSheet extends StatefulWidget {
  const _LogMealSheet({required this.picker});

  final ImagePicker picker;

  @override
  State<_LogMealSheet> createState() => _LogMealSheetState();
}

class _LogMealSheetState extends State<_LogMealSheet> {
  final _items = <FoodItem>[];
  var _kind = kindFor(DateTime.now());
  var _analyzing = false;
  var _saving = false;
  String? _message;
  final _name = TextEditingController();
  final _calories = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    _calories.dispose();
    super.dispose();
  }

  Future<void> _photo(ImageSource source) async {
    final file = await widget.picker.pickImage(source: source, maxWidth: 1600, imageQuality: 85);
    if (file == null || !mounted) return;
    setState(() {
      _analyzing = true;
      _message = null;
    });
    try {
      final result = await AppScope.of(context).api.analyzeMeal(await file.readAsBytes(), file.name);
      setState(() {
        _items.addAll(result.items);
        _message = result.problem == null ? null : _problems[result.problem];
      });
    } catch (_) {
      setState(() => _message = "We couldn't read that photo. Try again, or add items by hand.");
    } finally {
      if (mounted) setState(() => _analyzing = false);
    }
  }

  void _addByHand() {
    final calories = double.tryParse(_calories.text.trim());
    if (_name.text.trim().isEmpty || calories == null) {
      setState(() => _message = 'Add a name and the calories for the item.');
      return;
    }
    setState(() {
      _items.add(
        FoodItem(
          name: _name.text.trim(),
          portion: '1 serving',
          calories: calories,
          macros: const Macros(proteinG: 0, carbsG: 0, fatG: 0),
        ),
      );
      _name.clear();
      _calories.clear();
      _message = null;
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await AppScope.of(context).api.createMeal(NewMeal(kind: _kind, eatenAt: DateTime.now(), items: List.of(_items)));
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      setState(() {
        _saving = false;
        _message = "Couldn't log the meal. Check your connection and try again.";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final total = _items.fold<double>(0, (s, i) => s + i.calories).round();
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(Space.s4, 0, Space.s4, Space.s4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Log a meal', style: text.headlineSmall),
              const SizedBox(height: Space.s4),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _analyzing ? null : () => _photo(ImageSource.camera),
                      icon: const Icon(Icons.photo_camera_outlined),
                      label: const Text('Take photo'),
                    ),
                  ),
                  const SizedBox(width: Space.s2),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _analyzing ? null : () => _photo(ImageSource.gallery),
                      icon: const Icon(Icons.photo_library_outlined),
                      label: const Text('Choose photo'),
                    ),
                  ),
                ],
              ),
              if (_analyzing)
                Padding(
                  padding: const EdgeInsets.only(top: Space.s4),
                  child: Row(
                    children: [
                      const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                      const SizedBox(width: Space.s3),
                      Text('Reading your photo…', style: text.bodyMedium?.copyWith(color: c.inkSoft)),
                    ],
                  ),
                ),
              if (_message != null)
                Padding(
                  padding: const EdgeInsets.only(top: Space.s3),
                  child: Semantics(
                    liveRegion: true,
                    child: Text(_message!, style: TextStyle(color: c.beet)),
                  ),
                ),
              const SizedBox(height: Space.s5),
              Text('Add items by hand', style: text.labelLarge),
              const SizedBox(height: Space.s2),
              Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: TextField(
                      controller: _name,
                      decoration: const InputDecoration(labelText: 'Item'),
                    ),
                  ),
                  const SizedBox(width: Space.s2),
                  Expanded(
                    flex: 2,
                    child: TextField(
                      controller: _calories,
                      decoration: const InputDecoration(labelText: 'kcal'),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      onSubmitted: (_) => _addByHand(),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Add item',
                    onPressed: _addByHand,
                    icon: Icon(Icons.add_circle_outline, color: c.synapse),
                  ),
                ],
              ),
              if (_items.isNotEmpty) ...[
                const SizedBox(height: Space.s5),
                Text('In this meal', style: text.labelLarge),
                for (final (index, item) in _items.indexed)
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: Space.s2),
                    decoration: BoxDecoration(
                      border: Border(bottom: BorderSide(color: c.rule)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(item.name, style: text.bodyLarge),
                              Text(
                                item.glycemicLoad == GlycemicLoad.high
                                    ? '${item.portion} · High glycemic load'
                                    : item.portion,
                                style: text.bodyMedium?.copyWith(
                                  color: item.glycemicLoad == GlycemicLoad.high ? c.glucoseInk : c.inkSoft,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text('${item.calories.round()} kcal'),
                        IconButton(
                          tooltip: 'Remove ${item.name}',
                          icon: Icon(Icons.close_rounded, color: c.inkSoft, size: 20),
                          onPressed: () => setState(() => _items.removeAt(index)),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: Space.s4),
                Wrap(
                  spacing: Space.s2,
                  children: [
                    for (final kind in MealKind.values)
                      ChoiceChip(
                        label: Text(kind.name[0].toUpperCase() + kind.name.substring(1)),
                        selected: _kind == kind,
                        showCheckmark: false,
                        labelStyle: TextStyle(color: _kind == kind ? c.onAccent : c.ink, fontWeight: FontWeight.w600),
                        onSelected: (_) => setState(() => _kind = kind),
                      ),
                  ],
                ),
                const SizedBox(height: Space.s5),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: Text(_saving ? 'Logging…' : 'Log meal · $total kcal'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
