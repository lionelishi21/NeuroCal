import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// The moves the figure can demonstrate; [rest] is a relaxed standing pose.
enum MoveKind { calfRaise, soleusPushUp, singleLegLeft, singleLegRight, anklePump, rest }

/// A side-view figure doing one move at rep pace: one second up, one second down. Drawn in code, in
/// the app's colours, with the working calf in green. Under reduced motion, or with [animate] off, it
/// holds the top of the move; reduced motion also shows the start faintly behind it, so the movement
/// still reads.
class MoveFigure extends StatefulWidget {
  const MoveFigure(this.kind, {super.key, this.animate = true, this.accent});

  final MoveKind kind;

  /// False holds the top of the move (thumbnails, and while paused).
  final bool animate;

  /// The working muscle's colour; green when left out.
  final Color? accent;

  @override
  State<MoveFigure> createState() => _MoveFigureState();
}

class _MoveFigureState extends State<MoveFigure> with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(vsync: this, duration: const Duration(seconds: 1));

  bool get _still => MediaQuery.disableAnimationsOf(context);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(MoveFigure old) {
    super.didUpdateWidget(old);
    _sync();
  }

  void _sync() {
    if (widget.animate && !_still && widget.kind != MoveKind.rest) {
      if (!_controller.isAnimating) _controller.repeat(reverse: true);
    } else {
      // Paused mid-rep stays where it is; a figure that never moved shows the top of the move.
      _controller.stop();
      if (!widget.animate && _controller.value == 0) _controller.value = 1;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final still = _still;
    return ExcludeSemantics(
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) => CustomPaint(
          size: Size.infinite,
          painter: _FigurePainter(
            kind: widget.kind,
            t: still ? 1 : Curves.easeInOut.transform(_controller.value),
            ghost: still && widget.animate && widget.kind != MoveKind.rest,
            body: c.ink,
            far: c.inkFaint,
            props: c.ruleStrong,
            accent: widget.accent ?? c.chlorophyll,
          ),
        ),
      ),
    );
  }
}

/// Joint positions in a 100 × 120 box, ground at y = 112, facing right.
class _Pose {
  const _Pose({
    required this.head,
    required this.shoulder,
    required this.elbow,
    required this.hand,
    required this.hip,
    required this.knee,
    required this.ankle,
    required this.heel,
    required this.toe,
    required this.farKnee,
    required this.farAnkle,
    required this.farHeel,
    required this.farToe,
  });

  final Offset head, shoulder, elbow, hand, hip, knee, ankle, heel, toe, farKnee, farAnkle, farHeel, farToe;
}

const _ground = 112.0;
const _footLength = 14.0;

/// Rotates [v] by [a] radians, heel-up for a foot pointing right.
Offset _turn(Offset v, double a) => Offset(v.dx * math.cos(a) - v.dy * math.sin(a), v.dx * math.sin(a) + v.dy * math.cos(a));

/// A foot pivoting on its toe: [lift] 0 is flat, 1 is the heel fully up.
({Offset heel, Offset ankle}) _footOnToe(Offset toe, double maxDegrees, double lift) {
  final a = maxDegrees * math.pi / 180 * lift;
  final heel = toe + _turn(const Offset(-_footLength, 0), a);
  return (heel: heel, ankle: heel + _turn(const Offset(2, -8), a));
}

_Pose _standing({required double lift, required bool oneLeg, required bool holdWall}) {
  final foot = _footOnToe(const Offset(62, _ground), 30, lift);
  final rise = foot.ankle - const Offset(50, _ground - 8);
  Offset up(double x, double y) => Offset(x, y) + rise;
  final shoulder = up(51, 32);
  return _Pose(
    head: up(52, 21),
    shoulder: shoulder,
    // Holding a wall in front; otherwise arms hang.
    elbow: holdWall ? up(62, 43) : up(52, 48),
    hand: holdWall ? Offset(74, 45 + rise.dy * 0.4) : up(54, 62),
    hip: up(50, 59),
    knee: up(51, 82),
    ankle: foot.ankle,
    heel: foot.heel,
    toe: const Offset(62, _ground),
    // Both feet down, or the free foot hooked up behind.
    farKnee: oneLeg ? up(50, 83) : up(48, 82),
    farAnkle: oneLeg ? up(38, 94) : foot.ankle - const Offset(2, 0),
    farHeel: oneLeg ? up(37, 95) : foot.heel - const Offset(2, 0),
    farToe: oneLeg ? up(31, 101) : const Offset(60, _ground),
  );
}

_Pose _soleus(double lift) {
  final foot = _footOnToe(const Offset(74, _ground), 35, lift);
  final knee = foot.ankle + const Offset(-1, -38);
  const shoulder = Offset(37, 37);
  final hand = knee + const Offset(-5, -3);
  return _Pose(
    head: const Offset(39, 26),
    shoulder: shoulder,
    elbow: Offset.lerp(shoulder, hand, 0.5)! + const Offset(-3, 7),
    hand: hand,
    hip: const Offset(36, 68),
    knee: knee,
    ankle: foot.ankle,
    heel: foot.heel,
    toe: const Offset(74, _ground),
    farKnee: knee - const Offset(2, 0),
    farAnkle: foot.ankle - const Offset(2, 0),
    farHeel: foot.heel - const Offset(2, 0),
    farToe: const Offset(72, _ground),
  );
}

