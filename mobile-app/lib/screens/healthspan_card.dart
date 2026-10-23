import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/ui.dart';

/// Healthspan: this week's longevity habits against their weekly targets, worked out from what's logged.
/// Loads on its own and hides itself if it can't, so the rest of the week still shows.
class HealthspanCard extends StatefulWidget {
  const HealthspanCard({super.key, required this.changes});

  final Listenable changes;

  @override
  State<HealthspanCard> createState() => _HealthspanCardState();
}

class _HealthspanCardState extends State<HealthspanCard> {
  Future<HealthspanWeek>? _week;

  @override
  void initState() {
    super.initState();
    widget.changes.addListener(_reload);
  }

  @override
  void dispose() {
    widget.changes.removeListener(_reload);
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _week ??= AppScope.of(context).api.healthspan();
  }

  void _reload() {
    setState(() {
      _week = AppScope.of(context).api.healthspan();
    });
  }

  @override
  Widget build(BuildContext context) => FutureBuilder(
    future: _week,
    builder: (context, snapshot) {
      final week = snapshot.data;
      if (week == null) return const SizedBox.shrink();
      final c = context.colors;
      final card = AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              spacing: Space.s3,
              children: [
                if (week.score case final score?) HealthspanRing(score, size: 56),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 2,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Semantics(
                              header: true,
                              child: const Text('Healthspan', style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800)),
                            ),
                          ),
                          Flexible(
                            child: Text(
                              '${week.done} of ${week.counted} this week',
                              textAlign: TextAlign.end,
                              style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: c.chlorophyll),
                            ),
                          ),
                        ],
                      ),
                      Text(
                        week.score == null
                            ? 'The weekly habits behind a long, healthy life.'
                            : 'Your longevity score: the weekly habits behind a long, healthy life, against where they should be by today.',
                        style: TextStyle(fontSize: TextSize.xs, height: 1.35, color: c.inkSoft),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: Space.s2),
            for (final h in week.habits) _Habit(h),
          ],
        ),
      );
      return Padding(padding: const EdgeInsets.only(bottom: Space.s3), child: card);
    },
  );
}

class _Habit extends StatelessWidget {
  const _Habit(this.h);

  final HealthspanHabit h;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final skipped = h.skipped != null;
    // "%" is a share to stay under; everything else is a count to reach.
    final lowerIsBetter = h.unit == '%';
    final shown = '${h.progress.round()}';
    final amount = lowerIsBetter ? '$shown% (under ${h.target.round()}%)' : '$shown / ${h.target.round()} ${h.unit}';
    final fraction = lowerIsBetter ? (h.done ? 1.0 : (h.target / (h.progress == 0 ? 1 : h.progress)).clamp(0.0, 1.0)) : (h.progress / h.target).clamp(0.0, 1.0);
    return Semantics(
      container: true,
      label: '${h.title}: ${skipped ? 'left out. ${h.skipped}' : '$amount${h.done ? ', done' : ''}. ${h.detail}'}',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: Space.s2),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: Space.s3,
          children: [
            Icon(
              skipped
                  ? Icons.remove_circle_outline_rounded
                  : h.done
                  ? Icons.check_circle_rounded
                  : Icons.radio_button_unchecked_rounded,
              size: 22,
              color: h.done && !skipped ? c.chlorophyll : c.inkFaint,
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 2,
                children: [
                  // Title and amount side by side; the amount moves under the title when large text needs the room.
                  Wrap(
                    alignment: WrapAlignment.spaceBetween,
                    spacing: Space.s2,
                    children: [
                      Text(h.title, style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: skipped ? c.inkSoft : c.ink)),
                      if (!skipped) Text(amount, style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: c.inkSoft)),
                    ],
                  ),
                  if (!skipped)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(Radii.pill),
                      child: LinearProgressIndicator(value: fraction, minHeight: 5, backgroundColor: c.track, color: h.done ? c.chlorophyll : c.synapse),
                    ),
                  Text(skipped ? h.skipped! : h.detail, style: TextStyle(fontSize: TextSize.xs, height: 1.3, color: c.inkSoft)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The healthspan score, 0–100, in a green ring.
class HealthspanRing extends StatelessWidget {
  const HealthspanRing(this.score, {super.key, this.size = 40});

  final int score;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      label: 'Healthspan score $score out of 100',
      excludeSemantics: true,
      child: SizedBox.square(
        dimension: size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            SizedBox.expand(
              child: CircularProgressIndicator(
                value: score / 100,
                strokeWidth: size / 12,
                strokeCap: StrokeCap.round,
                backgroundColor: c.track,
                color: c.chlorophyllBar,
              ),
            ),
            Text('$score', style: TextStyle(fontSize: size * 0.36, fontWeight: FontWeight.w800, color: c.ink)),
          ],
        ),
      ),
    );
  }
}
