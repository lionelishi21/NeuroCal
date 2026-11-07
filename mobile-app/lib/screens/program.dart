import 'package:flutter/material.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/sheet.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';
import 'guides.dart';

/// The 30-day program in progress (docs/NCBM.md §11): today's habits, the day's tip, the energy
/// check on days 1, 15 and 30, and how far it's come.
Future<void> openProgram(BuildContext context) =>
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const ProgramScreen()));

/// The energy check (the guide's chapter 3): five areas, each answered 0 (best) to 4.
const energyQuestions = <({String area, List<String> answers})>[
  (
    area: 'Energy',
    answers: [
      'I feel energised and clear-headed from morning to night',
      'I have one afternoon dip but recover without caffeine',
      'I need caffeine to function after 2pm',
      'I feel tired most of the day, however I sleep',
      'I am exhausted all the time and caffeine barely helps',
    ],
  ),
  (
    area: 'Clear thinking',
    answers: [
      'Sharp focus, good memory, words come easily',
      'Occasional brain fog, mostly in the afternoon',
      'Frequent brain fog, hard to concentrate for more than an hour',
      'Memory lapses, slow thinking, complex tasks are hard',
      'Thinking problems that get in the way of daily life',
    ],
  ),
  (
    area: 'Sleep',
    answers: [
      'Fall asleep easily, sleep through, wake refreshed',
      'Occasional trouble falling asleep or minor night waking',
      'Often take more than 30 minutes to fall asleep, or wake once or twice',
      'Poor sleep most nights, unrefreshed mornings',
      'Severe sleep problems, never feel rested',
    ],
  ),
  (
    area: 'Energy after meals',
    answers: [
      'Steady energy after meals, no crashes',
      'Mild dip after large meals',
      'Noticeable crash after most meals, need rest or caffeine',
      'Big crashes, sometimes need to lie down after eating',
      'Exhausting tiredness after eating',
    ],
  ),
  (
    area: 'Recovery from exercise',
    answers: [
      'Ready to train again within 24 hours, little soreness',
      'One to two days to recover from moderate exercise',
      'Two to three days, lasting muscle soreness',
      'Exercise leaves me tired for days, so I avoid it',
      'I can’t keep up regular exercise because of recovery',
    ],
  ),
];

/// What each band of the total means, as the guide puts it.
String bandDetail(EnergyBand band) => switch (band) {
  EnergyBand.well => 'Use the protocol to keep it that way.',
  EnergyBand.some => 'Many people notice a difference within a few weeks.',
  EnergyBand.lots => 'Follow all 30 days closely.',
  EnergyBand.doctor => 'Scores this high can have a medical cause worth ruling out. See your doctor before you start.',
};

/// Today's card: the day of the program and how many of today's habits are done.
class ProgramCard extends StatelessWidget {
  const ProgramCard(this.program, {super.key, required this.onOpen});

  final Program program;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final p = program;
    final line = p.finished
        ? 'Finished · ${p.fullDays} full days'
        : p.checkDue != null
        ? 'Your day ${p.checkDue} energy check is ready'
        : '${p.doneToday} of ${p.rules.length} habits today';
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.card),
        onTap: onOpen,
        child: AppCard(
          child: Row(
            children: [
              _DayRing(p),
              const SizedBox(width: Space.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 2,
                  children: [
                    Text(
                      p.finished ? p.title : '${p.title} · day ${p.day}',
                      style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
                    ),
                    Text(
                      line,
                      style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: c.inkSoft),
            ],
          ),
        ),
      ),
    );
  }
}

/// The day out of 30 as a ring.
class _DayRing extends StatelessWidget {
  const _DayRing(this.program);

