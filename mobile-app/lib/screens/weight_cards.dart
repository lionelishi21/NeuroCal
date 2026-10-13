import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../api/models.dart';
import '../theme/tokens.dart';
import '../weight_units.dart';
import '../widgets/ui.dart';

String _hm(Duration d) {
  final m = d.inMinutes.clamp(0, 1 << 30);
  return '${m ~/ 60} h ${(m % 60).toString().padLeft(2, '0')} m';
}

String _clock(DateTime t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

/// The fasting timer: how long since the last meal against the goal, or how long the eating window
/// has left. Ticks every minute and asks for fresh numbers when a boundary passes.
class FastingCard extends StatefulWidget {
  const FastingCard(this.status, {super.key, required this.onBoundary});

  final FastingStatus status;

  /// The goal or the window's end has passed: reload.
  final VoidCallback onBoundary;

  @override
  State<FastingCard> createState() => _FastingCardState();
}

class _FastingCardState extends State<FastingCard> {
  Timer? _tick;
  var _reported = false;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 30), (_) => setState(() {}));
  }

  @override
  void didUpdateWidget(FastingCard old) {
    super.didUpdateWidget(old);
    if (old.status != widget.status) _reported = false;
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final s = widget.status;
    final now = DateTime.now();
    final label = fastingLabels[s.protocol] ?? s.protocol;
    final boundary = switch (s.kind) {
      FastingKind.fasting => s.goalAt,
      FastingKind.eating => s.closesAt,
      _ => null,
    };
    if (boundary != null && !now.isBefore(boundary) && !_reported) {
      _reported = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => widget.onBoundary());
    }

    final (title, detail, progress) = switch (s.kind) {
      FastingKind.fasting => (
        'Fasting · ${_hm(now.difference(s.since!))}',
        'Goal ${s.fastHours} h at ${_clock(s.goalAt!)}. ${_hm(s.goalAt!.difference(now))} to go.',
        now.difference(s.since!).inMinutes / (s.fastHours! * 60),
      ),
      FastingKind.fasted => (
        'Fast complete · ${_hm(now.difference(s.since!))}',
        'Your eating window opens with your next meal.',
        1.0,
      ),
      FastingKind.eating => (
        'Eating window open',
        'Closes at ${_clock(s.closesAt!)}, ${_hm(s.closesAt!.difference(now))} left. Your fast starts after your last meal.',
        null,
      ),
      _ => ('Fasting $label', 'Log a meal and the timer starts from it.', null),
    };

    return AppCard(
      padding: const EdgeInsets.all(Space.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s3,
        children: [
          Row(
            spacing: Space.s4,
            children: [
              SizedBox.square(
                dimension: 64,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CircularProgressIndicator(
                      value: progress?.clamp(0.0, 1.0) ?? (s.kind == FastingKind.eating ? 1 : 0),
                      strokeWidth: 6,
                      strokeCap: StrokeCap.round,
                      color: s.kind == FastingKind.eating ? c.glucose : c.synapse,
                      backgroundColor: c.track,
                    ),
                    Center(
                      child: Icon(
                        s.kind == FastingKind.eating ? Icons.restaurant_rounded : Icons.timelapse_rounded,
                        color: s.kind == FastingKind.eating ? c.glucose : c.synapse,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Semantics(
                  liveRegion: true,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 2,
                    children: [
                      Text(
                        '$label fast',
                        style: TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w700, color: c.inkSoft),
                      ),
                      Text(title, style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800)),
                      Text(detail, style: TextStyle(fontSize: TextSize.xs, height: 1.35, color: c.inkSoft)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (s.streakDays > 0 || s.kind == FastingKind.fasting)
            Text(
              [
                if (s.streakDays > 0) '${s.streakDays} ${s.streakDays == 1 ? 'day' : 'days'} in a row.',
                // The first days are the hardest: hunger at your usual meal times is mostly habit.
                if (s.kind == FastingKind.fasting && s.streakDays < 3)
                  'Hungry at your usual meal time? That habit hunger usually passes in 20–30 minutes. Water, tea or black coffee help.',
              ].join(' '),
              style: TextStyle(fontSize: TextSize.xxs, height: 1.4, color: c.inkSoft),
            ),
        ],
      ),
    );
  }
}

/// Weight: the smoothed trend, how far to the target, the weekly change and a small chart.
/// Without a goal it offers to set one.
class WeightCard extends StatelessWidget {
  const WeightCard(this.history, {super.key, required this.unit, required this.onLog, required this.onGoal});

  final WeightHistory history;
  final WeightUnit unit;
  final VoidCallback onLog;
  final VoidCallback onGoal;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final h = history;
    if (!h.hasGoal) {
      return AppCard(
        padding: const EdgeInsets.all(Space.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: Space.s2,
          children: [
            const Text('Set your weight goal', style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800)),
            Text(
              'Add your weight now and your target. We track the trend, not daily swings, and show when you’re on course to get there.',
              style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
            ),
            SoftButton(label: 'Set a goal', onPressed: onGoal),
          ],
        ),
      );
    }
    final change = h.weeklyChangeKg;
    final losing = change != null && change < 0;
    String months(String iso) {
      final d = DateTime.parse(iso);
      const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${d.day} ${names[d.month - 1]}';
    }

    return AppCard(
      padding: const EdgeInsets.all(Space.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s3,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 2,
                  children: [
                    Text('Weight trend', style: TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w700, color: c.inkSoft)),
                    Text(
                      unit.format(h.trendKg!),
                      style: const TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800, letterSpacing: -0.4),
                    ),
                    Text(
                      h.toGoKg == 0 ? 'Goal reached' : '${unit.format(h.toGoKg!)} to go to ${unit.format(h.targetKg!)}',
                      style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                    ),
                  ],
                ),
              ),
              IconButton(tooltip: 'Weight goal', icon: Icon(Icons.flag_outlined, color: c.inkSoft), onPressed: onGoal),
            ],
          ),
          if (h.entries.length > 1) SizedBox(height: 64, child: _Sparkline(h.entries, target: h.targetKg)),
          Text(
            [
              if (change == null)
                'Weigh in daily: the trend needs a week to settle.'
              else if (losing)
                '${unit.format(-change)} down this week.'
              else if (change == 0)
                'Flat this week.'
              else
                '${unit.format(change)} up this week. One week can be water; watch the next.',
              if (h.projectedOn != null && h.toGoKg != 0) 'At this rate you reach your goal around ${months(h.projectedOn!)}.',
              if (h.plannedWeeklyLossKg != null) 'Plan: ${unit.format(h.plannedWeeklyLossKg!)} a week.',
            ].join(' '),
            style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: losing ? c.chlorophyll : c.inkSoft),
          ),
          SoftButton(label: 'Log weight', onPressed: onLog),
        ],
      ),
    );
  }
}

