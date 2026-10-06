import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../nights.dart';
import '../theme/tokens.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';

const _fullWeekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const _fullMonths = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

String _short(DateTime d) => '${weekdayShort[d.weekday - 1]} ${d.day} ${monthShort[d.month - 1]}';
String _full(DateTime d) => '${_fullWeekdays[d.weekday - 1]} ${d.day} ${_fullMonths[d.month - 1]}';

double? _average(Iterable<num?> values) {
  final known = [for (final v in values) ?v];
  return known.isEmpty ? null : known.fold<double>(0, (sum, v) => sum + v) / known.length;
}

/// Days of data the week needs before its weak points mean anything.
const _daysNeeded = 3;

/// The past week: a day picker, the chosen day's four numbers, three aligned single-series charts,
/// what could help, and a table with every value.
class WeekScreen extends StatefulWidget {
  const WeekScreen({super.key, required this.changes});

  /// Fires when something was logged on any tab.
  final Listenable changes;

  @override
  State<WeekScreen> createState() => _WeekScreenState();
}

class _WeekScreenState extends State<WeekScreen> {
  Future<List<HistoryDay>>? _days;
  Future<Help>? _help;
  int? _chosen;

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
    if (_days == null) _load();
  }

  void _load() {
    final api = AppScope.of(context).api;
    _days = api.history(7);
    _help = api.help();
  }

  void _reload() => setState(_load);

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: FutureBuilder(
        future: _days,
        builder: (context, snapshot) {
          final days = snapshot.data ?? const <HistoryDay>[];
          final selected = days.isEmpty ? 0 : (_chosen ?? days.length - 1).clamp(0, days.length - 1);
          void pick(int i) => setState(() => _chosen = i);
          final initials = [for (final d in days) weekdayShort[d.day.weekday - 1][0]];
          final focusAverage = _average(days.map((d) => d.focusScore));
          final sleepAverage = _average(days.map((d) => d.sleepMinutes));
          final top = days.fold<double>(
            2800,
            (m, d) => [m, d.caloriesEaten, d.calorieTarget.toDouble()].reduce((a, b) => a > b ? a : b),
          );
          return ListView(
            padding: const EdgeInsets.fromLTRB(Space.s4, Space.s4, Space.s4, Space.s6),
            children: [
              ScreenTitle(
                'This week',
                detail: days.isEmpty ? null : '${_short(days.first.day)} – ${_short(days.last.day)}',
              ),
              const SizedBox(height: 14),
              if (snapshot.hasError)
                ScreenFailed(
                  title: "Couldn't load this week",
                  detail: 'Check your connection and try again.',
                  onRetry: _reload,
                )
              else if (!snapshot.hasData)
                const ScreenLoading(label: 'Loading this week', heights: [52, 150, 190, 190])
              else ...[
                _DayPicker(days, selected: selected, onPick: pick),
                const SizedBox(height: Space.s3),
                _DayCard(days[selected], today: selected == days.length - 1),
                const SizedBox(height: Space.s3),
                _Columns(
                  title: 'Focus Score',
                  note: focusAverage == null ? null : 'Average ${focusAverage.round()}',
                  max: 100,
                  values: [for (final d in days) d.focusScore?.toDouble()],
                  days: initials,
                  format: (v) => '${v.round()}',
                  selected: selected,
                  onPick: pick,
                ),
                const SizedBox(height: Space.s3),
                _Columns(
                  title: 'Calories',
                  note: 'Against your target',
                  max: (top / 400).ceil() * 400,
                  values: [for (final d in days) d.hasData ? d.caloriesEaten : null],
                  days: initials,
                  format: thousands,
                  reference: (
                    value: days.last.calorieTarget.toDouble(),
                    label: '${thousands(days.last.calorieTarget)} target',
                  ),
                  selected: selected,
                  onPick: pick,
                ),
                const SizedBox(height: Space.s3),
                _Columns(
                  title: 'Sleep',
                  note: sleepAverage == null ? null : 'Average ${slept(sleepAverage)}',
                  max: 600,
                  values: [for (final d in days) d.sleepMinutes?.toDouble()],
                  days: initials,
                  format: slept,
                  reference: (value: 480, label: '8 h'),
                  selected: selected,
                  onPick: pick,
                ),
                _WhatHelps(help: _help, daysLogged: days.where((d) => d.hasData).length),
                const BlockTitle('Every day'),
                _DayTable(days, selected: selected, onPick: pick),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _DayPicker extends StatelessWidget {
  const _DayPicker(this.days, {required this.selected, required this.onPick});

  final List<HistoryDay> days;
  final int selected;
  final ValueChanged<int> onPick;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Row(
      spacing: Space.s1,
      children: [
        for (final (i, d) in days.indexed)
          Expanded(
            child: Semantics(
              button: true,
              selected: selected == i,
              label: _full(d.day),
              excludeSemantics: true,
              child: Material(
                color: selected == i ? c.synapse : c.paper,
                borderRadius: BorderRadius.circular(Radii.option),
                child: InkWell(
                  borderRadius: BorderRadius.circular(Radii.option),
                  onTap: () => onPick(i),
                  child: SizedBox(
                    height: 56,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      spacing: 2,
                      children: [
                        Text(
                          weekdayShort[d.day.weekday - 1],
                          style: TextStyle(
                            fontSize: TextSize.xxxs,
                            fontWeight: FontWeight.w600,
                            height: 1,
                            color: (selected == i ? c.onAccent : c.ink).withValues(alpha: 0.8),
                          ),
                        ),
                        Text(
                          '${d.day.day}',
                          style: TextStyle(
                            fontSize: TextSize.base,
                            fontWeight: FontWeight.w800,
                            height: 1.1,
                            color: selected == i ? c.onAccent : c.ink,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// The chosen day's four numbers.
class _DayCard extends StatelessWidget {
  const _DayCard(this.day, {required this.today});

  final HistoryDay day;
  final bool today;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final cells = [
      ('Focus Score', day.focusScore?.toString() ?? '–', day.focusScore == null ? null : '100', null as Color?),
      (
        'Calories',
        thousands(day.caloriesEaten),
        thousands(day.calorieTarget),
        day.caloriesEaten > day.calorieTarget ? c.beet : null,
      ),
      (
        'Sleep',
        day.sleepMinutes == null ? '–' : slept(day.sleepMinutes!),
        null,
        day.sleepMinutes != null && day.sleepMinutes! < shortSleepMinutes ? c.glucoseInk : null,
      ),
      ('Last meal', day.lastMealAt ?? '–', null, isLate(day.lastMealAt) ? c.glucoseInk : null),
    ];
    Widget cell((String, String, String?, Color?) x) => Expanded(
      child: MergeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              x.$1,
              style: TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w600, color: c.inkSoft),
            ),
            const SizedBox(height: 2),
            Text.rich(
              TextSpan(
                text: x.$2,
                children: [
                  if (x.$3 != null)
                    TextSpan(
                      text: ' / ${x.$3}',
                      style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w600, color: c.inkSoft),
                    ),
                ],
              ),
              style: TextStyle(
                fontSize: TextSize.xl,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.3,
                color: x.$4 ?? c.ink,
              ),
            ),
          ],
        ),
      ),
    );
    return Semantics(
      container: true,
      liveRegion: true,
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    _full(day.day),
                    style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
                  ),
                ),
                if (today)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: c.synapseSoft, borderRadius: BorderRadius.circular(Radii.pill)),
                    child: Text(
                      'Today so far',
                      style: TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w700, color: c.synapseInk),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: Space.s3),
            Row(spacing: Space.s3, children: [cell(cells[0]), cell(cells[1])]),
            const SizedBox(height: 14),
            Row(spacing: Space.s3, children: [cell(cells[2]), cell(cells[3])]),
          ],
        ),
      ),
    );
  }
}

/// One single-series column chart. The chosen day is the full-strength column with its value above
/// it; a day without data is a stub on the baseline. The picker and the table carry every value.
class _Columns extends StatelessWidget {
  const _Columns({
    required this.title,
    required this.max,
    required this.values,
    required this.days,
    required this.format,
    required this.selected,
    required this.onPick,
    this.note,
    this.reference,
  });

  final String title;
  final String? note;
  final double max;
  final List<double?> values;
  final List<String> days;
  final String Function(double) format;
  final ({double value, String label})? reference;
  final int selected;
  final ValueChanged<int> onPick;

  static const _height = 120.0;
  static const _label = 16.0;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final ref = reference;
    return AppCard(
      padding: const EdgeInsets.fromLTRB(Space.s4, Space.s4, Space.s4, Space.s3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
                ),
              ),
              if (note != null)
                Text(
                  note!,
                  style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft),
                ),
            ],
          ),
          const SizedBox(height: 14),
          ExcludeSemantics(
            child: Container(
              height: _height,
              decoration: BoxDecoration(
                border: Border(bottom: BorderSide(color: c.rule)),
              ),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    spacing: Space.s2,
                    children: [
                      for (final (i, value) in values.indexed)
                        Expanded(
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () => onPick(i),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                if (selected == i && value != null)
                                  SizedBox(
                                    height: _label,
                                    child: OverflowBox(
                                      maxWidth: 80,
                                      child: Text(
                                        format(value),
                                        maxLines: 1,
                                        softWrap: false,
                                        style: const TextStyle(
                                          fontSize: TextSize.xxxs,
                                          fontWeight: FontWeight.w700,
                                          height: 1,
                                        ),
                                      ),
                                    ),
                                  ),
                                Container(
                                  constraints: const BoxConstraints(maxWidth: 30),
                                  height: value == null
                                      ? 4
                                      : (value / max).clamp(0.0, 1.0) * (_height - _label - 1) + 4,
                                  decoration: BoxDecoration(
                                    color: value == null ? c.track : (selected == i ? c.synapse : c.synapseFaint),
                                    borderRadius: const BorderRadius.vertical(
                                      top: Radius.circular(7),
                                      bottom: Radius.circular(2),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                  if (ref != null) ...[
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: (ref.value / max).clamp(0.0, 1.0) * (_height - _label - 1) + 4,
                      child: IgnorePointer(child: DashedLine(color: c.inkFaint)),
                    ),
                    Positioned(
                      right: 0,
                      bottom: (ref.value / max).clamp(0.0, 1.0) * (_height - _label - 1) + 7,
                      child: IgnorePointer(
                        child: Container(
                          color: c.paper,
                          padding: const EdgeInsets.only(left: Space.s1),
                          child: Text(
                            ref.label,
                            style: TextStyle(
                              fontSize: TextSize.xxxs,
                              fontWeight: FontWeight.w700,
                              color: c.inkSoft,
                              height: 1,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 6),
          ExcludeSemantics(
            child: Row(
              spacing: Space.s2,
              children: [
                for (final day in days)
                  Expanded(
                    child: Text(
                      day,
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: TextSize.xxxs, fontWeight: FontWeight.w600, color: c.inkSoft),
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

/// The week's weak points with the routines and products matched to them. Affiliate and own-brand
/// products are labelled on the product itself.
class _WhatHelps extends StatelessWidget {
  const _WhatHelps({required this.help, required this.daysLogged});

  final Future<Help>? help;
  final int daysLogged;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final missing = _daysNeeded - daysLogged;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(Space.s1, 26, Space.s1, Space.s1),
          child: Semantics(
            header: true,
            child: const Text(
              'What could help',
              style: TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800, letterSpacing: -0.3),
            ),
          ),
        ),
        if (missing > 0)
          Padding(
            padding: const EdgeInsets.only(top: Space.s2),
            child: EmptyCard(
              title: missing == 1 ? 'One more day to go' : '$missing more days to go',
              detail:
                  "Keep logging and we'll show the week's weak points, routines to try and products that might help.",
            ),
          )
        else
          FutureBuilder(
            future: help,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return Padding(
                  padding: const EdgeInsets.only(top: Space.s2),
                  child: AppCard(
                    child: Text(
                      "Suggestions didn't load. Your week is still here; try again in a moment.",
                      style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
                    ),
                  ),
                );
              }
              final data = snapshot.data;
              if (data == null) {
                return const Padding(
                  padding: EdgeInsets.only(top: Space.s2),
                  child: ScreenLoading(label: 'Finding what fits your week', heights: [120]),
                );
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const GroupLabel('Weak points this week', top: 6),
                  AppCard(
                    padding: EdgeInsets.zero,
                    child: data.weakPoints.isEmpty
                        ? Padding(
                            padding: const EdgeInsets.symmetric(horizontal: Space.s4, vertical: Space.s3),
                            child: Text(
                              'Your week looks steady. The routines below help keep it that way.',
                              style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
                            ),
                          )
                        : Column(
                            children: [
                              for (final (i, point) in data.weakPoints.indexed)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: Space.s4, vertical: Space.s3),
                                  decoration: BoxDecoration(
                                    border: i == 0 ? null : Border(top: BorderSide(color: c.rule)),
                                  ),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Container(
                                        width: 8,
                                        height: 8,
                                        margin: const EdgeInsets.only(top: 6, right: Space.s3),
                                        decoration: BoxDecoration(color: c.glucose, shape: BoxShape.circle),
                                      ),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              point.label[0].toUpperCase() + point.label.substring(1),
                                              style: const TextStyle(
                                                fontSize: TextSize.md,
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                            Text(
                                              'Scored ${(point.average * 100).round()} out of 100 on average over the week.',
                                              style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                            ],
                          ),
                  ),
                  if (data.routines.isNotEmpty) ...[
                    const GroupLabel('Routines to try', top: 18),
                    for (final (i, routine) in data.routines.indexed)
                      Padding(
                        padding: EdgeInsets.only(top: i == 0 ? 0 : 10),
                        child: AppCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                routine.title,
                                style: const TextStyle(fontSize: TextSize.base, fontWeight: FontWeight.w800),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                routine.summary,
                                style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                              ),
                              const SizedBox(height: Space.s1),
                              for (final (n, step) in routine.steps.indexed)
                                Padding(
                                  padding: const EdgeInsets.only(top: Space.s2),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Container(
                                        width: 22,
                                        height: 22,
                                        alignment: Alignment.center,
                                        margin: const EdgeInsets.only(right: 10),
                                        decoration: BoxDecoration(color: c.synapseSoft, shape: BoxShape.circle),
                                        child: Text(
                                          '${n + 1}',
                                          style: TextStyle(
                                            fontSize: TextSize.xxs,
                                            fontWeight: FontWeight.w800,
                                            color: c.synapseInk,
                                            height: 1,
                                          ),
                                        ),
                                      ),
                                      Expanded(
                                        child: Text(step, style: const TextStyle(fontSize: TextSize.sm, height: 1.4)),
                                      ),
                                    ],
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                  ],
                  if (data.products.isNotEmpty) ...[
                    const GroupLabel('Products that might help', top: 18),
                    for (final (i, product) in data.products.indexed)
                      Padding(
                        padding: EdgeInsets.only(top: i == 0 ? 0 : 10),
                        child: AppCard(
                          padding: const EdgeInsets.fromLTRB(Space.s4, 14, 14, 14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            spacing: Space.s2,
                            children: [
                              if (product.ownBrand || product.affiliate || product.supplement)
                                Wrap(
                                  spacing: 6,
                                  runSpacing: 6,
                                  children: [
                                    if (product.ownBrand) Tag('Our brand', fill: c.synapseSoft, ink: c.synapseInk),
                                    if (product.affiliate)
                                      Tag('Affiliate link', fill: c.glucoseSoft, ink: c.glucoseInk),
                                    if (product.supplement) Tag('Supplement', fill: c.mist, ink: c.inkSoft),
                                  ],
                                ),
                              Text(
                                product.name,
                                style: const TextStyle(fontSize: TextSize.base, fontWeight: FontWeight.w700),
                              ),
                              Text(
                                product.description,
                                style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
                              ),
                              if (product.supplement)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: Space.s2),
                                  decoration: BoxDecoration(color: c.mist, borderRadius: BorderRadius.circular(10)),
                                  child: const Text(
                                    "Supplement. Check with your doctor before starting it, especially if you're pregnant or take medication.",
                                    style: TextStyle(fontSize: TextSize.xxs, height: 1.4),
                                  ),
                                ),
                              if (product.url != null) _SeeProduct(name: product.name, url: product.url!),
                            ],
                          ),
                        ),
                      ),
                    if (data.products.any((p) => p.affiliate || p.ownBrand))
                      Padding(
                        padding: const EdgeInsets.fromLTRB(Space.s1, 10, Space.s1, 0),
                        child: Text(
                          [
                            if (data.products.any((p) => p.affiliate))
                              'We earn a commission when you buy through an affiliate link.',
                            if (data.products.any((p) => p.ownBrand))
                              '"Our brand" products are sold by MitoProof, which is run by the people who make NeuroCal.',
                            "Neither changes what we suggest; suggestions come from your week's data.",
                          ].join(' '),
                          style: TextStyle(fontSize: TextSize.xxs, height: 1.5, color: c.inkSoft),
                        ),
                      ),
                  ],
                ],
              );
            },
          ),
      ],
    );
  }
}

/// Opens the product's page outside the app. The labels above it say when the link earns NeuroCal money.
class _SeeProduct extends StatelessWidget {
  const _SeeProduct({required this.name, required this.url});

  final String name;
  final String url;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      link: true,
      label: 'See product: $name',
      excludeSemantics: true,
      child: OutlinedButton.icon(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 40),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          foregroundColor: c.synapseInk,
          backgroundColor: Colors.transparent,
          side: BorderSide(color: c.ruleStrong, width: 1.5),
          textStyle: const TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700),
        ),
        iconAlignment: IconAlignment.end,
        icon: const Icon(Icons.north_east_rounded, size: 14),
        label: const Text('See product'),
        onPressed: () async {
          final link = Uri.tryParse(url);
          final opened = link != null && await AppScope.of(context).openLink(link).catchError((Object _) => false);
          if (!opened && context.mounted) showToast(context, "Couldn't open that link.", ToastTone.problem);
        },
      ),
    );
  }
}

class _DayTable extends StatelessWidget {
  const _DayTable(this.days, {required this.selected, required this.onPick});

  final List<HistoryDay> days;
  final int selected;
  final ValueChanged<int> onPick;

  static const _widths = [64.0, 56.0, 78.0, 70.0, 70.0, 76.0, 190.0];

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final head = TextStyle(fontSize: TextSize.xxxs, fontWeight: FontWeight.w700, color: c.inkSoft);
    const cell = TextStyle(fontSize: TextSize.xs);
    Widget row(List<Widget> cells, {Color? fill, bool divider = true, double vertical = 13}) => Container(
      padding: EdgeInsets.symmetric(horizontal: 14, vertical: vertical),
      decoration: BoxDecoration(
        color: fill,
        border: divider ? Border(top: BorderSide(color: c.rule)) : null,
      ),
      child: Row(
        children: [for (final (i, w) in cells.indexed) SizedBox(width: _widths[i], child: w)],
      ),
    );
    return AppCard(
      padding: EdgeInsets.zero,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            row(divider: false, vertical: 10, [
              for (final label in const ['Day', 'Focus', 'Calories', 'Protein', 'Sleep', 'Last meal', 'Feeling'])
                Text(label, style: head),
            ]),
            for (final (i, d) in days.indexed)
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onPick(i),
                child: MergeSemantics(
                  child: row(fill: selected == i ? c.synapseSoft : null, [
                    Text(
                      '${weekdayShort[d.day.weekday - 1]} ${d.day.day}',
                      style: cell.copyWith(fontWeight: FontWeight.w700),
                    ),
                    Text(d.focusScore?.toString() ?? '–', style: cell.copyWith(fontWeight: FontWeight.w700)),
                    Text(d.hasData ? thousands(d.caloriesEaten) : '–', style: cell),
                    Text(d.hasData ? '${d.proteinG.round()} g' : '–', style: cell),
                    Text(d.sleepMinutes == null ? '–' : slept(d.sleepMinutes!), style: cell),
                    Text(d.lastMealAt ?? '–', style: cell.copyWith(color: isLate(d.lastMealAt) ? c.glucoseInk : null)),
                    Text(
                      d.flags.isEmpty ? '–' : d.flags.map((f) => f.label).join(', '),
                      style: cell.copyWith(color: c.inkSoft),
                    ),
                  ]),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
