import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../weight_units.dart';
import '../widgets/ui.dart';

/// The Monday a report was last opened for, so Today's card goes once it's read.
const reportSeenKey = 'neurocal.report.seen';

/// Last week's report, on its own page.
Future<void> openWeeklyReport(BuildContext context) =>
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const WeeklyReportScreen()));

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/// "19–25 Oct", or "28 Sep – 4 Oct" across a month.
String reportRange(String start, String end) {
  final a = DateTime.parse(start);
  final b = DateTime.parse(end);
  return a.month == b.month
      ? '${a.day}–${b.day} ${_months[b.month - 1]}'
      : '${a.day} ${_months[a.month - 1]} – ${b.day} ${_months[b.month - 1]}';
}

/// Last week, Monday to Sunday: the score and why it moved, each pillar, mind, body, what's working,
/// the level and one thing for next week.
class WeeklyReportScreen extends StatefulWidget {
  const WeeklyReportScreen({super.key});

  @override
  State<WeeklyReportScreen> createState() => _WeeklyReportScreenState();
}

class _WeeklyReportScreenState extends State<WeeklyReportScreen> {
  Future<(WeeklyReport, WeightUnit)>? _report;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _report ??= _load();
  }

  Future<(WeeklyReport, WeightUnit)> _load() async {
    final scope = AppScope.of(context);
    final unit = WeightUnit.load(Localizations.localeOf(context));
    final report = await scope.api.weeklyReport();
    scope.analytics.track('report_opened');
    try {
      await (await SharedPreferences.getInstance()).setString(reportSeenKey, report.weekStart);
    } catch (_) {
      // Today's card shows again; harmless.
    }
    return (report, await unit);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      appBar: AppBar(title: const Text('Weekly report'), backgroundColor: c.mist, surfaceTintColor: Colors.transparent),
      body: FutureBuilder(
        future: _report,
        builder: (context, snapshot) => ListView(
          padding: const EdgeInsets.fromLTRB(Space.s4, Space.s2, Space.s4, Space.s6),
          children: [
            if (snapshot.hasError)
              ScreenFailed(
                title: "Couldn't load your report",
                detail: 'Check your connection and try again.',
                onRetry: () => setState(() => _report = _load()),
              )
            else if (!snapshot.hasData)
              const ScreenLoading(label: 'Loading your report', heights: [160, 280, 180])
            else
              ..._body(context, snapshot.data!.$1, snapshot.data!.$2),
          ],
        ),
      ),
    );
  }

  List<Widget> _body(BuildContext context, WeeklyReport r, WeightUnit unit) {
    final c = context.colors;
    final h = r.headline;
    final small = TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft);
    return [
      Text(
        'Week of ${reportRange(r.weekStart, r.weekEnd)}',
        style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: c.synapseInk),
      ),
      const SizedBox(height: Space.s2),
      AppCard(
        radius: Radii.hero,
        child: Row(
          spacing: Space.s4,
          children: [
            if (h.score != null) _ScoreBadge(h.score!, change: h.change),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: Space.s1,
                children: [
                  Text(
                    h.title,
                    style: const TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w800, height: 1.2),
                  ),
                  Text(h.summary, style: small),
                ],
              ),
            ),
          ],
        ),
      ),
      const BlockTitle('Your inputs'),
      AppCard(
        padding: EdgeInsets.zero,
        child: Column(children: [for (final (i, p) in r.pillars.indexed) _PillarRow(p, divider: i > 0)]),
      ),
      const BlockTitle('Mind'),
      AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: Space.s3,
          children: [
            _Line(Icons.bolt_rounded, r.brain),
            if (r.performance case final p?) _Line(Icons.trending_up_rounded, p),
          ],
        ),
      ),
      const BlockTitle('Body'),
      AppCard(child: _Line(Icons.monitor_weight_outlined, _weight(r.body, unit))),
      if (r.working.isNotEmpty) ...[
        const BlockTitle("What's working"),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(children: [for (final (i, w) in r.working.indexed) _WorkingRow(w, divider: i > 0)]),
        ),
      ],
      const BlockTitle('Level'),
      AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 2,
          children: [
            Text(
              'Level ${r.level.level}: ${r.level.name}',
              style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
            ),
            Text(r.level.summary, style: small),
          ],
        ),
      ),
      const BlockTitle('For next week'),
      Container(
        padding: const EdgeInsets.all(Space.s4),
        decoration: BoxDecoration(color: c.synapseSoft, borderRadius: BorderRadius.circular(Radii.card)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: Space.s1,
          children: [
            Text(
              r.next.title,
              style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800, color: c.synapseInk),
            ),
            Text(r.next.detail, style: const TextStyle(fontSize: TextSize.sm, height: 1.4)),
          ],
        ),
      ),
      Padding(
        padding: const EdgeInsets.only(top: Space.s3),
        child: Text(
          'Built from what you logged, the same way as your Focus Score.',
          style: TextStyle(fontSize: TextSize.xs, color: c.inkFaint),
        ),
      ),
    ];
  }

  /// "Down 0.6 kg this week (82.4 kg to 81.8 kg). 3.8 kg to your goal."
  static String _weight(({double? startKg, double? endKg, double? goalKg}) b, WeightUnit unit) {
    final (start, end, goal) = (b.startKg, b.endKg, b.goalKg);
    if (end == null) return 'No weigh-ins last week. Weighing in a few mornings a week shows the trend.';
    final parts = <String>[];
    if (start != null && start != end) {
      final change = end - start;
      parts.add(
        '${change < 0 ? 'Down' : 'Up'} ${unit.format(change.abs())} over the week '
        '(${unit.format(start)} to ${unit.format(end)}).',
      );
    } else {
      parts.add('${unit.format(end)} at your last weigh-in.');
    }
    if (goal != null && (end - goal).abs() >= 0.1) {
      parts.add('${unit.format((end - goal).abs())} to your goal.');
    } else if (goal != null) {
      parts.add("You're at your goal.");
    }
    return parts.join(' ');
  }
}