/// The last weigh-ins as dots joined by a line, with the target as a dashed floor when it's in view.
class _Sparkline extends StatelessWidget {
  const _Sparkline(this.entries, {this.target});

  final List<WeighIn> entries;
  final double? target;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      label: 'Chart of your last ${entries.length} weigh-ins',
      child: CustomPaint(painter: _SparklinePainter(entries.length > 30 ? entries.sublist(entries.length - 30) : entries, target, line: c.synapse, faint: c.ruleStrong)),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  _SparklinePainter(this.entries, this.target, {required this.line, required this.faint});

  final List<WeighIn> entries;
  final double? target;
  final Color line;
  final Color faint;

  @override
  void paint(Canvas canvas, Size size) {
    final values = [for (final e in entries) e.kg];
    var lo = values.reduce(math.min);
    var hi = values.reduce(math.max);
    if (target != null && target! >= lo - 2) lo = math.min(lo, target!);
    if (hi - lo < 1) {
      hi += 0.5;
      lo -= 0.5;
    }
    double x(int i) => entries.length == 1 ? size.width / 2 : i * size.width / (entries.length - 1);
    double y(double kg) => 4 + (hi - kg) / (hi - lo) * (size.height - 8);

    if (target != null && target! >= lo && target! <= hi) {
      final dash = Paint()
        ..color = faint
        ..strokeWidth = 1;
      for (var dx = 0.0; dx < size.width; dx += 8) {
        canvas.drawLine(Offset(dx, y(target!)), Offset(math.min(dx + 4, size.width), y(target!)), dash);
      }
    }
    final path = Path()..moveTo(x(0), y(values[0]));
    for (var i = 1; i < values.length; i++) {
      path.lineTo(x(i), y(values[i]));
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = line
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeJoin = StrokeJoin.round,
    );
    final dot = Paint()..color = line;
    for (var i = 0; i < values.length; i++) {
      canvas.drawCircle(Offset(x(i), y(values[i])), 2.5, dot);
    }
  }

  @override
  bool shouldRepaint(_SparklinePainter old) => old.entries != entries || old.target != target || old.line != line;
}