  final Program program;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final day = program.day.clamp(1, program.days);
    return SizedBox(
      width: 48,
      height: 48,
      child: Stack(
        alignment: Alignment.center,
        children: [
          SizedBox.expand(
            child: CircularProgressIndicator(
              value: day / program.days,
              strokeWidth: 4,
              backgroundColor: c.track,
              color: c.synapse,
              semanticsLabel: 'Day $day of ${program.days}',
            ),
          ),
          ExcludeSemantics(
            child: Text(
              '$day',
              style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

class ProgramScreen extends StatefulWidget {
  const ProgramScreen({super.key});

  @override
  State<ProgramScreen> createState() => _ProgramScreenState();
}

class _ProgramScreenState extends State<ProgramScreen> {
  Future<Program?>? _load;

  /// Shown in place of the last load after a tick or a check, so the screen doesn't reload.
  Program? _latest;
  final _busy = <String>{};

  NeuroCalApi get _api => AppScope.of(context).api;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _load ??= _api.program();
  }

  Future<void> _tick(ProgramRule rule) async {
    setState(() => _busy.add(rule.id));
    try {
      final p = await _api.tickProgramRule(rule.id, done: !rule.done);
      if (mounted) setState(() => _latest = p);
    } on Object {
      if (mounted) showToast(context, "That didn't save. Try again.", ToastTone.problem);
    } finally {
      if (mounted) setState(() => _busy.remove(rule.id));
    }
  }

  Future<void> _check(int checkpoint) async {
    final p = await showEnergyCheck(context, checkpoint);
    if (p != null && mounted) setState(() => _latest = p);
  }

  Future<void> _stop() async {
    final sure = await showAppSheet<bool>(
      context,
      title: 'Stop the program?',
      builder: (context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s3,
        children: [
          const Text('Your days and energy checks so far are cleared. You can start again any time from the guide.'),
          SheetAction(label: 'Stop the program', destructive: true, onPressed: () => Navigator.pop(context, true)),
        ],
      ),
    );
    if (sure != true || !mounted) return;
    try {
      await _api.stopProgram();
      if (mounted) Navigator.of(context).pop();
    } on Object {
      if (mounted) showToast(context, "The program didn't stop. Try again.", ToastTone.problem);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      appBar: AppBar(
        title: const Text('30-day program'),
        backgroundColor: c.mist,
        surfaceTintColor: Colors.transparent,
      ),
      body: SafeArea(
        top: false,
        child: FutureBuilder(
          future: _load,
          builder: (context, snapshot) {
            final program = _latest ?? snapshot.data;
            return ListView(
              padding: const EdgeInsets.fromLTRB(Space.s4, Space.s2, Space.s4, Space.s7),
              children: [
                if (snapshot.hasError && _latest == null)
                  ScreenFailed(
                    title: "Couldn't load the program",
                    detail: 'Check your connection and try again.',
                    onRetry: () => setState(() => _load = _api.program()),
                  )
                else if (snapshot.connectionState != ConnectionState.done && program == null)
                  const ScreenLoading(label: 'Loading the program', heights: [96, 280, 96])
                else if (program == null)
                  const EmptyCard(
                    title: 'No program running',
                    detail: 'Start one from a guide, such as The Mitoproof Protocol, under Me → Guides.',
                  )
                else
                  ..._body(program),
              ],
            );
          },
        ),
      ),
    );
  }

  List<Widget> _body(Program p) {
    final c = context.colors;
    return [
      _Header(p),
      if (p.checkDue case final due?) ...[const SizedBox(height: Space.s3), _CheckDue(due, onTake: () => _check(due))],
      if (p.rules.isNotEmpty) ...[
        BlockTitle('Today', note: '${p.doneToday} of ${p.rules.length} done'),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (final (i, rule) in p.rules.indexed)
                DecoratedBox(
                  decoration: BoxDecoration(
                    border: i == 0 ? null : Border(top: BorderSide(color: c.rule)),
                  ),
                  child: CheckboxListTile(
                    value: rule.done,
                    controlAffinity: ListTileControlAffinity.leading,
                    contentPadding: const EdgeInsets.fromLTRB(Space.s2, Space.s1, Space.s4, Space.s1),
                    title: Text(rule.label, style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text(rule.auto ? 'From what you logged' : rule.detail),
                    onChanged: rule.auto || _busy.contains(rule.id) ? null : (_) => _tick(rule),
                  ),
                ),
            ],
          ),
        ),
      ],
      const SizedBox(height: Space.s3),
      AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: Space.s1,
          children: [
            Text(
              p.tipTitle,
              style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
            ),
            Text(
              p.tipDetail,
              style: TextStyle(fontSize: TextSize.sm, height: 1.45, color: c.inkSoft),
            ),
          ],
        ),
      ),
      if (p.checks.isNotEmpty || p.focusFirstWeek != null) ...[const BlockTitle('So far'), _Progress(p)],
      const SizedBox(height: Space.s5),
      SoftButton(label: 'Read the guide', onPressed: () => openGuide(context, p.guideId)),
      const SizedBox(height: Space.s2),
      TextButton(onPressed: _stop, child: Text(p.finished ? 'Close the program' : 'Stop the program')),
    ];
  }
}

class _Header extends StatelessWidget {
  const _Header(this.program);

