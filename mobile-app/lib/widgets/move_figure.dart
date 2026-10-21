import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// The moves the figure can demonstrate: the calf routine's, one for each kind of exercise, and [rest],
/// a relaxed standing pose.
enum MoveKind {
  calfRaise,
  soleusPushUp,
  singleLegLeft,
  singleLegRight,
  anklePump,
  rest,
  walk,
  run,
  cycle,
  squat,
  jumpingJack,
  tree,
  swim,
  tennis,
  reach,
}

/// How long one rep takes, and whether it loops (pedals, strokes) or goes there and back.
const _timing = <MoveKind, ({int ms, bool loop})>{
  MoveKind.walk: (ms: 550, loop: false),
  MoveKind.run: (ms: 340, loop: false),
  MoveKind.cycle: (ms: 1000, loop: true),
  MoveKind.squat: (ms: 1400, loop: false),
  MoveKind.jumpingJack: (ms: 450, loop: false),
  MoveKind.tree: (ms: 2200, loop: false),
  MoveKind.swim: (ms: 1600, loop: true),
  MoveKind.tennis: (ms: 900, loop: false),
  MoveKind.reach: (ms: 1600, loop: false),
};

/// A figure doing one move at its own pace (the calf routine's one second up, one second down). Drawn in
/// code, in the app's colours, with the working muscle in green. Under reduced motion, or with [animate]
/// off, it holds the top of the move; reduced motion also shows the start faintly behind it, so the
/// movement still reads.
class MoveFigure extends StatefulWidget {
  const MoveFigure(this.kind, {super.key, this.animate = true, this.accent, this.reps});

  final MoveKind kind;

  /// False holds the top of the move (thumbnails, and while paused).
  final bool animate;

  /// Plays this many reps and stops, for a figure answering a tap; null keeps going (a guided routine).
  final int? reps;

  /// The working muscle's colour; green when left out.
  final Color? accent;

  @override
  State<MoveFigure> createState() => _MoveFigureState();
}

class _MoveFigureState extends State<MoveFigure> with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(vsync: this, duration: const Duration(seconds: 1));

  ({int ms, bool loop}) get _pace => _timing[widget.kind] ?? (ms: 1000, loop: false);

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
    final duration = Duration(milliseconds: _pace.ms);
    if (_controller.duration != duration) {
      _controller.duration = duration;
      if (_controller.isAnimating) _controller.stop();
    }
    if (widget.animate && !_still && widget.kind != MoveKind.rest) {
      if (!_controller.isAnimating) {
        final reps = widget.reps;
        if (reps == null) {
          _controller.repeat(reverse: !_pace.loop);
        } else {
          // There and back counts as two runs of the controller.
          _controller.repeat(reverse: !_pace.loop, count: _pace.loop ? reps : reps * 2);
        }
      }
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
            // A loop (pedals, strokes) runs evenly and holds mid-stroke when still.
            t: _pace.loop ? (still ? 0.3 : _controller.value) : (still ? 1 : Curves.easeInOut.transform(_controller.value)),
            ghost: still && widget.animate && widget.kind != MoveKind.rest && !_pace.loop,
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
    this.farElbow,
    this.farHand,
  });

  final Offset head, shoulder, elbow, hand, hip, knee, ankle, heel, toe, farKnee, farAnkle, farHeel, farToe;

  /// The far arm, when the move shows it.
  final Offset? farElbow, farHand;

  _Pose shift(Offset by) => _Pose(
    head: head + by,
    shoulder: shoulder + by,
    elbow: elbow + by,
    hand: hand + by,
    hip: hip + by,
    knee: knee + by,
    ankle: ankle + by,
    heel: heel + by,
    toe: toe + by,
    farKnee: farKnee + by,
    farAnkle: farAnkle + by,
    farHeel: farHeel + by,
    farToe: farToe + by,
    farElbow: farElbow == null ? null : farElbow! + by,
    farHand: farHand == null ? null : farHand! + by,
  );

  static _Pose lerp(_Pose a, _Pose b, double t) {
    Offset l(Offset x, Offset y) => Offset.lerp(x, y, t)!;
    return _Pose(
      head: l(a.head, b.head),
      shoulder: l(a.shoulder, b.shoulder),
      elbow: l(a.elbow, b.elbow),
      hand: l(a.hand, b.hand),
      hip: l(a.hip, b.hip),
      knee: l(a.knee, b.knee),
      ankle: l(a.ankle, b.ankle),
      heel: l(a.heel, b.heel),
      toe: l(a.toe, b.toe),
      farKnee: l(a.farKnee, b.farKnee),
      farAnkle: l(a.farAnkle, b.farAnkle),
      farHeel: l(a.farHeel, b.farHeel),
      farToe: l(a.farToe, b.farToe),
      farElbow: a.farElbow == null || b.farElbow == null ? null : l(a.farElbow!, b.farElbow!),
      farHand: a.farHand == null || b.farHand == null ? null : l(a.farHand!, b.farHand!),
    );
  }
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


