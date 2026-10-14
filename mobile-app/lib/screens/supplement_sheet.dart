import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../scan/label_camera.dart';
import '../theme/tokens.dart';
import '../widgets/product_card.dart';
import '../widgets/sheet.dart';
import '../widgets/ui.dart';
import 'live_scan.dart';
import 'log_meal_sheet.dart' show maxPhotoBytes;

/// Scan a supplement label: live scan while turning the bottle (or choose a photo), wait while it is
/// read, then see what the label says and anything worth knowing. Nothing is saved.
/// Returns true when the supplement was added to the stack.
Future<bool?> showSupplementSheet(BuildContext context, {ImagePicker? picker, LabelCamera Function()? camera}) =>
    showAppSheet<bool>(
      context,
      title: 'Scan a supplement',
      builder: (_) => _ScanSupplement(picker: picker ?? ImagePicker(), camera: camera ?? DeviceLabelCamera.new),
    );

/// A short lead for each flag; the API's message is the detail.
const _leads = <String, String>{
  'proprietary_blend': 'Hidden doses.',
  'above_upper_limit': 'High dose.',
  'no_third_party_testing': 'Not independently tested.',
  'expired': 'Expired.',
  'expires_soon': 'Expires soon.',
  'doses_missing': 'Doses missing.',
};

/// Red rather than amber: act on these before taking it.
const _serious = {'above_upper_limit', 'expired'};

class _ScanSupplement extends StatefulWidget {
  const _ScanSupplement({required this.picker, required this.camera});

  final ImagePicker picker;
  final LabelCamera Function() camera;

  @override
  State<_ScanSupplement> createState() => _ScanSupplementState();
}

class _ScanSupplementState extends State<_ScanSupplement> {
  List<Uint8List> _photos = const [];
  SupplementLabel? _label;
  String? _failure;
  var _reading = false;
  var _adding = false;

  Future<void> _liveScan() async {
    final result = await showLiveScan(context, widget.camera());
    if (result == null || result.photos.isEmpty || !mounted) return;
    await _read(result.photos, const []);
  }

  Future<void> _choose() async {
    final file = await widget.picker.pickImage(source: ImageSource.gallery, maxWidth: 2000, imageQuality: 90);
    if (file == null || !mounted) return;
    final bytes = await file.readAsBytes();
    if (!mounted) return;
    if (bytes.length > maxPhotoBytes) {
      setState(() => _failure = 'This photo is over 8 MB. Choose a smaller one, or use live scan.');
      return;
    }
    await _read([bytes], [file.name]);
  }

  Future<void> _read(List<Uint8List> photos, List<String> names) async {
    setState(() {
      _photos = photos;
      _label = null;
      _failure = null;
      _reading = true;
    });
    try {
      final label = await AppScope.of(context).api.analyzeSupplement(photos, names: names);
      if (mounted) setState(() => _label = label);
    } catch (_) {
      if (mounted) setState(() => _failure = "We couldn't read this label. Check your connection and try again.");
    } finally {
      if (mounted) setState(() => _reading = false);
    }
  }

  void _again() => setState(() {
    _adding = false;
    _photos = const [];
    _label = null;
    _failure = null;
  });

  @override
  Widget build(BuildContext context) {
    if (_reading) return _readingStep(context);
    if (_adding && _label != null) return _AddToStack(label: _label!, onBack: () => setState(() => _adding = false));
    final label = _label;
    if (label != null && label.problem == null) return _resultStep(context, label);
    return _pickStep(context, problem: label?.summary ?? _failure);
  }

