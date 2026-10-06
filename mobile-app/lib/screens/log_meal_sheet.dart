import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/sheet.dart';
import '../widgets/ui.dart';

/// Log a meal in three steps: take or choose a photo, wait while it is read, then check the items
/// before logging. Items can also be typed in, with or without a photo. Returns true when logged.
Future<bool?> showLogMealSheet(BuildContext context, {ImagePicker? picker}) => showAppSheet<bool>(
  context,
  title: 'Log a meal',
  builder: (_) => _LogMeal(picker: picker ?? ImagePicker()),
);

MealKind kindFor(DateTime t) => switch (t.hour) {
  < 11 => MealKind.breakfast,
  < 16 => MealKind.lunch,
  < 21 => MealKind.dinner,
  _ => MealKind.snack,
};

/// The largest photo the API accepts (`MAX_MEAL_PHOTO_BYTES` in the contracts).
const maxPhotoBytes = 8 * 1024 * 1024;

typedef _Problem = ({String title, String fix, bool preview});

const _problems = <PhotoProblem, _Problem>{
  PhotoProblem.tooDark: (
    title: 'This photo is too dark',
    fix: 'Turn on a light or move nearer a window, then take it again.',
    preview: true,
  ),
  PhotoProblem.blurry: (
    title: 'This photo is blurry',
    fix: 'Hold the phone still for a second and tap to focus on the plate.',
    preview: true,
  ),
  PhotoProblem.noFoodFound: (
    title: "We couldn't find food in this photo",
    fix: 'Make sure the plate fills most of the frame, or add the items by hand.',
    preview: true,
  ),
};
const _Problem _tooBig = (
  title: 'This photo is over 8 MB',
  fix: 'Choose a smaller photo, or take a new one with the camera.',
  preview: false,
);
const _Problem _unread = (
  title: "We couldn't read this photo",
  fix: 'Check your connection and choose it again.',
  preview: false,
);

const _glText = {
  GlycemicLoad.low: 'Low glycemic load',
  GlycemicLoad.medium: 'Medium glycemic load',
  GlycemicLoad.high: 'High glycemic load',
};

/// An item in the sheet: from the photo, or typed in, and ticked or not.
class _Draft {
  _Draft(this.item, {this.manual = false});

  final FoodItem item;
  final bool manual;
  var included = true;
}

class _LogMeal extends StatefulWidget {
  const _LogMeal({required this.picker});

  final ImagePicker picker;

  @override
  State<_LogMeal> createState() => _LogMealState();
}

class _LogMealState extends State<_LogMeal> {
  final _items = <_Draft>[];
  Uint8List? _photo;
  _Problem? _problem;
  var _reading = false;
  // "Use a different photo" goes back to the first step without losing what was typed in.
  var _picking = false;
  var _byHand = false;
  var _formOpen = false;
  var _kind = kindFor(DateTime.now());
  var _saving = false;
  var _saveFailed = false;

  Future<void> _choose(ImageSource source) async {
    final file = await widget.picker.pickImage(source: source, maxWidth: 1600, imageQuality: 85);
    if (file == null || !mounted) return;
    final bytes = await file.readAsBytes();
    if (!mounted) return;
    // A new photo replaces the last photo's items; anything typed in stays.
    _items.removeWhere((draft) => !draft.manual);
    if (bytes.length > maxPhotoBytes) {
      setState(() {
        _photo = null;
        _problem = _tooBig;
      });
      return;
    }
    setState(() {
      _photo = bytes;
      _problem = null;
      _picking = false;
      _reading = true;
    });
    try {
      final result = await AppScope.of(context).api.analyzeMeal(bytes, file.name);
      if (!mounted) return;
      setState(() {
        _items.insertAll(0, [for (final item in result.items) _Draft(item)]);
        _problem = result.problem == null ? null : _problems[result.problem];
      });
    } catch (_) {
      if (mounted) setState(() => _problem = _unread);
    } finally {
      if (mounted) setState(() => _reading = false);
    }
  }

  Future<void> _save(List<FoodItem> chosen) async {
    setState(() {
      _saving = true;
      _saveFailed = false;
    });
    try {
      await AppScope.of(context).api.createMeal(NewMeal(kind: _kind, eatenAt: DateTime.now(), items: chosen));
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _saving = false;
          _saveFailed = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_reading) return _readingStep(context);
    if (!_picking && (_items.isNotEmpty || _byHand)) return _itemsStep(context);
    return _pickStep(context);
  }