/// A direction [a] radians from straight down, positive towards the front (right).
Offset _dir(double a) => Offset(math.sin(a), math.cos(a));

/// A foot at the end of a shin at angle [shin], pointing forward, flexed by [flex].
({Offset heel, Offset toe}) _footAt(Offset ankle, double shin, [double flex = 0]) {
  final a = shin + flex;
  final forward = Offset(math.cos(a), -math.sin(a));
  return (heel: ankle + _dir(a) * 3 - forward * 2, toe: ankle + forward * 12 + _dir(a) * 3);
}

/// The knee between [hip] and [ankle] for a thigh of [thigh] and a shin of [shin], bent forward.
Offset _knee(Offset hip, Offset ankle, {double thigh = 23, double shin = 22}) {
  final v = ankle - hip;
  final d = v.distance.clamp(1.0, thigh + shin - 0.01);
  final u = v / v.distance;
  final a = math.acos(((thigh * thigh + d * d - shin * shin) / (2 * thigh * d)).clamp(-1.0, 1.0));
  final one = hip + _turn(u, a) * thigh;
  final other = hip + _turn(u, -a) * thigh;
  return one.dx > other.dx ? one : other;
}

/// A side-view body from joint angles (radians from straight down, positive forward), set on the
/// ground unless [ground] is false.
_Pose _side({
  required Offset hip,
  double lean = 0,
  required double nearThigh,
  required double nearShin,
  required double farThigh,
  required double farShin,
  required double nearUpper,
  required double nearFore,
  required double farUpper,
  required double farFore,
  bool ground = true,
}) {
  final up = Offset(math.sin(lean), -math.cos(lean));
  final shoulder = hip + up * 27;
  final knee = hip + _dir(nearThigh) * 23;
  final ankle = knee + _dir(nearShin) * 22;
  final farKnee = hip + _dir(farThigh) * 23;
  final farAnkle = farKnee + _dir(farShin) * 22;
  final foot = _footAt(ankle, nearShin);
  final farFoot = _footAt(farAnkle, farShin);
  final elbow = shoulder + _dir(nearUpper) * 15;
  final farElbow = shoulder + _dir(farUpper) * 15;
  final pose = _Pose(
    head: shoulder + up * 11 + const Offset(1.5, 0),
    shoulder: shoulder,
    elbow: elbow,
    hand: elbow + _dir(nearFore) * 14,
    hip: hip,
    knee: knee,
    ankle: ankle,
    heel: foot.heel,
    toe: foot.toe,
    farKnee: farKnee,
    farAnkle: farAnkle,
    farHeel: farFoot.heel,
    farToe: farFoot.toe,
    farElbow: farElbow,
    farHand: farElbow + _dir(farFore) * 14,
  );
  if (!ground) return pose;
  final lowest = [pose.heel, pose.toe, pose.farHeel, pose.farToe].map((o) => o.dy).reduce(math.max);
  return pose.shift(Offset(0, _ground - lowest));
}

/// Opposite arm and leg swing; [t] goes from the near leg forward to the far leg forward.
_Pose _stride(double t, {required bool run}) {
  final s = 1 - 2 * t;
  // The leg behind bends at the knee; running bends it further and lifts it.
  double shin(double thigh) => thigh > 0 ? thigh - (run ? 0.5 : 0.1) : thigh - (run ? 1.2 : 0.45);
  final leg = run ? 0.7 : 0.38;
  final arm = run ? 0.75 : 0.4;
  final nearThigh = leg * s;
  final farThigh = -leg * s;
  return _side(
    hip: const Offset(48, 60),
    lean: run ? 0.2 : 0.04,
    nearThigh: nearThigh,
    nearShin: shin(nearThigh),
    farThigh: farThigh,
    farShin: shin(farThigh),
    nearUpper: -arm * s,
    nearFore: -arm * s + (run ? 1.5 : 0.35),
    farUpper: arm * s,
    farFore: arm * s + (run ? 1.5 : 0.35),
  );
}

