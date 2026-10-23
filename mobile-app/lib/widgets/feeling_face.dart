import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../api/models.dart';
import '../theme/tokens.dart';

/// A small drawn face for a check-in feeling: a round head in the feeling's soft colour, the same
/// features in ink for every face, and one detail that tells the feeling apart (a sparkle for sharp,
/// a cloud for brain fog, a low battery for low energy…). Drawn in code, in the app's colours.
class FeelingFace extends StatelessWidget {
  const FeelingFace(this.flag, {super.key, this.size = 56});

  final CognitiveFlag flag;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final (fill, accent) = feelingColors(flag, c);
    return ExcludeSemantics(
      child: CustomPaint(
        size: Size.square(size),
        painter: _FacePainter(
          flag: flag,
          fill: fill,
          accent: accent,
          ink: c.ink,
          paper: c.paper,
          cloud: c.ruleStrong,
          drop: c.ionInk,
        ),
      ),
    );
  }
}

/// The feeling's head colour and its accent: greens and blues for the good ones, warmer for the rest.
(Color, Color) feelingColors(CognitiveFlag flag, NeuroCalColors c) => switch (flag) {
  CognitiveFlag.sharp => (c.chlorophyllSoft, c.chlorophyll),
  CognitiveFlag.calm => (c.ionSoft, c.ionInk),
  CognitiveFlag.lowFocus => (c.synapseSoft, c.synapseInk),
  CognitiveFlag.brainFog => (c.track, c.inkSoft),
  CognitiveFlag.lowEnergy => (c.sleepSoft, c.sleep),
  CognitiveFlag.wired => (c.glucoseSoft, c.glucoseInk),
  CognitiveFlag.stressed => (c.beetSoft, c.beet),
};

/// Drawn in a 100 × 100 box: the head is centred at (50, 56) with a radius of 32.
class _FacePainter extends CustomPainter {
  _FacePainter({
    required this.flag,
    required this.fill,
    required this.accent,
    required this.ink,
    required this.paper,
    required this.cloud,
    required this.drop,
  });

  final CognitiveFlag flag;
  final Color fill, accent, ink, paper, cloud, drop;

  Paint _line(Color color, [double width = 4]) => Paint()
    ..color = color
    ..strokeWidth = width
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round
    ..style = PaintingStyle.stroke;

  Paint _solid(Color color) => Paint()..color = color;

