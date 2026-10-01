import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// The NeuroCal mark: an open ring (the day, and a C for Cal) with a spark in its opening.
/// Same geometry as `web-poc/src/components/Logo.tsx` on a 64-unit grid.
class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.size = 28});

  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      label: 'NeuroCal',
      child: CustomPaint(
        size: Size.square(size),
        painter: LogoPainter(ring: c.synapse, spark: c.ion),
      ),
    );
  }
}

class LogoPainter extends CustomPainter {
  const LogoPainter({required this.ring, required this.spark});

  final Color ring;
  final Color spark;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 64);
    // Arc from (47.28, 47.83) the long way round to (47.28, 16.17): radius 22 around (32, 32).
    final path = Path()
      ..moveTo(47.28, 47.83)
      ..arcToPoint(const Offset(47.28, 16.17), radius: const Radius.circular(22), largeArc: true);
    canvas.drawPath(
      path,
      Paint()
        ..color = ring
        ..style = PaintingStyle.stroke
        ..strokeWidth = 7.5
        ..strokeCap = StrokeCap.round,
    );
    canvas.drawCircle(const Offset(54, 32), 4.8, Paint()..color = spark);
  }

  @override
  bool shouldRepaint(LogoPainter old) => old.ring != ring || old.spark != spark;
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