/// On a bike: the hip on the saddle, hands on the bars, feet on pedals going round once per [t].
_Pose _cycle(double t) {
  const hip = Offset(42, 60);
  const crank = Offset(53, 97);
  final a = 2 * math.pi * t;
  Offset pedal(double angle) => crank + Offset(math.cos(angle), math.sin(angle)) * 9 - const Offset(0, 3);
  final ankle = pedal(a);
  final farAnkle = pedal(a + math.pi);
  final foot = _footAt(ankle, 0.2);
  final farFoot = _footAt(farAnkle, 0.2);
  const shoulder = Offset(63, 40);
  return _Pose(
    head: const Offset(71, 32),
    shoulder: shoulder,
    elbow: const Offset(70, 50),
    hand: const Offset(77, 57),
    hip: hip,
    knee: _knee(hip, ankle),
    ankle: ankle,
    heel: foot.heel,
    toe: foot.toe,
    farKnee: _knee(hip, farAnkle),
    farAnkle: farAnkle,
    farHeel: farFoot.heel,
    farToe: farFoot.toe,
  );
}

/// A bodyweight squat: hips back and down, knees forward, arms out front for balance.
_Pose _squat(double t) {
  const ankle = Offset(52, _ground - 3);
  final hip = Offset.lerp(const Offset(50, 62), const Offset(36, 84), t)!;
  final knee = _knee(hip, ankle);
  final lean = 0.05 + 0.6 * t;
  final up = Offset(math.sin(lean), -math.cos(lean));
  final shoulder = hip + up * 27;
  final reach = 0.25 + 1.3 * t;
  final elbow = shoulder + _dir(reach) * 15;
  final foot = _footAt(ankle, 0);
  return _Pose(
    head: shoulder + up * 11 + const Offset(1.5, 0),
    shoulder: shoulder,
    elbow: elbow,
    hand: elbow + _dir(reach) * 14,
    hip: hip,
    knee: knee,
    ankle: ankle,
    heel: foot.heel,
    toe: foot.toe,
    farKnee: knee - const Offset(2, 0),
    farAnkle: ankle - const Offset(2, 0),
    farHeel: foot.heel - const Offset(2, 0),
    farToe: foot.toe - const Offset(2, 0),
  );
}

/// Jumping jacks, from the front: feet together and arms down, then apart and up, off the ground.
_Pose _jumpingJack(double t) => _Pose.lerp(
  const _Pose(
    head: Offset(50, 22),
    shoulder: Offset(50, 33),
    elbow: Offset(42, 47),
    hand: Offset(41, 61),
    hip: Offset(50, 60),
    knee: Offset(46, 84),
    ankle: Offset(45, 106),
    heel: Offset(46, 110),
    toe: Offset(39, 112),
    farKnee: Offset(54, 84),
    farAnkle: Offset(55, 106),
    farHeel: Offset(54, 110),
    farToe: Offset(61, 112),
    farElbow: Offset(58, 47),
    farHand: Offset(59, 61),
  ),
  const _Pose(
    head: Offset(50, 15),
    shoulder: Offset(50, 26),
    elbow: Offset(38, 17),
    hand: Offset(31, 6),
    hip: Offset(50, 53),
    knee: Offset(40, 76),
    ankle: Offset(32, 98),
    heel: Offset(33, 102),
    toe: Offset(26, 104),
    farKnee: Offset(60, 76),
    farAnkle: Offset(68, 98),
    farHeel: Offset(67, 102),
    farToe: Offset(74, 104),
    farElbow: Offset(62, 17),
    farHand: Offset(69, 6),
  ),
  t,
);

