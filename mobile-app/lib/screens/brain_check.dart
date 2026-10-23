import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/sheet.dart';

/// The Brain speed check: a light appears at random moments and you tap as fast as you can, for about
/// two minutes. After the Psychomotor Vigilance Task used in sleep research. Returns the scored check,
/// or null if they left before finishing.
Future<BrainCheck?> showBrainCheck(BuildContext context) =>
    Navigator.of(context).push<BrainCheck>(MaterialPageRoute(fullscreenDialog: true, builder: (_) => const BrainCheckScreen()));

enum _Phase { intro, waiting, light, feedback, saving, done, failed }

class BrainCheckScreen extends StatefulWidget {
  const BrainCheckScreen({
    super.key,
    this.duration = const Duration(minutes: 2),
    this.minWaitMs = 2000,
    this.maxWaitMs = 6000,
    this.minTrials = 10,
    this.random,
    this.now,
    this.note,
    this.skipLabel,
    this.doneLabel = 'Done',
  });

  /// Replaces the intro's second paragraph (when to do it and what the score is compared with).
  final String? note;

  /// Shown under Start when the check can be left for later (onboarding); leaving returns null.
  final String? skipLabel;
  final String doneLabel;

  /// How long the check runs; it also needs [minTrials] reactions before it ends.
  final Duration duration;
  final int minWaitMs;
  final int maxWaitMs;
  final int minTrials;

  /// Fixed in tests so the waits are known.
  final Random? random;

  /// The time source; a monotonic stopwatch unless a test supplies its fake clock.
  final DateTime Function()? now;

  @override
  State<BrainCheckScreen> createState() => _BrainCheckScreenState();
}

class _BrainCheckScreenState extends State<BrainCheckScreen> {
  late final _random = widget.random ?? Random();
  // A stopwatch, not the wall clock: the time of day can jump (network time, time zones).
  final _monotonic = Stopwatch()..start();
  late final _epoch = DateTime.now();
  DateTime _now() => widget.now?.call() ?? _epoch.add(_monotonic.elapsed);
  DateTime? _startedAt;
  DateTime? _lightAt;
  Duration get _elapsed => _startedAt == null ? Duration.zero : _now().difference(_startedAt!);
  final _reactions = <int>[];
  var _falseStarts = 0;
  var _phase = _Phase.intro;
  Timer? _timer;
  String _feedback = '';
  BrainCheck? _result;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _start() {
    _reactions.clear();
    _falseStarts = 0;
    _startedAt = _now();
    _wait();
  }

  void _wait() {
    setState(() => _phase = _Phase.waiting);
    final ms = widget.minWaitMs + _random.nextInt(max(1, widget.maxWaitMs - widget.minWaitMs));
    _timer = Timer(Duration(milliseconds: ms), _showLight);
  }

  void _showLight() {
    setState(() => _phase = _Phase.light);
    // Time from the frame that actually shows the light, not from the request to draw it.
    WidgetsBinding.instance.addPostFrameCallback((_) => _lightAt = _now());
  }

  /// Raw finger-down events, not taps: tap detection would add its own delay to every reaction.
  void _onPointerDown(PointerDownEvent _) {
    switch (_phase) {
      case _Phase.waiting:
        _timer?.cancel();
        _falseStarts++;
        _showFeedback('Too soon. Wait for the light.');
      case _Phase.light:
        final ms = _lightAt == null ? 0 : _now().difference(_lightAt!).inMilliseconds;
        _lightAt = null;
        if (ms < 100) {
          // Faster than anyone can react: it was a guess.
          _falseStarts++;
          _showFeedback('Too soon. Wait for the light.');
        } else {
          _reactions.add(min(ms, 5000));
          unawaited(HapticFeedback.selectionClick());
          _showFeedback('$ms ms');
        }
      default:
        break;
    }
  }

  void _showFeedback(String text) {
    setState(() {
      _phase = _Phase.feedback;
      _feedback = text;
    });
    _timer = Timer(const Duration(milliseconds: 700), () {
      if (_elapsed >= widget.duration && _reactions.length >= widget.minTrials) {
        _save();
      } else {
        _wait();
      }
    });
  }

