import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// The Focus Score ring: a blue-to-teal arc on a quiet track, dashed when there is no score yet.
/// The arc fills on load unless the device asks for reduced motion.
class FocusRing extends StatelessWidget {
  const FocusRing({super.key, required this.score, this.size = 224, this.label, this.child});

  /// 0–100, or null when there is no score yet.
  final int? score;
  final double size;

  /// Read out instead of the score, when [child] says something else.
  final String? label;

  /// The centre. Defaults to the score with "out of 100".
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    final text = Theme.of(context).textTheme;
    return Semantics(
      label: label ?? (score == null ? 'Focus Score: no score yet' : 'Focus Score: $score out of 100'),
      excludeSemantics: true,
      child: SizedBox.square(
        dimension: size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: (score ?? 0) / 100),
              duration: reduceMotion ? Duration.zero : Motion.dial,
              curve: Motion.settle,
              builder: (context, value, _) => CustomPaint(
                size: Size.square(size),
                painter: _RingPainter(value: value, dashed: score == null, track: c.track),
              ),
            ),
            child ??
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (score != null) ...[
                      Text(
                        '$score',
                        style: text.displayLarge?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                      ),
                      Text('out of 100', style: text.bodyMedium?.copyWith(color: c.inkSoft)),
                    ] else
                      Text('No score yet', style: text.titleMedium),
                    const SizedBox(height: Space.s1),
                    Text('Focus Score', style: text.labelSmall?.copyWith(color: c.synapseInk, letterSpacing: 0.4)),
                  ],
                ),
          ],
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  const _RingPainter({required this.value, required this.dashed, required this.track});

  final double value;
  final bool dashed;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    // The web ring is drawn in a 200-unit box: radius 80, stroke 16.
    final unit = size.width / 200;
    final stroke = 16 * unit;
    final rect = Rect.fromCircle(center: size.center(Offset.zero), radius: 80 * unit);
    final trackPaint = Paint()
      ..color = track
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    if (dashed) {
      // 6 on, 10 off, as on the web.
      final sweep = 6 * unit / rect.width * 2;
      final step = 16 * unit / rect.width * 2;
      for (var a = 0.0; a < 2 * math.pi - sweep / 2; a += step) {
        canvas.drawArc(rect, a, sweep, false, trackPaint);
      }
      return;
    }
    canvas.drawArc(rect, 0, 2 * math.pi, false, trackPaint);
    if (value <= 0) return;
    canvas.drawArc(
      rect,
      -math.pi / 2,
      2 * math.pi * value,
      false,
      Paint()
        ..shader = const LinearGradient(
          colors: [NeuroCalColors.ringFrom, NeuroCalColors.ringTo],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ).createShader(rect)
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = stroke,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.value != value || old.dashed != dashed || old.track != track;
}
