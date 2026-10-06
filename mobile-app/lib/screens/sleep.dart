import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../nights.dart';
import '../theme/tokens.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';
import 'sleep_sheets.dart';

const _nights = 7;

/// Sleep and evenings for the past week: each night on one clock (sleep, the last meal, late
/// screens), what the evenings did to sleep in plain sentences, and a table with every value.
class SleepScreen extends StatefulWidget {
  const SleepScreen({super.key, required this.changes, required this.onChanged});

  /// Fires when something was logged on any tab.
  final Listenable changes;
  final VoidCallback onChanged;

  @override
  State<SleepScreen> createState() => _SleepScreenState();
}

class _SleepScreenState extends State<SleepScreen> {
  Future<List<HistoryDay>>? _days;

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
    // A night is an evening plus the morning after, so seven nights need eight days.
    _days ??= AppScope.of(context).api.history(_nights + 1);
  }

  void _reload() => setState(() {
    _days = AppScope.of(context).api.history(_nights + 1);
  });

  Future<void> _log(Future<bool?> Function(BuildContext) sheet, String done) async {
    if (await sheet(context) == true && mounted) {
      showToast(context, done);
      widget.onChanged();
    }
  }

  void _logSleep() => _log(showLogSleepSheet, 'Sleep logged');

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return SafeArea(
      bottom: false,
      child: Stack(
        children: [
          FutureBuilder(
            future: _days,
            builder: (context, snapshot) {
              final nights = snapshot.hasData ? nightsFrom(snapshot.data!) : const <Night>[];
              final hasSleep = nights.any((n) => n.sleepMinutes != null);
              return ListView(
                padding: const EdgeInsets.fromLTRB(Space.s4, Space.s4, Space.s4, ActionBar.clearance + Space.s4),
                children: [
                  const ScreenTitle('Sleep and evenings', detail: 'Last $_nights nights'),
                  const SizedBox(height: 14),
                  if (snapshot.hasError)
                    ScreenFailed(
                      title: "Couldn't load your nights",
                      detail: 'Check your connection and try again.',
                      onRetry: _reload,
                    )
                  else if (!snapshot.hasData)
                    const ScreenLoading(label: 'Loading your nights', heights: [84, 300, 120])
                  else if (!hasSleep)
                    EmptyCard(
                      title: 'No sleep logged yet',
                      detail:
                          "Log last night and we'll put your sleep, last meal and late screens on one clock, so patterns are easy to spot.",
                      action: SoftButton(label: 'Log sleep', onPressed: _logSleep),
                    )
                  else ...[
                    _Figures(nights),
                    const SizedBox(height: Space.s3),
                    AppCard(
                      padding: const EdgeInsets.fromLTRB(14, Space.s4, 14, 14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'Your nights on one clock',
                            style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: Space.s2),
                          const _Legend(),
                          const SizedBox(height: 14),
                          ExcludeSemantics(child: _Clock(nights)),
                        ],
                      ),
                    ),
                    if (eveningInsights(nights).isNotEmpty) ...[
                      const BlockTitle('What we noticed'),
                      AppCard(
                        padding: EdgeInsets.zero,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            for (final (i, text) in eveningInsights(nights).indexed)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: Space.s4, vertical: 14),
                                decoration: BoxDecoration(
                                  border: i == 0 ? null : Border(top: BorderSide(color: c.rule)),
                                ),
                                child: Text(text, style: const TextStyle(fontSize: TextSize.md)),
                              ),
                          ],
                        ),
                      ),
                    ],
                    const BlockTitle('Every night'),
                    _NightTable(nights),
                  ],
                ],
              );
            },
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: ActionBar(
              children: [
                Expanded(
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(56),
                      padding: const EdgeInsets.symmetric(horizontal: Space.s2),
                      textStyle: const TextStyle(fontSize: TextSize.base, fontWeight: FontWeight.w700),
                    ),
                    onPressed: _logSleep,
                    child: const Text('Log sleep'),
                  ),
                ),
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(56),
                      padding: const EdgeInsets.symmetric(horizontal: Space.s2),
                      foregroundColor: c.synapseInk,
                      side: BorderSide(color: c.ruleStrong, width: 1.5),
                      textStyle: const TextStyle(fontSize: TextSize.base, fontWeight: FontWeight.w700),
                    ),
                    onPressed: () => _log(showLogScreenTimeSheet, 'Screen time logged'),
                    child: const FittedBox(fit: BoxFit.scaleDown, child: Text('Log screen time')),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

