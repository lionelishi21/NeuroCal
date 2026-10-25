import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// The NeuroCal mark: the Focus Score ring left open at the top, a neural spark at its centre and an
/// amber dot of energy in the gap. Drawn from `design_system/.../assets/neurocal-mark.svg` on its
/// 1024-unit grid, so the icon, the splash and the app all come from one drawing.
class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.size = 28});

  final double size;

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'NeuroCal',
    child: CustomPaint(size: Size.square(size), painter: const LogoPainter()),
  );
}

class LogoPainter extends CustomPainter {
  /// [background] fills the square, as in the app icon. Without it the mark is cropped to itself
  /// (the SVG's 150–874 view box); with it the mark sits at the icon's own size and margin.
  const LogoPainter({this.background, this.glow = true});

  final Color? background;

  /// The soft light around the ring and spark; off where it would smudge at tiny sizes.
  final bool glow;

  static const _box = 724.0;
  static const _gradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [NeuroCalColors.ringFrom, NeuroCalColors.ringTo],
  );

  @override
  void paint(Canvas canvas, Size size) {
    if (background case final bg?) {
      canvas.drawRect(Offset.zero & size, Paint()..color = bg);
      canvas.scale(size.width / 1024);
    } else {
      canvas.scale(size.width / _box);
      canvas.translate(-150, -150);
    }
    const centre = Offset(512, 512);
    // The halo behind the mark.
    canvas.drawCircle(
      centre,
      300,
      Paint()
        ..shader = RadialGradient(
          colors: [NeuroCalColors.ringFrom.withValues(alpha: 0.32), NeuroCalColors.ringFrom.withValues(alpha: 0)],
        ).createShader(Rect.fromCircle(center: centre, radius: 300)),
    );
    final shader = _gradient.createShader(const Rect.fromLTRB(242, 242, 782, 782));
    // A 270-radius ring from (626.1, 267.3) the long way round to (397.9, 267.3): open at the top.
    final ring = Path()
      ..moveTo(626.1, 267.3)
      ..arcToPoint(const Offset(397.9, 267.3), radius: const Radius.circular(270), largeArc: true);
    final spark = Path()
      ..moveTo(512, 352)
      ..quadraticBezierTo(538, 486, 672, 512)
      ..quadraticBezierTo(538, 538, 512, 672)
      ..quadraticBezierTo(486, 538, 352, 512)
      ..quadraticBezierTo(486, 486, 512, 352)
      ..close();
    Paint ringPaint() => Paint()
      ..shader = shader
      ..style = PaintingStyle.stroke
      ..strokeWidth = 68
      ..strokeCap = StrokeCap.round;
    Paint sparkPaint() => Paint()..shader = shader;
    if (glow) {
      // The SVG's blur (standard deviation 18) laid under the sharp shapes.
      const blur = MaskFilter.blur(BlurStyle.normal, 18);
      canvas.drawPath(ring, ringPaint()..maskFilter = blur);
      canvas.drawPath(spark, sparkPaint()..maskFilter = blur);
    }
    canvas.drawPath(ring, ringPaint());
    canvas.drawPath(spark, sparkPaint());
    canvas.drawCircle(const Offset(512, 232), 30, Paint()..color = NeuroCalColors.markEnergy);
  }

  @override
  bool shouldRepaint(LogoPainter old) => old.background != background || old.glow != glow;
}

/// Mark plus name, for the top of the account screens.
class Logo extends StatelessWidget {
  const Logo({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const LogoMark(size: 30),
        const SizedBox(width: Space.s2),
        Text(
          'NeuroCal',
          style: TextStyle(
            fontSize: TextSize.lg,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.4,
            color: context.colors.ink,
          ),
        ),
      ],
    );
  }
}
