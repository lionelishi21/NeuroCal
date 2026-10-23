import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../scan/label_camera.dart';
import '../theme/tokens.dart';
import '../widgets/product_card.dart';
import '../widgets/sheet.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';
import 'live_scan.dart';
import 'log_meal_sheet.dart' show maxPhotoBytes;
import 'pantry.dart' show RecipeCard;

/// Scan a packaged food: the barcode first (a product database lookup), else the label (the AI reads
/// it). Shows how processed it is and what's worth knowing, and for a processed food, a better choice:
/// a cleaner one to buy and a homemade one from the pantry. Returns one serving to log, or null.
Future<FoodItem?> showFoodScanSheet(BuildContext context, {ImagePicker? picker, LabelCamera Function()? camera}) => showAppSheet<FoodItem>(
  context,
  title: 'Scan a food package',
  builder: (_) => _FoodScan(picker: picker ?? ImagePicker(), camera: camera ?? DeviceLabelCamera.new),
);

const _flagLeads = <String, String>{
  'ultra_processed': 'Ultra-processed.',
  'high_added_sugar': 'High in added sugar.',
  'high_sodium': 'High in salt.',
  'expired': 'Past its date.',
  'expires_soon': 'Eat soon.',
};

class _FoodScan extends StatefulWidget {
  const _FoodScan({required this.picker, required this.camera});

  final ImagePicker picker;
  final LabelCamera Function() camera;

  @override
  State<_FoodScan> createState() => _FoodScanState();
}

class _FoodScanState extends State<_FoodScan> {
  FoodScan? _scan;
  String? _problem;
  var _reading = false;

  /// The last barcode wasn't in the database: the next scan looks at the label only.
  var _labelOnly = false;

  /// Null until asked for; then loading, the better choice, or why there isn't one.
  Future<BetterChoice>? _better;

  Future<void> _liveScan() async {
    final result = await showLiveScan(context, widget.camera(), findBarcode: !_labelOnly);
    if (result == null || !mounted) return;
    if (result.barcode != null) {
      await _run(() => AppScope.of(context).api.scanBarcode(result.barcode!));
    } else if (result.photos.isNotEmpty) {
      await _run(() => AppScope.of(context).api.scanFoodLabel(result.photos));
    }
  }

  Future<void> _addToPantry(String name) async {
    try {
      await AppScope.of(context).api.addToPantry([name.length > 60 ? name.substring(0, 60) : name]);
      if (mounted) showToast(context, 'Added to your pantry');
    } catch (_) {
      if (mounted) showToast(context, "Couldn't add it to your pantry. Try again.", ToastTone.problem);
    }
  }

  void _findBetter(FoodScan scan) {
    final better = AppScope.of(context).api.betterChoice(scan);
    setState(() {
      _better = better;
    });
  }

  Future<void> _choose() async {
    final file = await widget.picker.pickImage(source: ImageSource.gallery, maxWidth: 2000, imageQuality: 90);
    if (file == null || !mounted) return;
    final bytes = await file.readAsBytes();
    if (!mounted) return;
    if (bytes.length > maxPhotoBytes) {
      setState(() => _problem = 'This photo is over 8 MB. Choose a smaller one, or use live scan.');
      return;
    }
    await _run(() => AppScope.of(context).api.scanFoodLabel([Uint8List.fromList(bytes)]));
  }