String _day(Night night) => weekdayShort[night.evening.weekday - 1];

/// The week's three headline numbers.
class _Figures extends StatelessWidget {
  const _Figures(this.nights);

  final List<Night> nights;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final average = averageSleep(nights);
    final late = nights.where(ateLate).length;
    final figures = [
      (average == null ? 'No data' : slept(average), 'Average sleep', false),
      (usualBedtime(nights) ?? 'No data', 'Usual bedtime', false),
      ('$late of ${nights.length}', 'Nights eaten after 9pm', late > 2),
    ];
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s2,
        children: [
          for (final (value, label, watch) in figures)
            Expanded(
              child: MergeSemantics(
                child: AppCard(
                  radius: 18,
                  padding: const EdgeInsets.all(Space.s3),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Text(
                          value,
                          style: TextStyle(
                            fontSize: TextSize.xl,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.4,
                            color: watch ? c.glucoseInk : c.ink,
                          ),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        label,
                        style: TextStyle(fontSize: TextSize.xxs, height: 1.3, color: c.inkSoft),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    Widget item(Widget swatch, String label) => Row(
      mainAxisSize: MainAxisSize.min,
      spacing: 6,
      children: [
        swatch,
        Text(
          label,
          style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft),
        ),
      ],
    );
    Widget bar(Color color, double height) => Container(
      width: 16,
      height: height,
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(Radii.pill)),
    );
    return Wrap(
      spacing: 14,
      runSpacing: 6,
      children: [
        item(bar(c.synapse, 8), 'Asleep'),
        item(
          Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(color: c.glucose, shape: BoxShape.circle),
          ),
          'Last meal',
        ),
        item(bar(c.ion, 4), 'Screens after $lateScreenFrom'),
      ],
    );
  }
}

/// Every night on one axis from 18:00 to noon: the bar is sleep, the dot the last meal, the thin
/// line screen time after 22:00, and the dashed line 21:00, where late eating starts to count.
class _Clock extends StatelessWidget {
  const _Clock(this.nights);

  final List<Night> nights;