  Widget _pickStep(BuildContext context, {String? problem}) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        if (problem != null) SheetNote(lead: "Couldn't read the label.", detail: problem),
        Text(
          "Point the camera at the facts panel and turn the bottle slowly. We'll keep a photo of each side as it comes into view.",
          style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
        ),
        FilledButton.icon(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56)),
          onPressed: _liveScan,
          icon: const Icon(Icons.document_scanner_outlined, size: 20),
          label: Text(problem == null ? 'Start live scan' : 'Scan again'),
        ),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
            foregroundColor: c.synapseInk,
            side: BorderSide(color: c.ruleStrong, width: 1.5),
          ),
          onPressed: _choose,
          icon: const Icon(Icons.image_outlined, size: 20),
          label: const Text('Choose a photo'),
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
        if (_photos.isNotEmpty)
          SizedBox(
            height: 180,
            child: Row(
              spacing: Space.s2,
              children: [
                for (final (i, photo) in _photos.indexed)
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(Radii.option),
                      child: Image.memory(photo, fit: BoxFit.cover, height: 180, semanticLabel: 'Label photo ${i + 1}'),
                    ),
                  ),
              ],
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
                'Reading the label…',
                style: TextStyle(fontSize: TextSize.base, fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _resultStep(BuildContext context, SupplementLabel label) {
    final c = context.colors;
    final name = [label.brand, label.productName].whereType<String>().join(' ');
    String dose(SupplementIngredient i) {
      if (i.inBlend) return 'In the blend';
      if (i.amount == null) return 'No dose shown';
      final amount = i.amount! == i.amount!.roundToDouble() ? i.amount!.toInt().toString() : i.amount!.toString();
      return [amount, i.unit].whereType<String>().join(' ');
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: Space.s1,
          children: [
            Text(
              name.isEmpty ? 'This supplement' : name,
              style: const TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w800),
            ),
            Text(label.summary, style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft)),
          ],
        ),
        for (final flag in label.flags)
          SheetNote(lead: _leads[flag.kind] ?? 'Worth knowing.', detail: flag.message, watch: !_serious.contains(flag.kind)),
        const GroupLabel('What the label says', top: 4),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (final (i, ingredient) in label.ingredients.indexed)
                Container(
                  padding: EdgeInsets.fromLTRB(ingredient.inBlend ? Space.s6 : Space.s4, 12, Space.s4, 12),
                  decoration: BoxDecoration(
                    border: i == 0 ? null : Border(top: BorderSide(color: c.rule)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: Space.s3,
                    children: [
                      Expanded(
                        child: Text(ingredient.name, style: const TextStyle(fontSize: TextSize.sm, height: 1.35)),
                      ),
                      Text(
                        dose(ingredient),
                        style: TextStyle(
                          fontSize: TextSize.sm,
                          fontWeight: FontWeight.w700,
                          color: ingredient.amount == null ? c.inkSoft : c.ink,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final mark in label.testing)
              Tag('Tested: ${testingLabels[mark] ?? 'Third-party tested'}', fill: c.mist, ink: c.chlorophyll),
            if (label.servingSize != null) Tag('Serving: ${label.servingSize}', fill: c.mist, ink: c.inkSoft),
            if (label.lotNumber != null) Tag('Lot ${label.lotNumber}', fill: c.mist, ink: c.inkSoft),
          ],
        ),
        Text(
          "This reads the label only. A photo can't show what's actually in the bottle, so it isn't a verdict on the product.",
          style: TextStyle(fontSize: TextSize.xxs, height: 1.5, color: c.inkSoft),
        ),
        if (label.alternative != null) ...[
          const GroupLabel('A close match from our brand', top: 4),
          ProductCard(label.alternative!),
          Text(
            '"Our brand" products are sold by MitoProof, which is run by the people who make NeuroCal.',
            style: TextStyle(fontSize: TextSize.xxs, height: 1.5, color: c.inkSoft),
          ),
        ],
        SheetAction(label: 'Add to my stack', onPressed: () => setState(() => _adding = true)),
        TextButton(onPressed: _again, child: const Text('Scan another label')),
      ],
    );
  }
}

/// Saves the scanned supplement to the stack: how many servings a day, when, and the bottle size
/// (from the label when it was printed), for the running-low count.
class _AddToStack extends StatefulWidget {
  const _AddToStack({required this.label, required this.onBack});

  final SupplementLabel label;
  final VoidCallback onBack;

  @override
  State<_AddToStack> createState() => _AddToStackState();
}

class _AddToStackState extends State<_AddToStack> {
  var _perDay = 1;
  var _timing = StackTiming.morning;
  late final _bottle = TextEditingController(text: widget.label.servingsPerContainer?.toString() ?? '');
  var _busy = false;
  var _failed = false;

  @override
  void dispose() {
    _bottle.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _failed = false;
    });
    final l = widget.label;
    final name = [l.brand, l.productName].whereType<String>().join(' ');
    try {
      await AppScope.of(context).api.addToStack(
        name: name.isEmpty ? 'Supplement' : name,
        servingSize: l.servingSize,
        ingredients: l.ingredients,
        servingsPerDay: _perDay,
        timing: _timing,
        servingsPerContainer: int.tryParse(_bottle.text.trim()),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _failed = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final serving = widget.label.servingSize;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        Text(
          'We’ll add it to your checklist on Today and check it against everything else you take.',
          style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
        ),
        Text(serving == null ? 'Servings a day' : 'Servings a day (one is $serving)', style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700)),
        Row(
          spacing: Space.s2,
          children: [for (final n in [1, 2, 3]) ChoicePill(label: '$n', selected: _perDay == n, onTap: () => setState(() => _perDay = n))],
        ),
        const Text('When do you take it?', style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700)),
        Wrap(
          spacing: Space.s2,
          runSpacing: Space.s2,
          children: [
            for (final t in StackTiming.values) ChoicePill(label: t.label, selected: _timing == t, onTap: () => setState(() => _timing = t)),
          ],
        ),
        TextField(
          controller: _bottle,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Servings in the bottle (optional)', helperText: 'So we can tell you when it’s running low.'),
        ),
        if (_failed) const SheetNote(lead: "Couldn't add it.", detail: 'Check your connection and try again.'),
        SheetAction(label: _busy ? 'Adding…' : 'Add to my stack', onPressed: _busy ? null : _save),
        TextButton(onPressed: _busy ? null : widget.onBack, child: const Text('Back to the label')),
      ],
    );
  }
}