  final Program program;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final p = program;
    return AppCard(
      child: Row(
        children: [
          _DayRing(p),
          const SizedBox(width: Space.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 2,
              children: [
                Text(
                  p.title,
                  style: const TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w800),
                ),
                Text(
                  p.finished ? 'All 30 days done' : 'Day ${p.day} of ${p.days} · ${p.phase.label}',
                  style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
                ),
                Text(
                  '${p.fullDays} full ${p.fullDays == 1 ? 'day' : 'days'} so far',
                  style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: c.synapseInk),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CheckDue extends StatelessWidget {
  const _CheckDue(this.checkpoint, {required this.onTake});

  final int checkpoint;
  final VoidCallback onTake;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s2,
        children: [
          Text(
            checkpoint == 1 ? 'Take your starting energy check' : 'Your day $checkpoint energy check',
            style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
          ),
          Text(
            checkpoint == 1
                ? 'Five quick questions about the last two weeks. Days 15 and 30 compare with it.'
                : 'The same five questions, to compare with how you started.',
            style: TextStyle(fontSize: TextSize.sm, height: 1.45, color: c.inkSoft),
          ),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            onPressed: onTake,
            child: const Text('Take the energy check'),
          ),
        ],
      ),
    );
  }
}

class _Progress extends StatelessWidget {
  const _Progress(this.program);

  final Program program;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final p = program;
    final first = p.checks.where((x) => x.checkpoint == 1).firstOrNull;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s3,
        children: [
          for (final check in p.checks)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 2,
              children: [
                Text(
                  'Energy check, day ${check.checkpoint}: ${check.total} of 20',
                  style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
                ),
                Text(
                  [
                    '${check.band.label}. ${bandDetail(check.band)}',
                    if (first != null && check.checkpoint != 1)
                      check.total < first.total
                          ? '${first.total - check.total} better than day 1 (lower is better).'
                          : check.total == first.total
                          ? 'The same as day 1.'
                          : '${check.total - first.total} worse than day 1 (lower is better).',
                  ].join(' '),
                  style: TextStyle(fontSize: TextSize.sm, height: 1.45, color: c.inkSoft),
                ),
              ],
            ),
          if (p.focusFirstWeek case final from?)
            Text(
              p.focusLastWeek == null
                  ? 'Focus Score in week one: $from on average.'
                  : 'Focus Score: $from on average in week one, ${p.focusLastWeek} over the latest week.',
              style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
            ),
        ],
      ),
    );
  }
}

/// The energy check, one area at a time; returns the program with the check saved, or null if closed.
Future<Program?> showEnergyCheck(BuildContext context, int checkpoint) => showAppSheet<Program>(
  context,
  title: checkpoint == 1 ? 'Your starting energy check' : 'Energy check, day $checkpoint',
  builder: (_) => const _EnergyCheck(),
);

class _EnergyCheck extends StatefulWidget {
  const _EnergyCheck();

  @override
  State<_EnergyCheck> createState() => _EnergyCheckState();
}

class _EnergyCheckState extends State<_EnergyCheck> {
  final _answers = <int?>[for (final _ in energyQuestions) null];
  var _saving = false;

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final p = await AppScope.of(context).api.saveEnergyCheck([for (final a in _answers) a!]);
      if (mounted) Navigator.of(context).pop(p);
    } on Object {
      if (mounted) {
        setState(() => _saving = false);
        showToast(context, "The check didn't save. Try again.", ToastTone.problem);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final total = _answers.whereType<int>().fold(0, (a, b) => a + b);
    final done = _answers.every((a) => a != null);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: Space.s2,
      children: [
        Text(
          'Pick what best describes the last two weeks.',
          style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
        ),
        for (final (i, q) in energyQuestions.indexed) ...[
          GroupLabel(q.area, top: Space.s3),
          RadioGroup<int>(
            groupValue: _answers[i],
            onChanged: (v) => setState(() => _answers[i] = v),
            child: Column(
              children: [
                for (final (score, answer) in q.answers.indexed)
                  RadioListTile<int>(
                    value: score,
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(answer, style: const TextStyle(fontSize: TextSize.sm)),
                  ),
              ],
            ),
          ),
        ],
        if (done)
          Text(
            'Total: $total of 20. Lower is better.',
            style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
          ),
        SheetAction(label: _saving ? 'Saving…' : 'Save the check', onPressed: done && !_saving ? _save : null),
      ],
    );
  }
}
