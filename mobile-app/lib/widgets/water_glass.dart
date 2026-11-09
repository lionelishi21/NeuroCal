import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// A tumbler of water filled to [fill] (0 to 1). On arrival it fills up, and whenever [fill]
/// changes the level eases to the new height while the surface sloshes, a few bubbles rise and
/// it all settles still. It stays still when the device asks for reduced motion.
class WaterGlass extends StatefulWidget {
  const WaterGlass({super.key, required this.fill, required this.color, this.width = 28, this.height = 36});

  final double fill;
  final Color color;
  final double width;
  final double height;

  @override
  State<WaterGlass> createState() => _WaterGlassState();
}

class _WaterGlassState extends State<WaterGlass> with SingleTickerProviderStateMixin {
  late final _slosh = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600));

  /// Which way the last change went: 1 up (water poured in), -1 down.
  var _direction = 1.0;

  void _sloshOn() {
    if (MediaQuery.disableAnimationsOf(context)) return;
    _slosh.forward(from: 0);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_slosh.value == 0 && !_slosh.isAnimating) _sloshOn();
  }

  @override
  void didUpdateWidget(WaterGlass old) {
    super.didUpdateWidget(old);
    if (old.fill != widget.fill) {
      _direction = widget.fill >= old.fill ? 1 : -1;
      _sloshOn();
    }
  }

  @override
  void dispose() {
    _slosh.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final still = MediaQuery.disableAnimationsOf(context);
    return ExcludeSemantics(
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: still ? null : 0, end: widget.fill.clamp(0, 1)),
        duration: still ? Duration.zero : Motion.dial,
        curve: Motion.settle,
        builder: (context, fill, _) => AnimatedBuilder(
          animation: _slosh,
          builder: (context, _) => CustomPaint(
            size: Size(widget.width, widget.height),
            painter: WaterGlassPainter(
              fill: fill,
              slosh: _slosh.isAnimating ? _slosh.value : 1,
              direction: _direction,
              color: widget.color,
            ),
          ),
        ),
      ),
    );
  }
}

class WaterGlassPainter extends CustomPainter {
  const WaterGlassPainter({required this.fill, required this.slosh, required this.direction, required this.color});

  /// 0 to 1: how full the glass is.
  final double fill;

  /// 0 to 1 through one slosh; 1 is still.
  final double slosh;
  final double direction;
  final Color color;

  /// The tumbler: wider at the rim, a soft round base.
  Path _glass(Size s, double inset) {
    final top = inset;
    final bottom = s.height - inset;
    final topHalf = s.width / 2 - inset;
    final bottomHalf = s.width * 0.36 - inset;
    final cx = s.width / 2;
    final r = math.min(4.0, bottomHalf);
    return Path()
      ..moveTo(cx - topHalf, top)
      ..lineTo(cx - bottomHalf, bottom - r)
      ..quadraticBezierTo(cx - bottomHalf + 0.4, bottom, cx - bottomHalf + r, bottom)
      ..lineTo(cx + bottomHalf - r, bottom)
      ..quadraticBezierTo(cx + bottomHalf - 0.4, bottom, cx + bottomHalf, bottom - r)
      ..lineTo(cx + topHalf, top);
  }

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 1.8;
    final inner = _glass(size, stroke * 1.15)..close();
    // A full glass stops a little below the rim.
    final innerTop = size.height * 0.14;
    final innerBottom = size.height - stroke * 1.15;

    // The water, clipped to the inside of the glass.
    if (fill > 0) {
      canvas.save();
      canvas.clipPath(inner);
      final level = innerBottom - (innerBottom - innerTop) * fill;
      final calm = 1 - slosh;
      final amp = 2.4 * calm * calm;
      final phase = slosh * 5 * math.pi;
      final tilt = math.sin(phase) * amp * direction;
      final surface = Path()..moveTo(0, size.height);
      for (var x = 0.0; x <= size.width; x += 1) {
        final t = x / size.width;
        surface.lineTo(x, level + tilt * (t - 0.5) * 2 + math.sin(t * 2 * math.pi + phase * 1.6) * amp * 0.45);
      }
      surface
        ..lineTo(size.width, size.height)
        ..close();
      final water = Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [color.withValues(alpha: 0.55), color.withValues(alpha: 0.9)],
        ).createShader(Rect.fromLTRB(0, level, size.width, innerBottom));
      canvas.drawPath(surface, water);

      // Bubbles rise through the water while it settles.
      if (slosh < 1) {
        final bubble = Paint()..color = Colors.white.withValues(alpha: 0.7 * calm);
        const seeds = [(0.38, 0.0, 1.1), (0.6, 0.25, 0.8), (0.48, 0.5, 0.95)];
        for (final (x, delay, r) in seeds) {
          final t = ((slosh - delay) / (1 - delay)).clamp(0.0, 1.0);
          if (t == 0) continue;
          final y = innerBottom - 2 - (innerBottom - level) * t;
          if (y < level + 1) continue;
          canvas.drawCircle(Offset(size.width * x + math.sin(t * 6) * 1.2, y), r, bubble);
        }
      }
      canvas.restore();
    }

    // The glass itself, open at the rim, with a glint down one side.
    canvas.drawPath(
      _glass(size, stroke / 2),
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    canvas.drawLine(
      Offset(size.width * 0.27, size.height * 0.2),
      Offset(size.width * 0.31, size.height * 0.62),
      Paint()
        ..color = color.withValues(alpha: 0.3)
        ..strokeWidth = 1.4
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(WaterGlassPainter old) =>
      old.fill != fill || old.slosh != slosh || old.direction != direction || old.color != color;
}