  static const _row = 34.0;
  static const _labels = 40.0;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final tick = TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: c.inkFaint, height: 1);
    return LayoutBuilder(
      builder: (context, box) {
        final width = box.maxWidth - _labels;
        double x(double hours) => _labels + hours.clamp(0, axisHours) / axisHours * width;
        final height = nights.length * _row;
        return SizedBox(
          height: 16 + height + 18,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              for (final offset in const [0, 3, 6, 9, 12, 15, 18]) ...[
                Positioned(
                  left: x(offset.toDouble()) - (offset == 0 ? 0 : (offset == 18 ? 14 : 7)),
                  top: 0,
                  child: Text(((axisStartHour + offset) % 24).toString().padLeft(2, '0'), style: tick),
                ),
                Positioned(
                  left: x(offset.toDouble()),
                  top: 16,
                  height: height,
                  child: Container(width: 1, color: c.rule),
                ),
              ],
              Positioned(
                left: x(hoursIntoEvening(lateEatingFrom)),
                top: 12,
                height: height + 4,
                child: DashedLine(color: c.glucose, vertical: true),
              ),
              Positioned(
                left: x(hoursIntoEvening(lateEatingFrom)) - 14,
                top: 16 + height + 4,
                child: Text(
                  lateEatingFrom,
                  style: tick.copyWith(fontWeight: FontWeight.w700, color: c.glucoseInk),
                ),
              ),
              for (final (i, night) in nights.indexed) ...[
                Positioned(
                  left: 0,
                  top: 16 + i * _row,
                  height: _row,
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      _day(night),
                      style: const TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
                if (night.bedtime != null && night.wakeTime != null)
                  () {
                    final wake = hoursIntoEvening(night.wakeTime!);
                    final bed = hoursIntoEvening(night.bedtime!);
                    // A bedtime before 18:00 falls off the axis; start the bar at its edge.
                    final from = x(bed > wake ? 0 : bed);
                    return Positioned(
                      left: from,
                      width: (x(wake) - from).clamp(4, width),
                      top: 16 + i * _row + 9,
                      height: 12,
                      child: DecoratedBox(
                        decoration: BoxDecoration(color: c.synapse, borderRadius: BorderRadius.circular(Radii.pill)),
                      ),
                    );
                  }(),
                if ((night.lateScreenMinutes ?? 0) > 0)
                  Positioned(
                    left: x(hoursIntoEvening(lateScreenFrom)),
                    width: (night.lateScreenMinutes! / 60 / axisHours * width).clamp(4, width),
                    top: 16 + i * _row + 25,
                    height: 4,
                    child: DecoratedBox(
                      decoration: BoxDecoration(color: c.ion, borderRadius: BorderRadius.circular(Radii.pill)),
                    ),
                  ),
                if (night.lastMealAt != null && hoursIntoEvening(night.lastMealAt!) <= axisHours / 2)
                  Positioned(
                    left: x(hoursIntoEvening(night.lastMealAt!)) - 5,
                    top: 16 + i * _row + 10,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: c.glucose,
                        shape: BoxShape.circle,
                        border: Border.all(color: c.paper, width: 2),
                      ),
                    ),
                  ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _NightTable extends StatelessWidget {
  const _NightTable(this.nights);

  final List<Night> nights;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final head = TextStyle(fontSize: TextSize.xxxs, fontWeight: FontWeight.w700, color: c.inkSoft);
    const cell = TextStyle(fontSize: TextSize.xs);
    Widget row(List<Widget> cells, {bool divider = true, double vertical = 13}) => Container(
      padding: EdgeInsets.symmetric(horizontal: Space.s3, vertical: vertical),
      decoration: BoxDecoration(
        border: divider ? Border(top: BorderSide(color: c.rule)) : null,
      ),
      child: Row(
        children: [
          SizedBox(width: 44, child: cells.first),
          for (final w in cells.skip(1)) Expanded(child: w),
        ],
      ),
    );
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          row(divider: false, vertical: 10, [
            for (final label in const ['Night', 'Bed', 'Woke', 'Slept', 'Ate', 'Screens']) Text(label, style: head),
          ]),
          for (final n in nights)
            MergeSemantics(
              child: row([
                Text(_day(n), style: cell.copyWith(fontWeight: FontWeight.w700)),
                Text(n.bedtime ?? '–', style: cell),
                Text(n.wakeTime ?? '–', style: cell),
                Text(
                  n.sleepMinutes == null ? '–' : slept(n.sleepMinutes!),
                  style: cell.copyWith(
                    fontWeight: FontWeight.w700,
                    color: n.sleepMinutes != null && n.sleepMinutes! < shortSleepMinutes ? c.glucoseInk : null,
                  ),
                ),
                Text(n.lastMealAt ?? '–', style: cell.copyWith(color: ateLate(n) ? c.glucoseInk : null)),
                Text(
                  n.lateScreenMinutes == null
                      ? '–'
                      : (n.lateScreenMinutes == 0 ? 'None' : '${n.lateScreenMinutes} min'),
                  style: cell,
                ),
              ]),
            ),
        ],
      ),
    );
  }
}
