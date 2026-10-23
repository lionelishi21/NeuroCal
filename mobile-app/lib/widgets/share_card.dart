import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../app_scope.dart';
import '../theme/tokens.dart';
import 'focus_ring.dart';
import 'logo.dart';
import 'sheet.dart';
import 'toast.dart';

/// "Share my score": a story-sized card (1080 × 1920) with today's Focus Score and streak, previewed in a
/// sheet and handed to the phone's share sheet as an image.
Future<void> showShareScore(BuildContext context, {required int score, required String word, int streakDays = 0}) =>
    _showShare(
      context,
      title: 'Share your score',
      event: 'score_shared',
      text:
          'My Focus Score today: $score. I track how food, sleep and stress shape my focus with NeuroCal. neurocal.ai',
      card: ScoreCard(score: score, word: word, streakDays: streakDays),
    );

/// "Share my progress": how much weight is down and since when, never the weight itself.
Future<void> showShareWeight(BuildContext context, {required String lost, required String since, String? toGo}) =>
    _showShare(
      context,
      title: 'Share your progress',
      event: 'weight_shared',
      text: '$lost down since $since, eating for focus with NeuroCal. neurocal.ai',
      card: WeightProgressCard(lost: lost, since: since, toGo: toGo),
    );

/// A level reached on the biohacking ladder (docs/NCBM.md §8).
Future<void> showShareLevel(
  BuildContext context, {
  required int level,
  required String name,
  bool justReached = false,
}) => _showShare(
  context,
  title: justReached ? 'You reached $name' : 'Share your level',
  event: 'level_shared',
  text: "I'm level $level of 5 on NeuroCal: $name. Earned with habits, not bought. neurocal.ai",
  card: LevelCard(level: level, name: name),
);

Future<void> _showShare(
  BuildContext context, {
  required String title,
  required String event,
  required String text,
  required Widget card,
}) => showAppSheet<void>(
  context,
  title: title,
  builder: (_) => _Share(card: card, text: text, event: event),
);

class _Share extends StatefulWidget {
  const _Share({required this.card, required this.text, required this.event});

  final Widget card;
  final String text;
  final String event;

  @override
  State<_Share> createState() => _ShareState();
}

class _ShareState extends State<_Share> {
  final _card = GlobalKey();
  var _busy = false;

  /// The card's size on screen; the image is drawn at four times this (1080 × 1920).
  static const _size = Size(270, 480);

  Future<void> _share() async {
    setState(() => _busy = true);
    try {
      final boundary = _card.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 1080 / _size.width);
      final png = (await image.toByteData(format: ui.ImageByteFormat.png))!.buffer.asUint8List();
      if (!mounted) return;
      final scope = AppScope.of(context);
      scope.analytics.track(widget.event);
      await scope.shareImage(png, widget.text);
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      if (mounted) showToast(context, "Couldn't share that. Try again.", ToastTone.problem);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    spacing: Space.s4,
    children: [
      Center(
        child: RepaintBoundary(
          key: _card,
          child: SizedBox.fromSize(size: _size, child: widget.card),
        ),
      ),
      SheetAction(label: _busy ? 'Getting it ready…' : 'Share', onPressed: _busy ? null : _share),
    ],
  );
}

/// The frame every card shares: the dark theme (so it looks the same in every feed), the brand at the
/// top, the line and address at the bottom, and [body] in between.
class _CardFrame extends StatelessWidget {
  const _CardFrame({required this.body});

  final Widget body;

