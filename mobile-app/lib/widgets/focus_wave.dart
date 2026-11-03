import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// A brainwave on the brand's night (the sign-in screen): scattered at [focus] 0, a clean steady
/// wave at 1, with the mark's amber dot of energy riding it. It flows on arrival and whenever
/// [focus] changes, then settles; it stays still when the device asks for reduced motion.
class FocusWave extends StatefulWidget {
  const FocusWave({super.key, required this.focus, this.height = 132});

  /// 0 to 1: how far the form is filled in.
  final double focus;
  final double height;

  @override
  State<FocusWave> createState() => _FocusWaveState();
}

class _FocusWaveState extends State<FocusWave> with SingleTickerProviderStateMixin {
  /// The wave's phase, in turns; unbounded so each flow carries on from where the last stopped.
  late final _drift = AnimationController.unbounded(vsync: this);

  /// How far one flow moves the wave, and how long it takes.
  static const _flow = 0.35;
  static const _flowTime = Duration(milliseconds: 2400);

  void _flowOn() {
    if (MediaQuery.of(context).disableAnimations) return;
    _drift.animateTo(_drift.value + _flow, duration: _flowTime, curve: Curves.easeOutCubic);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_drift.value == 0 && !_drift.isAnimating) _flowOn();
  }

  @override
  void didUpdateWidget(FocusWave old) {
    super.didUpdateWidget(old);
    if (old.focus != widget.focus) _flowOn();
  }

  @override
  void dispose() {
    _drift.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final still = MediaQuery.of(context).disableAnimations;
    return ExcludeSemantics(
      child: TweenAnimationBuilder<double>(
        tween: Tween(end: widget.focus.clamp(0, 1)),
        duration: still ? Duration.zero : Motion.dial,
        curve: Motion.settle,
        builder: (context, focus, _) => AnimatedBuilder(
          animation: _drift,
          builder: (context, _) => CustomPaint(
            size: Size.fromHeight(widget.height),
            painter: FocusWavePainter(focus: focus, phase: _drift.value * 2 * math.pi),
          ),
        ),
      ),
    );
  }
}

class FocusWavePainter extends CustomPainter {
  const FocusWavePainter({required this.focus, required this.phase});

  final double focus;
  final double phase;

  /// Height of the wave at [t] (0 to 1 across), from -1 to 1: noise fades out as focus comes in.
  double _y(double t) {
    final x = t * 2 * math.pi * 2.25;
    final calm = math.sin(x + phase);
    final noise =
        0.55 * math.sin(3.7 * x + 1.9 * phase + 0.4) +
        0.35 * math.sin(7.3 * x - 2 * phase + 1.3) +
        0.22 * math.sin(13.1 * x + 3 * phase + 2.2) +
        0.14 * math.sin(21.7 * x - 4 * phase);
    final n = 1 - focus;
    // Scattered signals are smaller and busier; focus is a full, slow swing.
    return (1 - n) * calm + n * (0.45 * calm + 0.62 * noise);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final mid = size.height / 2;
    final amp = size.height * 0.36;
    const steps = 160;
    final path = Path();
    for (var i = 0; i <= steps; i++) {
      final t = i / steps;
      final p = Offset(t * size.width, mid - _y(t) * amp);
      if (i == 0) {
        path.moveTo(p.dx, p.dy);
      } else {
        path.lineTo(p.dx, p.dy);
      }
    }

    canvas.drawLine(Offset(0, mid), Offset(size.width, mid), Paint()..color = NeuroCalColors.nightTrack);

    // Edges fade out so the wave reads as a slice of an ongoing signal.
    final bounds = Offset.zero & size;
    final gradient = LinearGradient(
      colors: [
        NeuroCalColors.ringFrom.withValues(alpha: 0),
        NeuroCalColors.ringFrom,
        NeuroCalColors.ringTo,
        NeuroCalColors.ringTo.withValues(alpha: 0),
      ],
      stops: const [0, 0.22, 0.78, 1],
    ).createShader(bounds);
    canvas.drawPath(
      path,
      Paint()
        ..shader = gradient
        ..style = PaintingStyle.stroke
        ..strokeWidth = 10
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10)
        ..color = Colors.white.withValues(alpha: 0.5),
    );
    canvas.drawPath(
      path,
      Paint()
        ..shader = gradient
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );

    // The energy dot, as in the mark.
    const at = 0.7;
    final dot = Offset(at * size.width, mid - _y(at) * amp);
    canvas.drawCircle(
      dot,
      12,
      Paint()
        ..color = NeuroCalColors.markEnergy.withValues(alpha: 0.35)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
    );
    canvas.drawCircle(dot, 5, Paint()..color = NeuroCalColors.markEnergy);
  }

  @override
  bool shouldRepaint(FocusWavePainter old) => old.focus != focus || old.phase != phase;
}