  Future<void> _run(Future<FoodScan> Function() scan) async {
    setState(() {
      _reading = true;
      _problem = null;
      _scan = null;
      _better = null;
    });
    try {
      final result = await scan();
      if (!mounted) return;
      setState(() {
        if (result.problem != null) {
          _problem = switch (result.problem) {
            'not_a_label' => "That doesn't look like a food label. Point the camera at the nutrition panel or the ingredients.",
            'blurry' => 'The label is too blurry to read. Hold the phone steady and try again.',
            'too_dark' => 'The label is too dark to read. Try again in better light.',
            _ => 'Part of the label is cut off. Fit the whole panel in the frame.',
          };
        } else {
          _scan = result;
        }
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        if (e.status == 404) {
          _labelOnly = true;
          _problem = "We don't know that barcode yet. Scan the label instead: the nutrition panel and the ingredients.";
        } else {
          _problem = e.message;
        }
      });
    } catch (_) {
      if (mounted) setState(() => _problem = "We couldn't read this. Check your connection and try again.");
    } finally {
      if (mounted) setState(() => _reading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_reading) {
      return const Padding(padding: EdgeInsets.symmetric(vertical: Space.s6), child: Center(child: CircularProgressIndicator()));
    }
    final scan = _scan;
    return scan == null ? _pickStep(context) : _resultStep(context, scan);
  }

  Widget _pickStep(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        if (_problem != null) SheetNote(lead: _labelOnly ? 'Barcode not found.' : "Couldn't read it.", detail: _problem!, watch: _labelOnly),
        Text(
          _labelOnly
              ? 'Point the camera at the nutrition panel, then turn the package to the ingredients.'
              : 'Point the camera at the barcode. If we don’t know the product, scan the nutrition panel and ingredients instead.',
          style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
        ),
        FilledButton.icon(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56)),
          onPressed: _liveScan,
          icon: Icon(_labelOnly ? Icons.document_scanner_outlined : Icons.qr_code_scanner_rounded, size: 20),
          label: Text(_labelOnly ? 'Scan the label' : 'Start scanning'),
        ),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(52), foregroundColor: c.synapseInk, side: BorderSide(color: c.ruleStrong, width: 1.5)),
          onPressed: _choose,
          icon: const Icon(Icons.image_outlined, size: 20),
          label: const Text('Choose a photo of the label'),
        ),
      ],
    );
  }

  Widget _resultStep(BuildContext context, FoodScan scan) {
    final c = context.colors;
    final (badgeFill, badgeInk) = switch (scan.processing) {
      FoodProcessing.whole => (c.chlorophyll, c.onAccent),
      FoodProcessing.processed => (c.glucoseSoft, c.glucoseInk),
      FoodProcessing.ultraProcessed => (c.beetSoft, c.beet),
    };
    String g(double? v) => v == null ? '–' : (v == v.roundToDouble() ? '${v.toInt()}' : v.toStringAsFixed(1));
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
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: Space.s2,
          children: [
            Text(scan.name, style: const TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w800)),
            if (scan.manufacturer != null) Text('Made by ${scan.manufacturer}', style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft)),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                Tag(scan.processing.label, fill: badgeFill, ink: badgeInk),
                if (scan.servingSize != null) Tag('Per ${scan.servingSize}', fill: c.mist, ink: c.inkSoft),
                if (scan.producedOn != null) Tag('Made on ${scan.producedOn}', fill: c.mist, ink: c.inkSoft),
                if (scan.bestBefore != null) Tag('Best before ${scan.bestBefore}', fill: c.mist, ink: c.inkSoft),
                if (scan.lotNumber != null) Tag('Lot ${scan.lotNumber}', fill: c.mist, ink: c.inkSoft),
              ],
            ),
          ],
        ),
        if (scan.calories != null)
          AppCard(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Row(
              children: [
                stat(g(scan.calories), 'kcal'),
                stat('${g(scan.proteinG)} g', 'protein'),
                stat('${g(scan.carbsG)} g', 'carbs'),
                stat('${g(scan.fatG)} g', 'fat'),
              ],
            ),
          ),
        for (final f in scan.flags)
          SheetNote(lead: _flagLeads[f.kind] ?? 'Worth knowing.', detail: f.message, watch: f.kind != 'expired'),
        if (scan.coffee case final coffee?)
          coffee.moldTested
              ? Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: Space.s2,
                  children: [
                    Icon(Icons.verified_rounded, size: 20, color: c.chlorophyll),
                    Expanded(child: Text('Mould-tested. ${coffee.detail}', style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.chlorophyll))),
                  ],
                )
              : SheetNote(lead: 'Mould testing not stated.', detail: coffee.detail, watch: true),
        if (scan.processing == FoodProcessing.whole && scan.flags.isEmpty)
          Text('A whole food: nothing industrial in the ingredients.', style: TextStyle(fontSize: TextSize.sm, color: c.chlorophyll)),
        if (scan.processing != FoodProcessing.whole && scan.ingredients.isNotEmpty)
          _better == null
              ? OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48), foregroundColor: c.synapseInk, side: BorderSide(color: c.ruleStrong, width: 1.5)),
                  onPressed: () => _findBetter(scan),
                  icon: const Icon(Icons.swap_horiz_rounded, size: 20),
                  label: const Text('Find a better choice'),
                )
              : _BetterChoice(
                  _better!,
                  onRetry: () => _findBetter(scan),
                  onCook: (recipe) async => Navigator.of(context).pop(recipe.toItem()),
                ),
        if (scan.ingredients.isNotEmpty) ...[
          const GroupLabel('Ingredients', top: 4),
          Text(scan.ingredients.join(', '), style: TextStyle(fontSize: TextSize.xs, height: 1.5, color: c.inkSoft)),
        ],
        Text(
          [
            if (scan.fromDatabase) 'Product data from Open Food Facts (openfoodfacts.org), under the Open Database License.',
            'The glycemic load is an estimate: labels don’t print it.',
          ].join(' '),
          style: TextStyle(fontSize: TextSize.xxs, height: 1.5, color: c.inkSoft),
        ),
        if (scan.item != null) SheetAction(label: 'Log it', onPressed: () => Navigator.of(context).pop(scan.item)),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48), foregroundColor: c.synapseInk, side: BorderSide(color: c.ruleStrong, width: 1.5)),
          onPressed: () => _addToPantry(scan.name),
          icon: const Icon(Icons.kitchen_rounded, size: 18),
          label: const Text('Add to pantry'),
        ),
        TextButton(
          onPressed: () => setState(() {
            _scan = null;
            _problem = null;
            _labelOnly = false;
            _better = null;
          }),
          child: const Text('Scan another'),
        ),
      ],
    );
  }
}

