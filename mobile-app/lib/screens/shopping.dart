import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/product_card.dart';
import '../widgets/sheet.dart';
import '../widgets/ui.dart';
import 'log_meal_sheet.dart' show maxPhotoBytes;

/// Review a shopping list: paste or type it, or snap a photo of it (a written list, a receipt or a
/// shopping app). Each item is graded and marked keep, swap or limit; kitchen devices appear only
/// when the list shows a swap they make easy. Nothing is saved.
class ShoppingScreen extends StatefulWidget {
  const ShoppingScreen({super.key, this.picker});

  final ImagePicker? picker;

  @override
  State<ShoppingScreen> createState() => _ShoppingScreenState();
}

class _ShoppingScreenState extends State<ShoppingScreen> {
  final _text = TextEditingController();
  Future<ShoppingReview>? _review;
  late final _picker = widget.picker ?? ImagePicker();

  NeuroCalApi get _api => AppScope.of(context).api;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  void _reviewText() {
    if (_text.text.trim().isEmpty) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _review = _api.reviewShoppingList(text: _text.text);
    });
  }

  Future<void> _reviewPhoto(ImageSource source) async {
    final file = await _picker.pickImage(source: source, maxWidth: 2000, imageQuality: 85);
    if (file == null || !mounted) return;
    final bytes = await file.readAsBytes();
    if (!mounted) return;
    if (bytes.length > maxPhotoBytes) {
      setState(() {
        _review = Future.error(const _TooBig());
      });
      return;
    }
    setState(() {
      _review = _api.reviewShoppingList(photo: Uint8List.fromList(bytes));
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Review my shopping list'),
        backgroundColor: c.mist,
        surfaceTintColor: Colors.transparent,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(Space.s4, 0, Space.s4, Space.s6),
        children: [
          Text(
            'Paste or type your list, or take a photo of it. We’ll mark what to keep, what to swap for a cleaner choice, and which gadgets would make the swaps easy.',
            style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
          ),
          const SizedBox(height: Space.s3),
          TextField(
            controller: _text,
            minLines: 4,
            maxLines: 10,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              labelText: 'Your list',
              hintText: 'One item per line, e.g.\nGranola\nChicken nuggets\nSpinach',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: Space.s3),
          FilledButton.icon(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
            onPressed: _reviewText,
            icon: const Icon(Icons.fact_check_outlined, size: 20),
            label: const Text('Review my list'),
          ),
          const SizedBox(height: Space.s2),
          Row(
            spacing: Space.s2,
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                    foregroundColor: c.synapseInk,
                    side: BorderSide(color: c.ruleStrong, width: 1.5),
                  ),
                  onPressed: () => _reviewPhoto(ImageSource.camera),
                  icon: const Icon(Icons.photo_camera_outlined, size: 18),
                  label: const Text('Take a photo'),
                ),
              ),
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                    foregroundColor: c.synapseInk,
                    side: BorderSide(color: c.ruleStrong, width: 1.5),
                  ),
                  onPressed: () => _reviewPhoto(ImageSource.gallery),
                  icon: const Icon(Icons.image_outlined, size: 18),
                  label: const Text('Choose a photo'),
                ),
              ),
            ],
          ),
          if (_review != null) _Result(_review!, onRetry: _reviewText),
        ],
      ),
    );
  }
}

class _TooBig implements Exception {
  const _TooBig();
}

class _Result extends StatelessWidget {
  const _Result(this.review, {required this.onRetry});