  Widget _pickStep(BuildContext context) {
    final c = context.colors;
    final problem = _problem;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        if (problem != null) ...[
          if (problem.preview && _photo != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(Radii.card),
              child: Image.memory(_photo!, height: 170, fit: BoxFit.cover, semanticLabel: 'Your photo'),
            ),
          Semantics(
            liveRegion: true,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: Space.s4, vertical: 14),
              decoration: BoxDecoration(color: c.beetSoft, borderRadius: BorderRadius.circular(Radii.control)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: Space.s1,
                children: [
                  Text(
                    problem.title,
                    style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800, color: c.beet),
                  ),
                  Text(problem.fix, style: const TextStyle(fontSize: TextSize.sm)),
                ],
              ),
            ),
          ),
        ],
        Row(
          spacing: 10,
          children: [
            Expanded(
              child: _PhotoTile(
                label: problem == null ? 'Take a photo' : 'Take it again',
                icon: Icons.photo_camera_outlined,
                fill: c.synapse,
                ink: c.onAccent,
                onTap: () => _choose(ImageSource.camera),
              ),
            ),
            Expanded(
              child: _PhotoTile(
                label: 'Choose a photo',
                icon: Icons.image_outlined,
                fill: c.synapseSoft,
                ink: c.synapseInk,
                onTap: () => _choose(ImageSource.gallery),
              ),
            ),
          ],
        ),
        Text(
          'Photos up to 8 MB. Get the whole plate in, from above.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
        ),
        TextButton(
          style: TextButton.styleFrom(
            minimumSize: const Size.fromHeight(44),
            textStyle: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
          ),
          onPressed: () => setState(() {
            _picking = false;
            _byHand = true;
            _formOpen = _items.isEmpty;
          }),
          child: const Text('Add an item by hand instead'),
        ),
      ],
    );
  }

  Widget _readingStep(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(Radii.hero),
          child: SizedBox(
            height: 260,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (_photo != null) Image.memory(_photo!, fit: BoxFit.cover, semanticLabel: 'Your meal photo'),
                const ColoredBox(color: Color(0x400E1325)),
              ],
            ),
          ),
        ),
        Semantics(
          liveRegion: true,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            spacing: 10,
            children: [
              SizedBox.square(
                dimension: 18,
                child: CircularProgressIndicator(strokeWidth: 2.5, color: c.synapse, backgroundColor: c.synapseSoft),
              ),
              const Text(
                'Reading your plate…',
                style: TextStyle(fontSize: TextSize.base, fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _itemsStep(BuildContext context) {
    final c = context.colors;
    final fromPhoto = _items.where((d) => !d.manual).length;
    final chosen = [
      for (final d in _items)
        if (d.included) d.item,
    ];
    double sum(double Function(FoodItem) of) => chosen.fold(0, (total, i) => total + of(i));
    final total = sum((i) => i.calories);
    final high = chosen.where((i) => i.glycemicLoad == GlycemicLoad.high).map((i) => i.name).join(', ');
    final problem = _problem;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        if (_photo != null && fromPhoto > 0)
          ClipRRect(
            borderRadius: BorderRadius.circular(Radii.card),
            child: SizedBox(
              height: 130,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Image.memory(_photo!, fit: BoxFit.cover, semanticLabel: 'Your meal photo'),
                  Positioned(
                    right: 10,
                    bottom: 10,
                    child: Material(
                      color: const Color(0xB80E1325),
                      shape: const StadiumBorder(),
                      child: InkWell(
                        customBorder: const StadiumBorder(),
                        onTap: () => setState(() => _picking = true),
                        child: const Padding(
                          padding: EdgeInsets.symmetric(horizontal: Space.s3, vertical: 9),
                          child: Text(
                            'Use a different photo',
                            style: TextStyle(
                              fontSize: TextSize.xs,
                              fontWeight: FontWeight.w700,
                              color: NeuroCalColors.onSignal,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        if (problem != null) SheetNote(lead: '${problem.title}.', detail: problem.fix),
        if (_items.isNotEmpty) ...[
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.end,
            spacing: Space.s2,
            runSpacing: 2,
            children: [
              Text(
                fromPhoto > 0 ? 'We found $fromPhoto ${fromPhoto == 1 ? 'item' : 'items'}' : 'Your items',
                style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
              ),
              Text(
                'Untick anything we got wrong',
                style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft),
              ),
            ],
          ),
          AppCard(
            radius: 18,
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (final (i, draft) in _items.indexed)
                  _ItemRow(draft, divider: i > 0, onToggle: () => setState(() => draft.included = !draft.included)),
              ],
            ),
          ),
        ],
        if (_formOpen)
          _ManualForm(
            onAdd: (item) => setState(() {
              _items.add(_Draft(item, manual: true));
              _formOpen = false;
            }),
            onCancel: () => setState(() {
              _formOpen = false;
              // Nothing typed and no photo: back to the first step.
              if (_items.isEmpty) _byHand = false;
            }),
          )
        else
          OutlinedButton(
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(44),
              foregroundColor: c.synapseInk,
              backgroundColor: Colors.transparent,
              side: BorderSide(color: c.ruleStrong, width: 1.5),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.option)),
              textStyle: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
            ),
            onPressed: () => setState(() => _formOpen = true),
            child: const Text('+ Add an item by hand'),
          ),
        if (_items.isNotEmpty) ...[
          const Text(
            'Meal',
            style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
          ),
          Container(
            padding: const EdgeInsets.all(Space.s1),
            decoration: BoxDecoration(color: c.mist, borderRadius: BorderRadius.circular(Radii.option)),
            child: Row(
              spacing: Space.s1,
              children: [
                for (final kind in MealKind.values)
                  Expanded(
                    child: Semantics(
                      button: true,
                      selected: _kind == kind,
                      inMutuallyExclusiveGroup: true,
                      child: Material(
                        color: _kind == kind ? c.paper : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(10),
                          onTap: () => setState(() => _kind = kind),
                          child: Container(
                            height: 40,
                            alignment: Alignment.center,
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Text(
                                kind.name[0].toUpperCase() + kind.name.substring(1),
                                style: TextStyle(
                                  fontSize: TextSize.xs,
                                  fontWeight: FontWeight.w700,
                                  color: _kind == kind ? c.synapseInk : c.inkSoft,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(Space.s3),
            decoration: BoxDecoration(color: c.mist, borderRadius: BorderRadius.circular(Radii.control)),
            child: Row(
              children: [
                for (final (value, label) in [
                  (thousands(total), 'kcal'),
                  ('${sum((i) => i.macros.proteinG).round()} g', 'protein'),
                  ('${sum((i) => i.macros.carbsG).round()} g', 'carbs'),
                  ('${sum((i) => i.macros.fatG).round()} g', 'fat'),
                ])
                  Expanded(
                    child: MergeSemantics(
                      child: Column(
                        children: [
                          Text(
                            value,
                            style: const TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w800),
                          ),
                          Text(
                            label,
                            style: TextStyle(fontSize: TextSize.xxxs, fontWeight: FontWeight.w600, color: c.inkSoft),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (high.isNotEmpty)
            SheetNote(
              watch: true,
              lead: 'High glycemic load.',
              detail: '$high may bring a dip in 1 to 2 hours. A 10-minute walk after eating helps.',
            ),
          if (_saveFailed)
            const SheetNote(
              lead: "Couldn't save your meal.",
              detail: "Check your connection and try again. Nothing's been lost.",
            ),
          SheetAction(
            label: _saving
                ? 'Saving…'
                : chosen.isEmpty
                ? 'Tick at least one item'
                : _saveFailed
                ? 'Try again'
                : 'Log meal, ${thousands(total)} kcal',
            onPressed: _saving || chosen.isEmpty ? null : () => _save(chosen),
          ),
        ],
      ],
    );
  }
}

/// One of the two big photo choices.
class _PhotoTile extends StatelessWidget {
  const _PhotoTile({
    required this.label,
    required this.icon,
    required this.fill,
    required this.ink,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color fill;
  final Color ink;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: label,
    excludeSemantics: true,
    child: Material(
      color: fill,
      borderRadius: BorderRadius.circular(Radii.card),
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.card),
        onTap: onTap,
        child: SizedBox(
          height: 120,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            spacing: 10,
            children: [
              Icon(icon, size: 28, color: ink),
              Text(
                label,
                style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700, color: ink),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _ItemRow extends StatelessWidget {
  const _ItemRow(this.draft, {required this.divider, required this.onToggle});

  final _Draft draft;
  final bool divider;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final item = draft.item;
    final on = draft.included;
    final gl = item.glycemicLoad;
    return Semantics(
      checked: on,
      label: '${item.name}, ${item.portion}, ${thousands(item.calories)} kcal',
      excludeSemantics: true,
      child: InkWell(
        onTap: onToggle,
        child: Opacity(
          opacity: on ? 1 : 0.6,
          child: Container(
            constraints: const BoxConstraints(minHeight: 56),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              border: divider ? Border(top: BorderSide(color: c.rule)) : null,
            ),
            child: Row(
              spacing: Space.s3,
              children: [
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: on ? c.synapse : null,
                    borderRadius: BorderRadius.circular(7),
                    border: Border.all(color: on ? c.synapse : c.ruleStrong, width: 2),
                  ),
                  child: on ? Icon(Icons.check_rounded, size: 16, color: c.onAccent) : null,
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 2,
                    children: [
                      Wrap(
                        spacing: 6,
                        runSpacing: 2,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            item.name,
                            style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w600),
                          ),
                          if (item.confidence != null && item.confidence! < 0.85)
                            Tag('Best guess', fill: c.mist, ink: c.inkSoft),
                        ],
                      ),
                      Text.rich(
                        TextSpan(
                          text: item.portion,
                          children: [
                            if (gl != null)
                              TextSpan(
                                text: ' · ${_glText[gl]}',
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: gl == GlycemicLoad.high ? c.glucoseInk : null,
                                ),
                              ),
                          ],
                        ),
                        style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft),
                      ),
                    ],
                  ),
                ),
                Text(
                  '${thousands(item.calories)} kcal',
                  style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// For food without a photo, or what the photo missed. Macros are optional and count as 0 when left empty.
class _ManualForm extends StatefulWidget {
  const _ManualForm({required this.onAdd, required this.onCancel});

  final ValueChanged<FoodItem> onAdd;
  final VoidCallback onCancel;

  @override
  State<_ManualForm> createState() => _ManualFormState();
}

class _ManualFormState extends State<_ManualForm> {
  final _food = TextEditingController();
  final _portion = TextEditingController();
  final _kcal = TextEditingController();
  final _protein = TextEditingController();
  final _carbs = TextEditingController();
  final _fat = TextEditingController();
  var _missing = false;

  @override
  void dispose() {
    for (final field in [_food, _portion, _kcal, _protein, _carbs, _fat]) {
      field.dispose();
    }
    super.dispose();
  }

  static double _number(TextEditingController field) {
    final n = double.tryParse(field.text.trim().replaceAll(',', '.'));
    return n == null || n < 0 ? 0 : n;
  }

  void _add() {
    if (_food.text.trim().isEmpty || _number(_kcal) <= 0) {
      setState(() => _missing = true);
      return;
    }
    widget.onAdd(
      FoodItem(
        name: _food.text.trim(),
        portion: _portion.text.trim().isEmpty ? '1 portion' : _portion.text.trim(),
        calories: _number(_kcal),
        macros: Macros(proteinG: _number(_protein), carbsG: _number(_carbs), fatG: _number(_fat)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    OutlineInputBorder border(Color color) => OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: color, width: 1.5),
    );
    Widget field(
      TextEditingController controller,
      String hint, {
      bool number = false,
      bool problem = false,
      bool small = false,
    }) => TextField(
      controller: controller,
      keyboardType: number ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
      textCapitalization: number ? TextCapitalization.none : TextCapitalization.sentences,
      onChanged: (_) {
        if (_missing) setState(() => _missing = false);
      },
      style: TextStyle(fontSize: small ? TextSize.xs : TextSize.md),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: c.inkFaint, fontSize: small ? TextSize.xs : TextSize.md),
        isDense: true,
        contentPadding: EdgeInsets.symmetric(horizontal: small ? Space.s2 : Space.s3, vertical: 13),
        enabledBorder: border(problem ? c.beet : c.rule),
        focusedBorder: border(problem ? c.beet : c.synapse),
      ),
    );
    return Semantics(
      container: true,
      label: 'Add an item by hand',
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: c.mist, borderRadius: BorderRadius.circular(18)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 10,
          children: [
            const ExcludeSemantics(
              child: Text(
                'Add an item by hand',
                style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
              ),
            ),
            Row(
              spacing: Space.s2,
              children: [
                Expanded(flex: 7, child: field(_food, 'Food', problem: _missing && _food.text.trim().isEmpty)),
                Expanded(flex: 5, child: field(_portion, 'Portion')),
              ],
            ),
            Row(
              spacing: 6,
              children: [
                Expanded(child: field(_kcal, 'kcal', number: true, problem: _missing && _number(_kcal) <= 0)),
                Expanded(child: field(_protein, 'Protein', number: true, small: true)),
                Expanded(child: field(_carbs, 'Carbs', number: true, small: true)),
                Expanded(child: field(_fat, 'Fat', number: true, small: true)),
              ],
            ),
            Text(
              _missing ? 'Add a food name and its calories.' : 'Protein, carbs and fat are optional, in grams.',
              style: TextStyle(
                fontSize: TextSize.xxs,
                fontWeight: _missing ? FontWeight.w600 : FontWeight.w400,
                color: _missing ? c.beet : c.inkSoft,
              ),
            ),
            Row(
              spacing: Space.s2,
              children: [
                Expanded(
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(44),
                      textStyle: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
                    ),
                    onPressed: _add,
                    child: const Text('Add item'),
                  ),
                ),
                TextButton(
                  style: TextButton.styleFrom(
                    minimumSize: const Size(0, 44),
                    foregroundColor: c.inkSoft,
                    textStyle: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
                  ),
                  onPressed: widget.onCancel,
                  child: const Text('Cancel'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