  /// A curve from [a] to [b] bending through [via].
  Path _curve(Offset a, Offset via, Offset b) => Path()
    ..moveTo(a.dx, a.dy)
    ..quadraticBezierTo(via.dx, via.dy, b.dx, b.dy);

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 100, size.height / 100);
    canvas.drawCircle(const Offset(50, 56), 32, _solid(fill));
    final features = _line(ink);
    switch (flag) {
      case CognitiveFlag.sharp:
        canvas.drawCircle(const Offset(39, 52), 4.5, _solid(ink));
        canvas.drawCircle(const Offset(61, 52), 4.5, _solid(ink));
        canvas.drawCircle(const Offset(40.5, 50.5), 1.4, _solid(paper));
        canvas.drawCircle(const Offset(62.5, 50.5), 1.4, _solid(paper));
        canvas.drawPath(_curve(const Offset(40, 66), const Offset(50, 74), const Offset(60, 66)), features);
        _sparkle(canvas, const Offset(84, 20), 10);
        _sparkle(canvas, const Offset(16, 28), 6);
      case CognitiveFlag.calm:
        canvas.drawPath(_curve(const Offset(33, 52), const Offset(39, 57), const Offset(45, 52)), features);
        canvas.drawPath(_curve(const Offset(55, 52), const Offset(61, 57), const Offset(67, 52)), features);
        canvas.drawPath(_curve(const Offset(42, 67), const Offset(50, 72), const Offset(58, 67)), features);
        // Slow breaths rising off the head.
        final wave = _line(accent, 3.5);
        for (final y in [12.0, 20.0]) {
          canvas.drawPath(
            Path()
              ..moveTo(62, y)
              ..cubicTo(68, y - 4, 72, y + 4, 78, y)
              ..cubicTo(84, y - 4, 88, y + 4, 94, y),
            wave,
          );
        }
      case CognitiveFlag.lowFocus:
        for (final x in [39.0, 61.0]) {
          canvas.drawCircle(Offset(x, 52), 6.5, _solid(paper));
          canvas.drawCircle(Offset(x + 3, 50), 3, _solid(ink));
        }
        canvas.drawLine(const Offset(42, 68), const Offset(58, 68), features);
        // A thought wandering off.
        final dots = _solid(accent);
        for (var i = 0; i < 6; i++) {
          final t = i / 5;
          canvas.drawCircle(Offset(60 + 30 * t, 22 - 14 * math.sin(t * math.pi) + 6 * t), 2.6, dots);
        }
      case CognitiveFlag.brainFog:
        canvas.drawLine(const Offset(35, 56), const Offset(43, 56), features);
        canvas.drawLine(const Offset(57, 56), const Offset(65, 56), features);
        canvas.drawPath(
          Path()
            ..moveTo(42, 69)
            ..quadraticBezierTo(46, 66, 50, 69)
            ..quadraticBezierTo(54, 72, 58, 69),
          features,
        );
        // A cloud sitting over the top of the head.
        // Merged into one outline, so the stroke doesn't cross the inside.
        var shape = Path()
          ..addRRect(RRect.fromRectAndRadius(const Rect.fromLTRB(26, 30, 82, 44), const Radius.circular(7)));
        for (final (center, radius) in [
          (const Offset(38, 30), 12.0),
          (const Offset(55, 24), 15.0),
          (const Offset(71, 31), 11.0),
        ]) {
          shape = Path.combine(
            PathOperation.union,
            shape,
            Path()..addOval(Rect.fromCircle(center: center, radius: radius)),
          );
        }
        canvas.drawPath(shape, _solid(paper));
        canvas.drawPath(shape, _line(cloud, 3));
      case CognitiveFlag.lowEnergy:
        // Heavy lids over half-open eyes.
        for (final x in [39.0, 61.0]) {
          canvas.drawArc(Rect.fromCircle(center: Offset(x, 54), radius: 5), 0, math.pi, true, _solid(ink));
          canvas.drawLine(Offset(x - 7, 54), Offset(x + 7, 54), features);
        }
        canvas.drawPath(_curve(const Offset(43, 71), const Offset(50, 67), const Offset(57, 71)), features);
        // A battery nearly out.
        final battery = RRect.fromRectAndRadius(const Rect.fromLTWH(70, 10, 22, 12), const Radius.circular(3));
        canvas.drawRRect(battery, _line(accent, 3));
        canvas.drawLine(const Offset(94.5, 14), const Offset(94.5, 18), _line(accent, 3));
        canvas.drawRRect(
          RRect.fromRectAndRadius(const Rect.fromLTWH(73, 13, 5, 6), const Radius.circular(1.5)),
          _solid(accent),
        );
      case CognitiveFlag.wired:
        for (final x in [39.0, 61.0]) {
          canvas.drawCircle(Offset(x, 52), 7.5, _solid(paper));
          canvas.drawCircle(Offset(x, 52), 7.5, _line(ink, 2.5));
          canvas.drawCircle(Offset(x, 52), 2.5, _solid(ink));
        }
        canvas.drawLine(const Offset(42, 70), const Offset(58, 70), features);
        // Jitter on both sides.
        final zig = _line(accent, 3.5);
        for (final side in [-1.0, 1.0]) {
          final x = 50 + side * 42;
          canvas.drawPath(
            Path()
              ..moveTo(x, 36)
              ..lineTo(x - side * 5, 44)
              ..lineTo(x + side * 1, 52)
              ..lineTo(x - side * 5, 60)
              ..lineTo(x, 68),
            zig,
          );
        }
      case CognitiveFlag.stressed:
        // Worried brows over small eyes.
        canvas.drawLine(const Offset(33, 44), const Offset(44, 40), features);
        canvas.drawLine(const Offset(56, 40), const Offset(67, 44), features);
        canvas.drawCircle(const Offset(39, 53), 3.5, _solid(ink));
        canvas.drawCircle(const Offset(61, 53), 3.5, _solid(ink));
        canvas.drawPath(
          Path()
            ..moveTo(40, 70)
            ..lineTo(45, 66)
            ..lineTo(50, 70)
            ..lineTo(55, 66)
            ..lineTo(60, 70),
          features,
        );
        // A bead of sweat.
        canvas.drawPath(
          Path()
            ..moveTo(84, 22)
            ..quadraticBezierTo(76, 36, 84, 38)
            ..quadraticBezierTo(92, 36, 84, 22),
          _solid(drop),
        );
    }
    canvas.restore();
  }

  /// A four-pointed star.
  void _sparkle(Canvas canvas, Offset c, double r) {
    final s = r * 0.28;
    canvas.drawPath(
      Path()
        ..moveTo(c.dx, c.dy - r)
        ..quadraticBezierTo(c.dx + s, c.dy - s, c.dx + r, c.dy)
        ..quadraticBezierTo(c.dx + s, c.dy + s, c.dx, c.dy + r)
        ..quadraticBezierTo(c.dx - s, c.dy + s, c.dx - r, c.dy)
        ..quadraticBezierTo(c.dx - s, c.dy - s, c.dx, c.dy - r),
      _solid(accent),
    );
  }

  @override
  bool shouldRepaint(_FacePainter old) =>
      old.flag != flag || old.fill != fill || old.accent != accent || old.ink != ink;
}