class _ScoreBadge extends StatelessWidget {
  const _ScoreBadge(this.score, {this.change});

  final int score;
  final int? change;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final ch = change;
    return Column(
      spacing: Space.s1,
      children: [
        Container(
          width: 64,
          height: 64,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [NeuroCalColors.ringFrom, NeuroCalColors.ringTo],
            ),
          ),
          child: Text(
            '$score',
            style: const TextStyle(
              fontSize: TextSize.xxl,
              fontWeight: FontWeight.w800,
              color: NeuroCalColors.onSignal,
              height: 1,
            ),
          ),
        ),
        if (ch != null && ch != 0)
          Text(
            '${ch > 0 ? '↑' : '↓'} ${ch.abs()}',
            style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w800, color: ch > 0 ? c.chlorophyll : c.oil),
          ),
      ],
    );
  }
}

class _PillarRow extends StatelessWidget {
  const _PillarRow(this.pillar, {required this.divider});

  final ({String pillar, String label, int? score, int? previous, String summary}) pillar;
  final bool divider;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final p = pillar;
    return MergeSemantics(
      child: Container(
        padding: const EdgeInsets.all(Space.s4),
        decoration: BoxDecoration(
          border: divider ? Border(top: BorderSide(color: c.rule)) : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 6,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    p.label,
                    style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800),
                  ),
                ),
                Text(
                  p.score == null ? 'No data' : '${p.score}',
                  style: TextStyle(
                    fontSize: TextSize.sm,
                    fontWeight: FontWeight.w800,
                    color: p.score == null ? c.inkFaint : c.ink,
                  ),
                ),
              ],
            ),
            if (p.score != null) Meter(value: p.score! / 100, color: c.synapse),
            Text(
              p.summary,
              style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
            ),
          ],
        ),
      ),
    );
  }
}

class _WorkingRow extends StatelessWidget {
  const _WorkingRow(this.item, {required this.divider});

  final ({String name, bool supplement, String verdict, String summary}) item;
  final bool divider;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final w = item;
    final (label, ink) = switch (w.verdict) {
      'helping' => ('Helping', c.chlorophyll),
      'lasted' => ('Gain lasted', c.chlorophyll),
      'worse' => ('Worse', c.oil),
      'faded' => ('Faded after stopping', c.oil),
      _ => ('No clear change', c.inkSoft),
    };
    return MergeSemantics(
      child: Container(
        padding: const EdgeInsets.all(Space.s4),
        decoration: BoxDecoration(
          border: divider ? Border(top: BorderSide(color: c.rule)) : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 2,
          children: [
            Wrap(
              spacing: Space.s2,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  w.name,
                  style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800),
                ),
                Text(
                  label,
                  style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: ink),
                ),
              ],
            ),
            Text(
              w.summary,
              style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
            ),
          ],
        ),
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line(this.icon, this.text);

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    spacing: Space.s3,
    children: [
      Icon(icon, size: 20, color: context.colors.synapseInk),
      Expanded(
        child: Text(text, style: const TextStyle(fontSize: TextSize.sm, height: 1.4)),
      ),
    ],
  );
}

/// On Today, Monday to Wednesday until it's opened: last week's report is ready.
class WeeklyReportCard extends StatelessWidget {
  const WeeklyReportCard({super.key, required this.onOpen});

  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppCard(
      padding: const EdgeInsets.fromLTRB(Space.s4, Space.s3, Space.s3, Space.s3),
      child: Row(
        spacing: Space.s3,
        children: [
          Icon(Icons.insights_rounded, color: c.synapseInk),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 2,
              children: [
                const Text(
                  'Your weekly report is ready',
                  style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800),
                ),
                Text(
                  'How last week went, why, and one thing for this week.',
                  style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                ),
              ],
            ),
          ),
          SoftButton(label: 'Open', height: 36, semanticLabel: 'Open your weekly report', onPressed: onOpen),
        ],
      ),
    );
  }
}

/// Whether Today shows the card: Monday to Wednesday, until this week's report has been opened.
Future<bool> weeklyReportDue(DateTime now) async {
  if (now.weekday > DateTime.wednesday) return false;
  final monday = DateTime(now.year, now.month, now.day - now.weekday + 1);
  final lastWeekStart = DateTime(monday.year, monday.month, monday.day - 7);
  final key =
      '${lastWeekStart.year}-${lastWeekStart.month.toString().padLeft(2, '0')}-${lastWeekStart.day.toString().padLeft(2, '0')}';
  try {
    return (await SharedPreferences.getInstance()).getString(reportSeenKey) != key;
  } catch (_) {
    return true;
  }
}
