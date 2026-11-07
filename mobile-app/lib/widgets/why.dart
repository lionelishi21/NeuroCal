import 'package:flutter/material.dart';

import '../api/api.dart' show ApiException;
import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import 'sheet.dart';

/// The likely reasons under a result (worked out by rules, free), and a "Why?" that asks for a fuller
/// explanation.
class WhyBlock extends StatelessWidget {
  const WhyBlock(this.why, {super.key, required this.topic, required this.title, required this.unit, this.date});

  final WhyReasons why;
  final WhyTopic topic;

  /// The explanation sheet's title, e.g. "Why your weight changed".
  final String title;
  final String unit;
  final String? date;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: Space.s1,
      children: [
        Text(
          why.headline,
          style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
        ),
        for (final r in why.reasons)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: Space.s2,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Container(
                  width: 5,
                  height: 5,
                  decoration: BoxDecoration(color: c.inkSoft, shape: BoxShape.circle),
                ),
              ),
              Expanded(
                child: Text(
                  r,
                  style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
                ),
              ),
            ],
          ),
        WhyButton(topic: topic, title: title, unit: unit, date: date),
      ],
    );
  }
}

/// "Why?": opens a sheet with a fuller explanation of [topic].
class WhyButton extends StatelessWidget {
  const WhyButton({super.key, required this.topic, required this.title, required this.unit, this.date});

  final WhyTopic topic;
  final String title;
  final String unit;
  final String? date;

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: TextButton.icon(
      style: TextButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: Space.s2),
        minimumSize: const Size(0, 40),
      ),
      onPressed: () => showAppSheet<void>(
        context,
        title: title,
        builder: (_) => _Explanation(topic: topic, unit: unit, date: date),
      ),
      icon: const Icon(Icons.help_outline_rounded, size: 18),
      label: const Text('Why?'),
    ),
  );
}

class _Explanation extends StatefulWidget {
  const _Explanation({required this.topic, required this.unit, this.date});

  final WhyTopic topic;
  final String unit;
  final String? date;

  @override
  State<_Explanation> createState() => _ExplanationState();
}

class _ExplanationState extends State<_Explanation> {
  Future<String>? _text;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _text ??= _load();
  }

  Future<String> _load() => AppScope.of(context).api.explainWhy(widget.topic, date: widget.date, unit: widget.unit);

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return FutureBuilder<String>(
      future: _text,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Padding(
            padding: EdgeInsets.all(Space.s5),
            child: Center(child: CircularProgressIndicator()),
          );
        }
        if (snap.hasError) {
          final e = snap.error;
          final detail = e is ApiException
              ? switch (e.status) {
                  402 => 'Explanations are part of your subscription. The reasons under each result are free.',
                  429 || 502 || 503 => e.message,
                  _ => "Couldn't explain this right now. Try again in a moment.",
                }
              : "Couldn't explain this. Check your connection and try again.";
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: Space.s2,
            children: [
              SheetNote(lead: "Couldn't explain it.", detail: detail),
              TextButton(onPressed: () => setState(() => _text = _load()), child: const Text('Try again')),
            ],
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: Space.s3,
          children: [
            Semantics(
              liveRegion: true,
              child: Text(snap.data!, style: const TextStyle(fontSize: TextSize.md, height: 1.5)),
            ),
            Text(
              'Not medical advice. For anything that worries you, talk to your doctor.',
              style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft),
            ),
          ],
        );
      },
    );
  }
}
