import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// Today's hero: the Focus Score as a glowing violet→teal ring. The ring fills on load
/// unless the device asks for reduced motion.
class FocusRing extends StatelessWidget {
  const FocusRing({super.key, required this.score});

  /// 0–100, or null when there is no score yet.
  final int? score;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    final text = Theme.of(context).textTheme;
    return Semantics(
      label: score == null ? 'Focus Score: no score yet' : 'Focus Score: $score out of 100',
      excludeSemantics: true,
      child: SizedBox.square(
        dimension: 224,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Container(
              margin: const EdgeInsets.all(Space.s4),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: c.glow, blurRadius: 48, spreadRadius: 4)],
              ),
            ),
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: (score ?? 0) / 100),
              duration: reduceMotion ? Duration.zero : const Duration(milliseconds: 900),
              curve: const Cubic(0.2, 0.8, 0.2, 1),
              builder: (context, value, _) => CustomPaint(
                size: const Size.square(224),
                painter: _RingPainter(value: value, track: c.rule, start: c.synapse, end: c.ion),
              ),
            ),
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
                Text('Focus Score', style: text.labelSmall?.copyWith(color: c.synapse, letterSpacing: 0.4)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  const _RingPainter({required this.value, required this.track, required this.start, required this.end});

  final double value;
  final Color track;
  final Color start;
  final Color end;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 12.0;
    final rect = Rect.fromCircle(center: size.center(Offset.zero), radius: size.width / 2 - stroke);
    canvas.drawArc(
      rect,
      0,
      2 * math.pi,
      false,
      Paint()
        ..color = track
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke,
    );
    if (value <= 0) return;
    canvas.drawArc(
      rect,
      -math.pi / 2,
      2 * math.pi * value,
      false,
      Paint()
        ..shader = LinearGradient(
          colors: [start, end],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ).createShader(rect)
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = stroke,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.value != value || old.track != track || old.start != start || old.end != end;
}