  @override
  Widget build(BuildContext context) {
    final c = NeuroCalColors.dark;
    return Theme(
      data: Theme.of(context).copyWith(extensions: [c]),
      child: ExcludeSemantics(
        child: Container(
          padding: const EdgeInsets.all(Space.s5),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(Radii.hero),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color.alphaBlend(NeuroCalColors.ringFrom.withValues(alpha: 0.45), c.paper),
                c.paper,
                Color.alphaBlend(NeuroCalColors.ringTo.withValues(alpha: 0.4), c.paper),
              ],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                spacing: Space.s2,
                children: [
                  const LogoMark(size: 22),
                  Text(
                    'NeuroCal',
                    style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800, color: c.ink),
                  ),
                ],
              ),
              const Spacer(),
              body,
              const Spacer(),
              Text(
                'Eat for how you want to think.',
                style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.ink),
              ),
              Text(
                'neurocal.ai',
                style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Today's Focus Score in its ring, with the streak.
class ScoreCard extends StatelessWidget {
  const ScoreCard({super.key, required this.score, required this.word, this.streakDays = 0});

  final int score;
  final String word;
  final int streakDays;

  @override
  Widget build(BuildContext context) {
    final c = NeuroCalColors.dark;
    return _CardFrame(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'My Focus Score today',
            style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.inkSoft),
          ),
          const SizedBox(height: Space.s3),
          Center(
            child: FocusRing(
              score: score,
              size: 170,
              child: Text(
                '$score',
                style: TextStyle(fontSize: 56, fontWeight: FontWeight.w800, height: 1, letterSpacing: -2, color: c.ink),
              ),
            ),
          ),
          const SizedBox(height: Space.s3),
          Center(
            child: Text(
              word,
              style: TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800, color: c.ink),
            ),
          ),
          if (streakDays > 1) ...[
            const SizedBox(height: Space.s2),
            Center(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                spacing: 4,
                children: [
                  Icon(Icons.local_fire_department_rounded, size: 18, color: c.glucose),
                  Text(
                    '$streakDays-day streak',
                    style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.glucose),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Weight down since a date, and what's left to the goal. Never the weight itself.
class WeightProgressCard extends StatelessWidget {
  const WeightProgressCard({super.key, required this.lost, required this.since, this.toGo});

  /// "4.2 kg".
  final String lost;

  /// "3 Sep".
  final String since;

  /// "2.8 kg to go", "Goal reached", or null.
  final String? toGo;

  @override
  Widget build(BuildContext context) {
    final c = NeuroCalColors.dark;
    return _CardFrame(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: Space.s2,
        children: [
          Text(
            'Down since $since',
            style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.inkSoft),
          ),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              lost,
              style: TextStyle(fontSize: 64, fontWeight: FontWeight.w800, height: 1, letterSpacing: -2, color: c.ink),
            ),
          ),
          if (toGo != null)
            Text(
              toGo!,
              style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700, color: c.chlorophyll),
            ),
          const SizedBox(height: Space.s2),
          Text(
            'Steady, from meals that keep my focus up.',
            style: TextStyle(fontSize: TextSize.sm, height: 1.35, color: c.inkSoft),
          ),
        ],
      ),
    );
  }
}

/// A level on the ladder: the number in the ring's colours, its name and the five steps.
class LevelCard extends StatelessWidget {
  const LevelCard({super.key, required this.level, required this.name});

  final int level;
  final String name;

  @override
  Widget build(BuildContext context) {
    final c = NeuroCalColors.dark;
    return _CardFrame(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: Space.s3,
        children: [
          Text(
            'My biohacking level',
            style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.inkSoft),
          ),
          Center(
            child: Container(
              width: 140,
              height: 140,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [NeuroCalColors.ringFrom, NeuroCalColors.ringTo],
                ),
              ),
              child: Text(
                '$level',
                style: const TextStyle(
                  fontSize: 64,
                  fontWeight: FontWeight.w800,
                  height: 1,
                  color: NeuroCalColors.onSignal,
                ),
              ),
            ),
          ),
          Center(
            child: Text(
              name,
              style: TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800, color: c.ink),
            ),
          ),
          Row(
            spacing: Space.s1,
            children: [
              for (var step = 1; step <= 5; step++)
                Expanded(
                  child: Container(
                    height: 6,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(Radii.pill),
                      color: step <= level ? c.synapse : c.track,
                    ),
                  ),
                ),
            ],
          ),
          Center(
            child: Text(
              'Level $level of 5, earned with habits',
              style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
            ),
          ),
        ],
      ),
    );
  }
}