_Pose _anklePump(double flex) {
  const ankle = Offset(84, 104);
  const knee = Offset(60, 85);
  // Toes pointed away, then pulled back toward the shin.
  final toe = Offset.lerp(const Offset(97, 110), const Offset(93, 91), flex)!;
  const shoulder = Offset(35, 37);
  return _Pose(
    head: const Offset(36, 26),
    shoulder: shoulder,
    elbow: const Offset(38, 54),
    hand: const Offset(46, 70),
    hip: const Offset(36, 68),
    knee: knee,
    ankle: ankle,
    heel: const Offset(85, 110),
    toe: toe,
    farKnee: knee - const Offset(2, 1),
    farAnkle: ankle - const Offset(2, 1),
    farHeel: const Offset(83, 109),
    farToe: toe - const Offset(2, 1),
  );
}

_Pose _poseFor(MoveKind kind, double t) => switch (kind) {
  MoveKind.calfRaise => _standing(lift: t, oneLeg: false, holdWall: true),
  MoveKind.singleLegLeft || MoveKind.singleLegRight => _standing(lift: t, oneLeg: true, holdWall: true),
  MoveKind.soleusPushUp => _soleus(t),
  MoveKind.anklePump => _anklePump(t),
  MoveKind.rest => _standing(lift: 0, oneLeg: false, holdWall: false),
};

class _FigurePainter extends CustomPainter {
  _FigurePainter({
    required this.kind,
    required this.t,
    required this.ghost,
    required this.body,
    required this.far,
    required this.props,
    required this.accent,
  });

  final MoveKind kind;
  final double t;

  /// Also draw the start of the move, faintly (reduced motion).
  final bool ghost;
  final Color body, far, props, accent;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = math.min(size.width / 100, size.height / 120);
    canvas.save();
    canvas.translate((size.width - 100 * scale) / 2, (size.height - 120 * scale) / 2);
    canvas.scale(scale);
    if (kind == MoveKind.singleLegRight) {
      // The right leg works: the mirror image, wall on the other side.
      canvas.translate(100, 0);
      canvas.scale(-1, 1);
    }
    _props(canvas);
    if (ghost) _figure(canvas, _poseFor(kind, 0), faded: true);
    _figure(canvas, _poseFor(kind, t));
    canvas.restore();
  }

  Paint _stroke(Color color, double width) => Paint()
    ..color = color
    ..strokeWidth = width
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round
    ..style = PaintingStyle.stroke;

  void _props(Canvas canvas) {
    final line = _stroke(props, 1.6);
    canvas.drawLine(const Offset(8, _ground + 1.5), const Offset(96, _ground + 1.5), line);
    switch (kind) {
      case MoveKind.calfRaise || MoveKind.singleLegLeft || MoveKind.singleLegRight:
        canvas.drawLine(const Offset(77, 18), const Offset(77, _ground + 1.5), _stroke(props, 2.4));
      case MoveKind.soleusPushUp || MoveKind.anklePump:
        final chair = _stroke(props, 2.4);
        canvas.drawLine(const Offset(22, 72), const Offset(50, 72), chair);
        canvas.drawLine(const Offset(23, 40), const Offset(23, _ground), chair);
        canvas.drawLine(const Offset(48, 72), const Offset(48, _ground), chair);
      case MoveKind.rest:
        break;
    }
  }

  void _figure(Canvas canvas, _Pose p, {bool faded = false}) {
    Color c(Color color) => faded ? color.withValues(alpha: 0.22) : color;
    final limb = _stroke(c(body), 7.5);

    // Far side first, so the near side covers it.
    canvas.drawPath(Path()..addPolygon([p.hip, p.farKnee, p.farAnkle], false), _stroke(c(far), 7.5));
    _foot(canvas, p.farAnkle, p.farHeel, p.farToe, c(far));

    canvas.drawLine(p.shoulder, p.hip, _stroke(c(body), 12));
    canvas.drawLine(p.hip, p.knee, limb);
    canvas.drawLine(p.knee, p.ankle, limb);
    // The working calf: the upper shin, where the muscle is.
    canvas.drawLine(Offset.lerp(p.knee, p.ankle, 0.15)!, Offset.lerp(p.knee, p.ankle, 0.8)!, _stroke(c(accent), 9.5));
    _foot(canvas, p.ankle, p.heel, p.toe, c(body));
    canvas.drawPath(Path()..addPolygon([p.shoulder, p.elbow, p.hand], false), _stroke(c(body), 5.5));
    canvas.drawCircle(p.head, 8, Paint()..color = c(body));
  }

  /// A solid foot: ankle, heel and toe filled in, with rounded corners.
  void _foot(Canvas canvas, Offset ankle, Offset heel, Offset toe, Color color) {
    final shape = Path()..addPolygon([ankle, heel, toe], true);
    canvas.drawPath(shape, Paint()..color = color);
    canvas.drawPath(shape, _stroke(color, 3.5));
  }

  @override
  bool shouldRepaint(_FigurePainter old) =>
      old.t != t || old.kind != kind || old.ghost != ghost || old.body != body || old.accent != accent || old.far != far || old.props != props;
}