  final Future<ShoppingReview> review;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return FutureBuilder(
      future: review,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return Padding(
            padding: const EdgeInsets.only(top: Space.s5),
            child: Column(
              spacing: Space.s3,
              children: [
                const CircularProgressIndicator(),
                Text(
                  'Reading your list…',
                  style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
                ),
              ],
            ),
          );
        }
        if (snapshot.hasError) {
          final e = snapshot.error;
          return Padding(
            padding: const EdgeInsets.only(top: Space.s4),
            child: switch (e) {
              _TooBig() => const SheetNote(
                lead: 'That photo is too large.',
                detail: 'Choose one under 8 MB, or take a new one.',
              ),
              ApiException(status: 402) => const SheetNote(
                lead: 'Part of your subscription.',
                detail: 'List reviews come with NeuroCal Pro.',
              ),
              ApiException(status: >= 500) => ScreenFailed(
                title: "Couldn't review your list",
                detail: 'The review service isn’t answering right now. Try again in a few minutes.',
                onRetry: onRetry,
              ),
              _ => ScreenFailed(
                title: "Couldn't review your list",
                detail: 'Check your connection and try again.',
                onRetry: onRetry,
              ),
            },
          );
        }
        final r = snapshot.data!;
        if (r.problem != null) {
          return Padding(
            padding: const EdgeInsets.only(top: Space.s4),
            child: SheetNote(
              lead: r.problem == 'not_a_list' ? 'That doesn’t look like a list.' : 'The photo is hard to read.',
              detail: 'Take a photo of a written list, a receipt or a shopping app, in good light.',
            ),
          );
        }
        final swaps = [
          for (final i in r.items)
            if (i.verdict == ShoppingVerdict.swap) i,
        ];
        final limits = [
          for (final i in r.items)
            if (i.verdict == ShoppingVerdict.limit) i,
        ];
        final keeps = [
          for (final i in r.items)
            if (i.verdict == ShoppingVerdict.keep) i,
        ];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            BlockTitle('Your list', note: '${r.items.length} items · ${swaps.length} to swap'),
            if (swaps.isNotEmpty) ...[
              const _Heading('Swap'),
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(children: [for (final (n, i) in swaps.indexed) _ItemRow(i, divider: n > 0)]),
              ),
            ],
            if (limits.isNotEmpty) ...[
              const _Heading('Now and then'),
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(children: [for (final (n, i) in limits.indexed) _ItemRow(i, divider: n > 0)]),
              ),
            ],
            if (keeps.isNotEmpty) ...[
              const _Heading('Keep'),
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(children: [for (final (n, i) in keeps.indexed) _ItemRow(i, divider: n > 0)]),
              ),
            ],
            if (r.devices.isNotEmpty) ...[
              const BlockTitle('Gadgets that make the swaps easy'),
              for (final d in r.devices)
                Padding(
                  padding: const EdgeInsets.only(bottom: Space.s3),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    spacing: Space.s1,
                    children: [
                      Text(
                        'For ${d.because.join(', ')}',
                        style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: c.inkSoft),
                      ),
                      ProductCard(d.product),
                    ],
                  ),
                ),
            ],
            Padding(
              padding: const EdgeInsets.only(top: Space.s2),
              child: Text(
                'Grades are judged from the item names; brands vary, so check the label when it matters.',
                style: TextStyle(fontSize: TextSize.xxs, height: 1.4, color: c.inkFaint),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(Space.s1, Space.s3, Space.s1, Space.s2),
    child: Text(
      text,
      style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800, color: context.colors.inkSoft),
    ),
  );
}

class _ItemRow extends StatelessWidget {
  const _ItemRow(this.item, {required this.divider});

  final ({String name, FoodProcessing processing, ShoppingVerdict verdict, String reason, String? swapFor}) item;
  final bool divider;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final (fill, ink) = switch (item.processing) {
      FoodProcessing.whole => (c.chlorophyllSoft, c.chlorophyll),
      FoodProcessing.processed => (c.glucoseSoft, c.glucoseInk),
      FoodProcessing.ultraProcessed => (c.beetSoft, c.beet),
    };
    return MergeSemantics(
      child: Container(
        padding: const EdgeInsets.all(Space.s4),
        decoration: BoxDecoration(
          border: divider ? Border(top: BorderSide(color: c.rule)) : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: Space.s1,
          children: [
            Row(
              spacing: Space.s2,
              children: [
                Expanded(
                  child: Text(
                    item.name,
                    style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
                  ),
                ),
                Tag(item.processing.label, fill: fill, ink: ink),
              ],
            ),
            Text(
              item.reason,
              style: TextStyle(fontSize: TextSize.xs, height: 1.35, color: c.inkSoft),
            ),
            if (item.swapFor != null)
              Row(
                spacing: 6,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.swap_horiz_rounded, size: 18, color: c.chlorophyll),
                  Expanded(
                    child: Text(
                      item.swapFor!,
                      style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.chlorophyll),
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
