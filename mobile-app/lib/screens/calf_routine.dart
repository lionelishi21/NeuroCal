import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/move_figure.dart';
import '../widgets/sheet.dart';

/// One move in the routine, or a rest when [how] is empty. [figure] demonstrates it.
typedef CalfMove = ({String name, String how, int seconds, MoveKind figure});

/// Five minutes, mostly doable at a desk. Soleus push-ups are the seated move from Hamilton et al.
/// (iScience, 2022).
const calfRoutine = <CalfMove>[
  (
    name: 'Standing calf raises',
    how: 'Rise onto your toes, then lower your heels slowly. Hold a wall or chair if you need to.',
    seconds: 45,
    figure: MoveKind.calfRaise,
  ),
  (name: 'Rest', how: '', seconds: 15, figure: MoveKind.rest),
  (
    name: 'Seated soleus push-ups',
    how: 'Sit with your feet flat and knees bent. Lift your heels while your toes stay down, then let them drop.',
    seconds: 60,
    figure: MoveKind.soleusPushUp,
  ),
  (name: 'Rest', how: '', seconds: 15, figure: MoveKind.rest),
  (
    name: 'Single-leg raises, left',
    how: 'Stand on your left foot, rise and lower. Hold on for balance.',
    seconds: 30,
    figure: MoveKind.singleLegLeft,
  ),
  (name: 'Single-leg raises, right', how: 'Now the right foot.', seconds: 30, figure: MoveKind.singleLegRight),
  (name: 'Rest', how: '', seconds: 15, figure: MoveKind.rest),
  (
    name: 'Seated soleus push-ups',
    how: 'Back in the chair: heels up, heels down, steady.',
    seconds: 60,
    figure: MoveKind.soleusPushUp,
  ),
  (
    name: 'Ankle pumps',
    how: 'Legs out, point your toes away, then pull them back toward you.',
    seconds: 30,
    figure: MoveKind.anklePump,
  ),
];

/// Runs the routine full screen and logs it. Returns what was logged, or null when left early.
Future<Exercise?> showCalfRoutine(BuildContext context) =>
    Navigator.of(context)
        .push(MaterialPageRoute<Exercise>(fullscreenDialog: true, builder: (_) => const CalfRoutineScreen()));

class CalfRoutineScreen extends StatefulWidget {
  const CalfRoutineScreen({super.key});

  @override
  State<CalfRoutineScreen> createState() => _CalfRoutineScreenState();
}

class _CalfRoutineScreenState extends State<CalfRoutineScreen> {
  /// -1 before it starts; calfRoutine.length when it's done.
  var _move = -1;
  var _left = 0;
  var _paused = false;
  var _elapsed = 0;
  Timer? _timer;
  var _busy = false;
  var _failed = false;