/// Tree pose, from the front: one foot against the other leg, hands rising from the chest to overhead.
_Pose _tree(double t) => _Pose.lerp(
  const _Pose(
    head: Offset(50, 22),
    shoulder: Offset(50, 33),
    elbow: Offset(41, 46),
    hand: Offset(49, 41),
    hip: Offset(50, 60),
    knee: Offset(34, 75),
    ankle: Offset(49, 83),
    heel: Offset(50, 80),
    toe: Offset(49, 90),
    farKnee: Offset(52, 84),
    farAnkle: Offset(52, 106),
    farHeel: Offset(51, 110),
    farToe: Offset(58, 112),
    farElbow: Offset(59, 46),
    farHand: Offset(51, 41),
  ),
  const _Pose(
    head: Offset(50, 22),
    shoulder: Offset(50, 33),
    elbow: Offset(43, 18),
    hand: Offset(49, 5),
    hip: Offset(50, 60),
    knee: Offset(34, 75),
    ankle: Offset(49, 83),
    heel: Offset(50, 80),
    toe: Offset(49, 90),
    farKnee: Offset(52, 84),
    farAnkle: Offset(52, 106),
    farHeel: Offset(51, 110),
    farToe: Offset(58, 112),
    farElbow: Offset(57, 18),
    farHand: Offset(51, 5),
  ),
  t,
);

/// Front crawl: lying along the water, arms turning over once per [t], legs fluttering.
_Pose _swim(double t) {
  const shoulder = Offset(64, 64);
  const hip = Offset(37, 66);
  final a = 2 * math.pi * t;
  Offset arm(double angle, double length) => shoulder + Offset(math.cos(angle), math.sin(angle)) * length;
  final kick = math.sin(4 * math.pi * t) * 4;
  Offset legPoint(double x, double y, double k) => Offset(x, y + k);
  return _Pose(
    head: const Offset(75, 61),
    shoulder: shoulder,
    elbow: arm(a - 0.35, 14),
    hand: arm(a, 27),
    hip: hip,
    knee: legPoint(25, 67, kick * 0.5),
    ankle: legPoint(13, 66, kick),
    heel: legPoint(12, 63, kick),
    toe: legPoint(3, 67, kick),
    farKnee: legPoint(25, 67, -kick * 0.5),
    farAnkle: legPoint(13, 66, -kick),
    farHeel: legPoint(12, 63, -kick),
    farToe: legPoint(3, 67, -kick),
    farElbow: arm(a + math.pi - 0.35, 14),
    farHand: arm(a + math.pi, 27),
  );
}

/// A forehand: racket arm from the backswing through the ball to a high follow-through.
_Pose _tennis(double t) => _side(
  hip: const Offset(46, 60),
  lean: 0.1,
  nearThigh: 0.35,
  nearShin: 0.15,
  farThigh: -0.35,
  farShin: -0.45,
  nearUpper: -1.5 + 4.0 * t,
  nearFore: -1.3 + 4.2 * t,
  farUpper: 1.4 - 1.2 * t,
  farFore: 1.6 - 1.2 * t,
);

/// A slow overhead reach: arms from the sides to straight up.
_Pose _reach(double t) => _side(
  hip: const Offset(50, 60),
  nearThigh: 0,
  nearShin: 0,
  farThigh: -0.02,
  farShin: -0.02,
  nearUpper: 0.1 + 2.95 * t,
  nearFore: 0.15 + 2.95 * t,
  farUpper: 0.05 + 2.95 * t,
  farFore: 0.1 + 2.95 * t,
);

_Pose _poseFor(MoveKind kind, double t) => switch (kind) {
  MoveKind.calfRaise => _standing(lift: t, oneLeg: false, holdWall: true),
  MoveKind.singleLegLeft || MoveKind.singleLegRight => _standing(lift: t, oneLeg: true, holdWall: true),
  MoveKind.soleusPushUp => _soleus(t),
  MoveKind.anklePump => _anklePump(t),
  MoveKind.rest => _standing(lift: 0, oneLeg: false, holdWall: false),
  MoveKind.walk => _stride(t, run: false),
  MoveKind.run => _stride(t, run: true),
  MoveKind.cycle => _cycle(t),
  MoveKind.squat => _squat(t),
  MoveKind.jumpingJack => _jumpingJack(t),
  MoveKind.tree => _tree(t),
  MoveKind.swim => _swim(t),
  MoveKind.tennis => _tennis(t),
  MoveKind.reach => _reach(t),
};

/// The part drawn in the accent colour: the muscle doing the work.
enum _Working { calf, thigh, arm, none }

