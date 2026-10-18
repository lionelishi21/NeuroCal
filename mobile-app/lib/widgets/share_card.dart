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
    showAppSheet<void>(context, title: 'Share your score', builder: (_) => _ShareScore(score: score, word: word, streakDays: streakDays));

class _ShareScore extends StatefulWidget {
  const _ShareScore({required this.score, required this.word, required this.streakDays});

  final int score;
  final String word;
  final int streakDays;

  @override
  State<_ShareScore> createState() => _ShareScoreState();
}

class _ShareScoreState extends State<_ShareScore> {
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
      await AppScope.of(context).shareImage(
        png,
        'My Focus Score today: ${widget.score}. I track how food, sleep and stress shape my focus with NeuroCal. neurocal.ai',
      );
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
          child: SizedBox.fromSize(size: _size, child: ScoreCard(score: widget.score, word: widget.word, streakDays: widget.streakDays)),
        ),
      ),
      SheetAction(label: _busy ? 'Getting it ready…' : 'Share', onPressed: _busy ? null : _share),
    ],
  );
}

/// The card itself, always in the dark theme so it looks the same in every feed.
class ScoreCard extends StatelessWidget {
  const ScoreCard({super.key, required this.score, required this.word, this.streakDays = 0});

  final int score;
  final String word;
  final int streakDays;

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
                  Text('NeuroCal', style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800, color: c.ink)),
                ],
              ),
              const Spacer(),
              Text('My Focus Score today', style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.inkSoft)),
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
              Center(child: Text(word, style: TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800, color: c.ink))),
              if (streakDays > 1) ...[
                const SizedBox(height: Space.s2),
                Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    spacing: 4,
                    children: [
                      Icon(Icons.local_fire_department_rounded, size: 18, color: c.glucose),
                      Text('$streakDays-day streak', style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.glucose)),
                    ],
                  ),
                ),
              ],
              const Spacer(),
              Text(
                'Eat for how you want to think.',
                style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.ink),
              ),
              Text('neurocal.ai', style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft)),
            ],
          ),
        ),
      ),
    );
  }
}