/// What to buy instead, the same food made at home, and a kitchen device when the recipe uses one.
class _BetterChoice extends StatelessWidget {
  const _BetterChoice(this.choice, {required this.onRetry, required this.onCook});

  final Future<BetterChoice> choice;
  final VoidCallback onRetry;
  final Future<void> Function(PantryRecipe) onCook;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return FutureBuilder(
      future: choice,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: Space.s3),
            child: Column(
              spacing: Space.s3,
              children: [
                const CircularProgressIndicator(),
                Text('Finding a better choice…', style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft)),
              ],
            ),
          );
        }
        if (snapshot.hasError) {
          return ScreenFailed(
            title: "Couldn't find a better choice",
            detail: switch (snapshot.error) {
              ApiException(status: 402) => 'Better choices are part of your subscription.',
              ApiException(status: 429, :final message) => message,
              // The server answered but the recipe service didn't: not the phone's connection.
              ApiException(status: >= 500) => 'Better choices aren’t available right now. Try again in a few minutes.',
              _ => 'Check your connection and try again.',
            },
            onRetry: onRetry,
          );
        }
        final b = snapshot.data!;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: Space.s2,
          children: [
            const BlockTitle('A better choice'),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: Space.s1,
                children: [
                  const Text('To buy instead', style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800)),
                  Text(b.lookFor, style: const TextStyle(fontSize: TextSize.sm, height: 1.4)),
                ],
              ),
            ),
            if (b.homemade != null) ...[
              const GroupLabel('Or make it at home', top: Space.s2),
              RecipeCard(b.homemade!, onCook: onCook),
            ],
            if (b.device != null) ...[
              const GroupLabel('Makes the homemade one easy', top: Space.s2),
              ProductCard(b.device!),
            ],
          ],
        );
      },
    );
  }
}