_Working _workingOf(MoveKind kind) => switch (kind) {
  MoveKind.cycle || MoveKind.squat || MoveKind.jumpingJack || MoveKind.run => _Working.thigh,
  MoveKind.swim || MoveKind.tennis => _Working.arm,
  MoveKind.tree || MoveKind.reach => _Working.none,
  _ => _Working.calf,
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
    if (kind != MoveKind.swim) canvas.drawLine(const Offset(8, _ground + 1.5), const Offset(96, _ground + 1.5), line);
    switch (kind) {
      case MoveKind.cycle:
        final frame = _stroke(props, 2.4);
        canvas.drawCircle(const Offset(28, 99), 13, frame);
        canvas.drawCircle(const Offset(80, 99), 13, frame);
        canvas.drawPath(
          Path()
            ..moveTo(28, 99)
            ..lineTo(53, 97)
            ..lineTo(42, 62)
            ..lineTo(28, 99)
            ..moveTo(53, 97)
            ..lineTo(73, 64)
            ..lineTo(43, 66)
            ..moveTo(73, 64)
            ..lineTo(80, 99)
            ..moveTo(73, 64)
            ..lineTo(76, 56)
            ..lineTo(80, 56)
            ..moveTo(37, 61)
            ..lineTo(47, 61),
          frame,
        );
        canvas.drawCircle(const Offset(53, 97), 9, _stroke(props, 1.4));
      case MoveKind.swim:
        // The water's surface, rippling over the swimmer's back.
        final water = _stroke(accent.withValues(alpha: 0.6), 2.4);
        final path = Path()..moveTo(2, 60);
        for (var x = 2.0; x < 98; x += 12) {
          path.quadraticBezierTo(x + 3, 56, x + 6, 60);
          path.quadraticBezierTo(x + 9, 64, x + 12, 60);
        }
        canvas.drawPath(path, water);
      case MoveKind.tree:
        canvas.drawLine(const Offset(30, _ground + 1.5), const Offset(70, _ground + 1.5), _stroke(accent.withValues(alpha: 0.5), 4));
      case MoveKind.tennis:
        canvas.drawCircle(const Offset(88, 48), 3.5, Paint()..color = accent);
      case MoveKind.walk || MoveKind.run || MoveKind.squat || MoveKind.jumpingJack || MoveKind.reach:
        break;
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

    final working = _workingOf(kind);
    final muscle = _stroke(c(accent), 9.5);

    // Far side first, so the near side covers it.
    if (p.farElbow != null && p.farHand != null) {
      canvas.drawPath(Path()..addPolygon([p.shoulder, p.farElbow!, p.farHand!], false), _stroke(c(far), 5.5));
    }
    canvas.drawPath(Path()..addPolygon([p.hip, p.farKnee, p.farAnkle], false), _stroke(c(far), 7.5));
    _foot(canvas, p.farAnkle, p.farHeel, p.farToe, c(far));

    canvas.drawLine(p.shoulder, p.hip, _stroke(c(body), 12));
    canvas.drawLine(p.hip, p.knee, limb);
    canvas.drawLine(p.knee, p.ankle, limb);
    switch (working) {
      // The calf sits on the upper shin; the thigh's front between hip and knee.
      case _Working.calf:
        canvas.drawLine(Offset.lerp(p.knee, p.ankle, 0.15)!, Offset.lerp(p.knee, p.ankle, 0.8)!, muscle);
      case _Working.thigh:
        canvas.drawLine(Offset.lerp(p.hip, p.knee, 0.2)!, Offset.lerp(p.hip, p.knee, 0.85)!, muscle);
      case _Working.arm || _Working.none:
        break;
    }
    _foot(canvas, p.ankle, p.heel, p.toe, c(body));
    canvas.drawPath(Path()..addPolygon([p.shoulder, p.elbow, p.hand], false), _stroke(c(body), 5.5));
    if (working == _Working.arm) canvas.drawLine(Offset.lerp(p.shoulder, p.elbow, 0.15)!, p.elbow, _stroke(c(accent), 7.5));
    if (kind == MoveKind.tennis) {
      // The racket carries on from the forearm.
      final along = (p.hand - p.elbow) / (p.hand - p.elbow).distance;
      final head = p.hand + along * 14;
      canvas.drawLine(p.hand, p.hand + along * 7, _stroke(c(body), 3));
      canvas.drawOval(Rect.fromCenter(center: head, width: 11, height: 11), _stroke(c(body), 2.6));
    }
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