  bool get _done => _move >= calfRoutine.length;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _start() {
    _go(0);
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  void _go(int move) {
    HapticFeedback.mediumImpact();
    setState(() {
      _move = move;
      _left = move < calfRoutine.length ? calfRoutine[move].seconds : 0;
    });
    if (_done) _timer?.cancel();
  }

  void _tick() {
    if (_paused || _done) return;
    _elapsed++;
    if (_left > 1) {
      setState(() => _left--);
    } else {
      _go(_move + 1);
    }
  }

  Future<void> _log() async {
    setState(() {
      _busy = true;
      _failed = false;
    });
    try {
      final minutes = math.max(1, (_elapsed / 60).round());
      final logged = await AppScope.of(context).api.logExercise(ExerciseKind.calf, ExerciseIntensity.light, minutes);
      if (mounted) Navigator.of(context).pop(logged);
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _failed = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.mist,
      appBar: AppBar(title: const Text('Calf pump'), backgroundColor: c.mist, surfaceTintColor: Colors.transparent),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Space.s4, 0, Space.s4, Space.s4),
          child: _move < 0
              ? _intro(context)
              : _done
              ? _finished(context)
              : _running(context),
        ),
      ),
    );
  }

  Widget _intro(BuildContext context) {
    final c = context.colors;
    final total = calfRoutine.fold(0, (s, m) => s + m.seconds);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: Space.s3,
      children: [
        Expanded(
          child: ListView(
            children: [
              Text(
                'Your calves pump blood from your legs back up to your heart, which is why they get called a second heart. Hours of sitting slow that pump down.',
                style: TextStyle(fontSize: TextSize.md, height: 1.45, color: c.ink),
              ),
              const SizedBox(height: Space.s3),
              Text(
                'This routine takes ${total ~/ 60} minutes and most of it works at a desk. It includes soleus push-ups, a seated move that kept blood sugar steadier after a meal in a 2022 study.',
                style: TextStyle(fontSize: TextSize.sm, height: 1.45, color: c.inkSoft),
              ),
              const SizedBox(height: Space.s4),
              for (final m in calfRoutine.where((m) => m.how.isNotEmpty))
                Padding(
                  padding: const EdgeInsets.only(bottom: Space.s2),
                  child: Row(
                    spacing: Space.s3,
                    children: [
                      SizedBox(width: 44, height: 52, child: MoveFigure(m.figure, animate: false)),
                      Expanded(
                        child: Text(
                          m.name,
                          style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
                        ),
                      ),
                      Text(
                        '${m.seconds} s',
                        style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        SheetAction(label: 'Start', onPressed: _start),
      ],
    );
  }

  Widget _running(BuildContext context) {
    final c = context.colors;
    final m = calfRoutine[_move];
    final rest = m.how.isEmpty;
    final next = _move + 1 < calfRoutine.length ? calfRoutine[_move + 1] : null;
    final ink = rest ? c.ionInk : c.chlorophyll;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: Space.s3,
      children: [
        Text(
          '${_move + 1} of ${calfRoutine.length}',
          style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.inkSoft),
        ),
        Text(
          m.name,
          style: const TextStyle(fontSize: TextSize.xxl, fontWeight: FontWeight.w800, height: 1.2),
        ),
        Text(
          rest ? 'Shake your legs out.' : m.how,
          style: TextStyle(fontSize: TextSize.md, height: 1.4, color: c.inkSoft),
        ),
        Expanded(
          child: MoveFigure(m.figure, animate: !_paused, accent: ink),
        ),
        Center(
          child: Semantics(
            liveRegion: true,
            label: '$_left seconds left',
            excludeSemantics: true,
            child: SizedBox.square(
              dimension: 120,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox.expand(
                    child: CircularProgressIndicator(
                      value: _left / m.seconds,
                      strokeWidth: 8,
                      strokeCap: StrokeCap.round,
                      backgroundColor: c.track,
                      color: ink,
                    ),
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('$_left', style: const TextStyle(fontSize: 44, fontWeight: FontWeight.w800, height: 1)),
                      if (!rest)
                        Text(
                          'Up 1 s, down 1 s',
                          style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
        if (next != null)
          Text(
            'Next: ${next.name}',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
          ),
        Row(
          spacing: Space.s2,
          children: [
            Expanded(
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(56),
                  side: BorderSide(color: c.ruleStrong, width: 1.5),
                ),
                onPressed: () => setState(() => _paused = !_paused),
                child: Text(_paused ? 'Resume' : 'Pause'),
              ),
            ),
            Expanded(
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(56),
                  side: BorderSide(color: c.ruleStrong, width: 1.5),
                ),
                onPressed: () => _go(_move + 1),
                child: const Text('Skip'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _finished(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: Space.s3,
      children: [
        const Spacer(),
        Icon(Icons.check_circle_rounded, size: 72, color: c.chlorophyll),
        const Text(
          'Routine done',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: TextSize.xxl, fontWeight: FontWeight.w800),
        ),
        Text(
          'Repeat it whenever you have been sitting for an hour or two.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
        ),
        const Spacer(),
        if (_failed)
          const SheetNote(lead: "Couldn't log your exercise.", detail: 'Check your connection and try again.'),
        SheetAction(label: _busy ? 'Logging…' : 'Log exercise', onPressed: _busy ? null : _log),
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(),
          child: const Text('Close without logging'),
        ),
      ],
    );
  }
}