  Future<void> _save() async {
    setState(() => _phase = _Phase.saving);
    try {
      final check = await AppScope.of(context).api.addBrainCheck(List.of(_reactions), _falseStarts);
      if (mounted) {
        setState(() {
          _result = check;
          _phase = _Phase.done;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _phase = _Phase.failed);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final testing = _phase == _Phase.waiting || _phase == _Phase.light || _phase == _Phase.feedback;
    return Scaffold(
      backgroundColor: testing ? c.ink : c.mist,
      body: SafeArea(
        child: switch (_phase) {
          _Phase.intro => _intro(context),
          _Phase.waiting || _Phase.light || _Phase.feedback => _test(context),
          _Phase.saving => const Center(child: CircularProgressIndicator()),
          _Phase.done => _done(context, _result!),
          _Phase.failed => _failed(context),
        },
      ),
    );
  }

  Widget _intro(BuildContext context) {
    final c = context.colors;
    final minutes = widget.duration.inMinutes;
    return _fitOrScroll(Padding(
      padding: const EdgeInsets.all(Space.s5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s4,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: IconButton(tooltip: 'Close', icon: const Icon(Icons.close_rounded), onPressed: () => Navigator.of(context).pop()),
          ),
          const Text('Brain speed check', style: TextStyle(fontSize: TextSize.xxl, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
          Text(
            'A light appears at random moments. Tap anywhere as fast as you can when it does, and not before. '
            'It takes ${minutes < 1 ? 'under a minute' : 'about $minutes minutes'}.',
            style: TextStyle(fontSize: TextSize.md, height: 1.45, color: c.inkSoft),
          ),
          Text(
            widget.note ??
                'Do it at about the same time each day, sitting down, with notifications off. Your score is compared with your own usual, '
                    "so you can see which days you're sharper. It's a self-check, not a medical test.",
            style: TextStyle(fontSize: TextSize.sm, height: 1.45, color: c.inkSoft),
          ),
          const Spacer(),
          SheetAction(label: 'Start', onPressed: _start),
          if (widget.skipLabel != null) TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(widget.skipLabel!)),
        ],
      ),
    ));
  }

  Widget _test(BuildContext context) {
    final c = context.colors;
    final left = widget.duration - _elapsed;
    return Listener(
      behavior: HitTestBehavior.opaque,
      onPointerDown: _onPointerDown,
      child: Semantics(
        liveRegion: true,
        label: switch (_phase) {
          _Phase.light => 'Tap now',
          _Phase.feedback => _feedback,
          _ => 'Wait for the light',
        },
        child: Stack(
          children: [
            Positioned(
              top: Space.s4,
              left: 0,
              right: 0,
              child: Text(
                left.isNegative ? 'Last few' : '${left.inSeconds ~/ 60}:${(left.inSeconds % 60).toString().padLeft(2, '0')} left',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.mist.withValues(alpha: 0.6), fontSize: TextSize.sm, fontWeight: FontWeight.w700),
              ),
            ),
            Center(
              child: switch (_phase) {
                _Phase.light => Container(
                  width: 160,
                  height: 160,
                  decoration: BoxDecoration(color: c.synapse, shape: BoxShape.circle),
                ),
                _Phase.feedback => Text(
                  _feedback,
                  style: TextStyle(color: c.mist, fontSize: TextSize.xxl, fontWeight: FontWeight.w800),
                ),
                _ => Text('Wait for the light', style: TextStyle(color: c.mist.withValues(alpha: 0.5), fontSize: TextSize.md)),
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _done(BuildContext context, BrainCheck r) {
    final c = context.colors;
    Widget stat(String value, String label) => Expanded(
      child: Column(
        children: [
          Text(value, style: const TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w800)),
          Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft)),
        ],
      ),
    );
    return _fitOrScroll(Padding(
      padding: const EdgeInsets.all(Space.s5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s4,
        children: [
          const Spacer(),
          Text('Brain speed', textAlign: TextAlign.center, style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.inkSoft)),
          // The reaction time leads; the score stays behind the scenes for your usual and your level.
          Text('${r.medianMs} ms', textAlign: TextAlign.center, style: const TextStyle(fontSize: 64, fontWeight: FontWeight.w800, height: 1)),
          Text('typical reaction', textAlign: TextAlign.center, style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft)),
          Row(children: [stat('${r.lapses}', 'slow responses'), stat('${r.falseStarts}', 'too soon')]),
          Text(
            r.lapses > 2
                ? 'Several slow responses: a sign of a tired brain. Sleep, daylight and a walk help more than coffee.'
                : 'Do it daily to build your usual; the app will show how sleep, food and fasting move it.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: TextSize.sm, height: 1.45, color: c.inkSoft),
          ),
          const Spacer(),
          SheetAction(label: widget.doneLabel, onPressed: () => Navigator.of(context).pop(r)),
        ],
      ),
    ));
  }

  /// Fills the screen so the button sits at the bottom, and scrolls when large text needs more room.
  Widget _fitOrScroll(Widget column) => LayoutBuilder(
    builder: (context, box) => SingleChildScrollView(
      child: ConstrainedBox(
        constraints: BoxConstraints(minHeight: box.maxHeight),
        child: IntrinsicHeight(child: column),
      ),
    ),
  );

  Widget _failed(BuildContext context) => Padding(
    padding: const EdgeInsets.all(Space.s5),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: Space.s3,
      children: [
        const Text("Couldn't save your check", style: TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800)),
        const Text('Your reactions are still here. Check your connection and try again.'),
        FilledButton(onPressed: _save, child: const Text('Try again')),
        TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(widget.skipLabel ?? 'Close without saving')),
      ],
    ),
  );
}
