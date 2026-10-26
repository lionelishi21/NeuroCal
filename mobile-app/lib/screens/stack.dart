import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../combos.dart' show Evidence;
import '../theme/tokens.dart';
import '../widgets/sheet.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';
import 'session_sheet.dart';
import 'supplement_sheet.dart';

const _order = [StackTiming.morning, StackTiming.withFood, StackTiming.evening, StackTiming.any];

List<StackItem> _sorted(List<StackItem> items) =>
    [...items]..sort((a, b) => _order.indexOf(a.timing).compareTo(_order.indexOf(b.timing)));

String _nudgeTime(StackTiming t) => switch (t) {
  StackTiming.withFood => 'at lunchtime',
  StackTiming.evening => 'in the evening',
  _ => 'in the morning',
};

String _dose(StackItem i) {
  final serving = i.servingSize == null ? '${i.servingsPerDay} a day' : '${i.servingsPerDay} × ${i.servingSize}';
  return '$serving · ${i.timing.label}';
}

/// Stack-wide checks: red when a daily total passes an upper limit, amber otherwise.
List<Widget> _flagNotes(List<StackFlag> flags) => [
  for (final f in flags)
    SheetNote(
      lead: switch (f.kind) {
        'above_upper_limit' => 'Too much in total.',
        'late_caffeine' => 'Caffeine late in the day.',
        'interaction' => 'Check with your clinician.',
        _ => 'In more than one.',
      },
      detail: f.message,
      watch: f.kind != 'above_upper_limit' && f.kind != 'interaction',
    ),
];

/// Today's supplements as a checklist, with stack-wide warnings and bottles running low.
class StackCard extends StatefulWidget {
  const StackCard(this.stack, {super.key, required this.onManage, this.framed = true});

  final SupplementStack stack;
  final VoidCallback onManage;

  /// False draws it as a row of Today's habits card, without its own card.
  final bool framed;

  @override
  State<StackCard> createState() => _StackCardState();
}

class _StackCardState extends State<StackCard> {
  late List<StackItem> _items = _sorted(widget.stack.items);

  @override
  void didUpdateWidget(StackCard old) {
    super.didUpdateWidget(old);
    if (old.stack != widget.stack) _items = _sorted(widget.stack.items);
  }

  Future<void> _toggle(StackItem item) async {
    final next = !item.takenToday;
    // Ticks feel instant; undo if the save fails.
    setState(() => _items = [for (final i in _items) i.id == item.id ? i.copyWith(takenToday: next) : i]);
    try {
      await AppScope.of(context).api.setTaken(item.id, next);
    } catch (_) {
      if (!mounted) return;
      setState(() => _items = [for (final i in _items) i.id == item.id ? i.copyWith(takenToday: !next) : i]);
      showToast(context, "Couldn't save that. Try again.", ToastTone.problem);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final taken = _items.where((i) => i.takenToday).length;
    const padding = EdgeInsets.fromLTRB(Space.s4, Space.s4, Space.s3, Space.s2);
    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: Space.s2,
      children: [
        Row(
          spacing: Space.s3,
          children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: c.synapseSoft, shape: BoxShape.circle),
              child: Icon(Icons.medication_rounded, size: 22, color: c.synapseInk),
            ),
            const Expanded(
              child: Text(
                'Supplements today',
                style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
              ),
            ),
            Text(
              '$taken of ${_items.length} taken',
              style: TextStyle(
                fontSize: TextSize.xs,
                fontWeight: FontWeight.w700,
                color: taken == _items.length ? c.chlorophyll : c.inkSoft,
              ),
            ),
          ],
        ),
        for (final item in _items)
          Semantics(
            checked: item.takenToday,
            label: '${item.name}, ${_dose(item)}${item.runningLow ? ', ${item.daysLeft} days left' : ''}',
            excludeSemantics: true,
            onTap: () => _toggle(item),
            child: InkWell(
              onTap: () => _toggle(item),
              borderRadius: BorderRadius.circular(Radii.option),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: Space.s2),
                child: Row(
                  spacing: Space.s3,
                  children: [
                    // A small pop when ticked off.
                    AnimatedScale(
                      scale: item.takenToday ? 1 : 0.92,
                      duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : Motion.select,
                      curve: Curves.elasticOut,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: item.takenToday ? c.chlorophyll : null,
                          border: Border.all(color: item.takenToday ? c.chlorophyll : c.ruleStrong, width: 2),
                        ),
                        child: item.takenToday ? Icon(Icons.check_rounded, size: 16, color: c.onAccent) : null,
                      ),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.name,
                            style: TextStyle(
                              fontSize: TextSize.sm,
                              fontWeight: FontWeight.w700,
                              color: item.takenToday ? c.inkSoft : c.ink,
                              decoration: item.takenToday ? TextDecoration.lineThrough : null,
                            ),
                          ),
                          Text(
                            _dose(item),
                            style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft),
                          ),
                        ],
                      ),
                    ),
                    if (item.runningLow)
                      Tag(
                        item.daysLeft == 0 ? 'Out' : '${item.daysLeft} days left',
                        fill: c.glucoseSoft,
                        ink: c.glucoseInk,
                      ),
                  ],
                ),
              ),
            ),
          ),
        ..._flagNotes(widget.stack.flags),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(onPressed: widget.onManage, child: const Text('Manage stack')),
        ),
      ],
    );
    return widget.framed ? AppCard(padding: padding, child: body) : Padding(padding: padding, child: body);
  }
}

/// The whole stack: change servings, timing or bottle size, start a new bottle, remove, or add one.
/// With [changes] it is the Stack tab: no back bar, and it reloads when something is logged anywhere.
class StackScreen extends StatefulWidget {
  const StackScreen({super.key, this.changes});

  final Listenable? changes;

  @override
  State<StackScreen> createState() => _StackScreenState();
}

class _StackScreenState extends State<StackScreen> {
  Future<SupplementStack>? _stack;
  Future<SessionsDay>? _sessions;

  @override
  void initState() {
    super.initState();
    widget.changes?.addListener(_reload);
  }

  @override
  void dispose() {
    widget.changes?.removeListener(_reload);
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _stack ??= AppScope.of(context).api.stack();
    _sessions ??= AppScope.of(context).api.sessions();
  }

  void _reload() => setState(() {
    _stack = AppScope.of(context).api.stack();
    _sessions = AppScope.of(context).api.sessions();
  });

  Future<void> _add() async {
    if (await showSupplementSheet(context) == true && mounted) {
      showToast(context, 'Added to your stack');
      _reload();
    }
  }

  Future<void> _edit(StackItem item) async {
    if (await showAppSheet<bool>(context, title: item.name, builder: (_) => _EditStackItem(item)) == true && mounted) {
      _reload();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final tab = widget.changes != null;
    final body = FutureBuilder(
      future: _stack,
      builder: (context, snapshot) => ListView(
        padding: EdgeInsets.fromLTRB(Space.s4, tab ? Space.s4 : 0, Space.s4, Space.s6),
        children: [
          if (tab) ...[
            const ScreenTitle('Your stack', detail: 'Your supplements, gadgets and practices'),
            const BlockTitle('Supplements'),
          ],
          ..._supplements(context, snapshot),
          const BlockTitle('Gadgets and practices'),
          _Practices(_sessions, onLog: () => showSessionSheet(context, onChanged: _reload)),
        ],
      ),
    );
    return tab
        ? SafeArea(bottom: false, child: body)
        : Scaffold(
            appBar: AppBar(
              title: const Text('My stack'),
              backgroundColor: c.mist,
              surfaceTintColor: Colors.transparent,
            ),
            body: body,
          );
  }

  List<Widget> _supplements(BuildContext context, AsyncSnapshot<SupplementStack> snapshot) {
    final c = context.colors;
    if (snapshot.hasError) {
      return [
        ScreenFailed(
          title: "Couldn't load your stack",
          detail: 'Check your connection and try again.',
          onRetry: _reload,
        ),
      ];
    }
    if (!snapshot.hasData) {
      return [
        const ScreenLoading(label: 'Loading your stack', heights: [64, 64, 64]),
      ];
    }
    final stack = snapshot.data!;
    return [
      if (stack.items.isEmpty)
        const EmptyCard(
          title: 'Nothing here yet',
          detail: 'Scan a supplement label and add it, to get a daily checklist and checks across everything you take.',
        )
      else ...[
        ..._flagNotes(stack.flags).map(
          (w) => Padding(
            padding: const EdgeInsets.only(bottom: Space.s2),
            child: w,
          ),
        ),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (final (i, item) in _sorted(stack.items).indexed)
                DecoratedBox(
                  decoration: BoxDecoration(
                    border: i == 0 ? null : Border(top: BorderSide(color: c.rule)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ListTile(
                        title: Text(item.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          spacing: 2,
                          children: [
                            Text(
                              [
                                _dose(item),
                                if (item.daysLeft != null) '${item.daysLeft} days left in the bottle',
                              ].join(' · '),
                            ),
                            if (item.experiment case final e?) ExperimentLine(e),
                          ],
                        ),
                        trailing: Icon(Icons.chevron_right_rounded, color: c.inkSoft),
                        onTap: () => _edit(item),
                      ),
                      if (item.experiment case final e? when e.askFeeling) _FeelingPrompt(item, onAnswered: _reload),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
      const SizedBox(height: Space.s4),
      FilledButton.icon(
        style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
        onPressed: _add,
        icon: const Icon(Icons.document_scanner_outlined, size: 20),
        label: const Text('Scan a supplement to add'),
      ),
    ];
  }
}

/// The gadgets and practices used lately, each tested against the days without, and a way to log one.
class _Practices extends StatelessWidget {
  const _Practices(this.day, {required this.onLog});

  final Future<SessionsDay>? day;
  final VoidCallback onLog;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return FutureBuilder(
      future: day,
      builder: (context, snapshot) {
        final d = snapshot.data;
        final log = OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
            foregroundColor: c.synapseInk,
            side: BorderSide(color: c.ruleStrong, width: 1.5),
          ),
          onPressed: onLog,
          icon: const Icon(Icons.spa_rounded, size: 20),
          label: const Text('Log a session'),
        );
        if (d == null || d.insights.isEmpty) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: Space.s3,
            children: [
              Text(
                'Log a sauna, cold plunge, meditation or blue-blocking glasses, and NeuroCal compares the days after with the days without.',
                style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
              ),
              log,
            ],
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: Space.s3,
          children: [
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (final (i, insight) in d.insights.indexed)
                    ListTile(
                      shape: i == 0 ? null : Border(top: BorderSide(color: c.rule)),
                      leading: Icon(sessionIcon(insight.kind), color: c.ionInk),
                      title: Text(
                        d.info(insight.kind)?.label ?? insight.kind.wire,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        spacing: 2,
                        children: [
                          Text('${insight.sessions} ${insight.sessions == 1 ? 'session' : 'sessions'} in 8 weeks'),
                          ExperimentLine(insight.experiment),
                        ],
                      ),
                      trailing: Icon(Icons.chevron_right_rounded, color: c.inkSoft),
                      onTap: () => showAppSheet<void>(
                        context,
                        title: d.info(insight.kind)?.label ?? insight.kind.wire,
                        builder: (_) => _PracticeDetail(insight, d.info(insight.kind)),
                      ),
                    ),
                ],
              ),
            ),
            log,
          ],
        );
      },
    );
  }
}

/// A practice's comparison and what to expect from it.
class _PracticeDetail extends StatelessWidget {
  const _PracticeDetail(this.insight, this.info);

  final SessionInsight insight;
  final SessionKindInfo? info;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final e = insight.experiment;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: Space.s2,
      children: [
        const GroupLabel('Is it working?', top: 0),
        ExperimentLine(e),
        Text(e.summary, style: const TextStyle(fontSize: TextSize.sm, height: 1.4)),
        if (info case final i?) ...[
          const GroupLabel('What to expect', top: Space.s2),
          Wrap(
            spacing: Space.s2,
            runSpacing: Space.s1,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                'For ${i.purpose.label.toLowerCase()}',
                style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800),
              ),
              Tag(
                Evidence.values.byName(i.evidence).label,
                fill: i.evidence == 'strong' ? c.chlorophyllSoft : c.synapseSoft,
                ink: i.evidence == 'strong' ? c.chlorophyll : c.synapseInk,
              ),
            ],
          ),
          Text(
            i.expectation,
            style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
          ),
        ],
        Text(
          'Other changes, like sleep, stress and coffee, move these numbers too. A personal guide, not proof.',
          style: TextStyle(fontSize: TextSize.xxs, height: 1.4, color: c.inkFaint),
        ),
      ],
    );
  }
}

/// An experiment in a line: is it working yet, coloured by the answer.
class ExperimentLine extends StatelessWidget {
  const ExperimentLine(this.e, {super.key});

  final SupplementExperiment e;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final change = e.change?.abs().round();
    final (icon, color, text) = switch (e.verdict) {
      'helping' => (Icons.trending_up_rounded, c.chlorophyll, 'Working: ${e.measureLabel} up $change'),
      'worse' => (Icons.trending_down_rounded, c.beet, '${_cap(e.measureLabel)} down $change since starting'),
      'no_change' => (Icons.trending_flat_rounded, c.inkSoft, 'No clear change yet'),
      'building' => (Icons.hourglass_top_rounded, c.synapseInk, 'Building · day ${e.day} of about ${e.onsetDays}'),
      'too_early' => (Icons.insights_rounded, c.inkSoft, 'A few more days of data to tell'),
      'need_baseline' => (Icons.insights_rounded, c.inkSoft, 'Collecting your numbers'),
      _ => (Icons.schedule_rounded, c.inkSoft, 'Long-term: no daily number'),
    };
    return Row(
      spacing: 4,
      children: [
        Icon(icon, size: 15, color: color),
        Flexible(
          child: Text(
            text,
            style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: color),
          ),
        ),
      ],
    );
  }
}

String _cap(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

/// "How has it made you feel?", asked at two weeks and four.
class _FeelingPrompt extends StatefulWidget {
  const _FeelingPrompt(this.item, {required this.onAnswered});

  final StackItem item;
  final VoidCallback onAnswered;

  @override
  State<_FeelingPrompt> createState() => _FeelingPromptState();
}

class _FeelingPromptState extends State<_FeelingPrompt> {
  var _busy = false;

  Future<void> _answer(Feeling f) async {
    setState(() => _busy = true);
    try {
      await AppScope.of(context).api.setFeeling(widget.item.id, f);
      if (!mounted) return;
      showToast(context, 'Thanks, noted');
      widget.onAnswered();
    } catch (_) {
      if (mounted) {
        setState(() => _busy = false);
        showToast(context, "Couldn't save that. Try again.", ToastTone.problem);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final weeks = (widget.item.experiment!.day / 7).floor();
    return Padding(
      padding: const EdgeInsets.fromLTRB(Space.s4, 0, Space.s4, Space.s3),
      child: Container(
        padding: const EdgeInsets.all(Space.s3),
        decoration: BoxDecoration(color: c.synapseSoft, borderRadius: BorderRadius.circular(Radii.option)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: Space.s2,
          children: [
            Text(
              '$weeks weeks on ${widget.item.name}: how has it made you feel?',
              style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
            ),
            Wrap(
              spacing: Space.s2,
              runSpacing: Space.s2,
              children: [
                for (final f in Feeling.values)
                  ChoicePill(label: f.label, selected: false, onTap: _busy ? () {} : () => _answer(f)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// "Is it working?" and what to expect from each known ingredient, at the top of the item's sheet.
class _Working extends StatelessWidget {
  const _Working(this.item);

  final StackItem item;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final e = item.experiment!;
    final profile = item.profile;
    String n(double v) => v.round().toString();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: Space.s2,
      children: [
        const GroupLabel('Is it working?', top: 0),
        ExperimentLine(e),
        Text(e.summary, style: const TextStyle(fontSize: TextSize.sm, height: 1.4)),
        if (e.before case final b?)
          if (e.since case final s?)
            Text(
              '${_cap(e.measureLabel)}: ${n(b.mean)} before (${b.days} days), ${n(s.mean)} since (${s.days} days)',
              style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
            ),
        if (e.feeling case final f?)
          Text(
            'You said it makes you feel: ${f.label.toLowerCase()}.',
            style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
          ),
        if (profile != null && profile.ingredients.isNotEmpty) ...[
          const GroupLabel('What to expect', top: Space.s2),
          for (final i in profile.ingredients)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 3,
              children: [
                Wrap(
                  spacing: Space.s2,
                  runSpacing: Space.s1,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      i.name,
                      style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800),
                    ),
                    Tag(
                      Evidence.values.byName(i.evidence).label,
                      fill: i.evidence == 'strong' ? c.chlorophyllSoft : c.synapseSoft,
                      ink: i.evidence == 'strong' ? c.chlorophyll : c.synapseInk,
                    ),
                  ],
                ),
                Text(
                  '${i.purpose.label} · ${i.purpose == SupplementPurpose.longTerm
                      ? 'over months'
                      : i.onsetDays <= 1
                      ? 'the same day'
                      : 'in about ${i.onsetDays} days'}',
                  style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w600, color: c.inkSoft),
                ),
                Text(
                  i.expectation,
                  style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
                ),
              ],
            ),
        ] else
          Text(
            'NeuroCal doesn’t know these ingredients yet, so it watches your Brain speed to see what it does for you.',
            style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
          ),
        Text(
          'Other changes, like sleep, stress and coffee, move these numbers too. A personal guide, not proof.',
          style: TextStyle(fontSize: TextSize.xxs, height: 1.4, color: c.inkFaint),
        ),
        Divider(height: Space.s4, color: c.rule),
      ],
    );
  }
}

class _EditStackItem extends StatefulWidget {
  const _EditStackItem(this.item);

  final StackItem item;

  @override
  State<_EditStackItem> createState() => _EditStackItemState();
}

class _EditStackItemState extends State<_EditStackItem> {
  late int _perDay = widget.item.servingsPerDay;
  late StackTiming _timing = widget.item.timing;
  late final _bottle = TextEditingController(text: widget.item.servingsPerContainer?.toString() ?? '');
  var _newBottle = false;
  var _busy = false;
  String? _error;

  @override
  void dispose() {
    _bottle.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action, String done) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      if (!mounted) return;
      showToast(context, done);
      Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = 'Check your connection and try again.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final api = AppScope.of(context).api;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        if (widget.item.experiment != null) _Working(widget.item),
        const Text(
          'Servings a day',
          style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
        ),
        Row(
          spacing: Space.s2,
          children: [
            for (final n in [1, 2, 3, 4])
              ChoicePill(label: '$n', selected: _perDay == n, onTap: () => setState(() => _perDay = n)),
          ],
        ),
        const Text(
          'When',
          style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
        ),
        Wrap(
          spacing: Space.s2,
          runSpacing: Space.s2,
          children: [
            for (final t in StackTiming.values)
              ChoicePill(label: t.label, selected: _timing == t, onTap: () => setState(() => _timing = t)),
          ],
        ),
        TextField(
          controller: _bottle,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Servings in the bottle'),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _newBottle,
          onChanged: (v) => setState(() => _newBottle = v),
          title: const Text('I started a new bottle today'),
        ),
        if (AppScope.of(context).reminders case final reminders?)
          ListenableBuilder(
            listenable: reminders,
            builder: (context, _) => SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: reminders.remindsAbout(widget.item.id),
              onChanged: (on) => reminders.setSupplementReminder(widget.item.id, on).catchError((Object _) {}),
              title: const Text('Remind me each day'),
              subtitle: Text('A nudge ${_nudgeTime(widget.item.timing)} until it’s ticked off'),
            ),
          ),
        if (_error != null) SheetNote(lead: "Couldn't save.", detail: _error!),
        SheetAction(
          label: _busy ? 'Saving…' : 'Save',
          onPressed: _busy
              ? null
              : () => _run(
                  () => api.updateStackItem(
                    widget.item.id,
                    servingsPerDay: _perDay,
                    timing: _timing,
                    servingsPerContainer: int.tryParse(_bottle.text.trim()) ?? 0,
                    newBottle: _newBottle,
                  ),
                  'Saved',
                ),
        ),
        TextButton(
          style: TextButton.styleFrom(foregroundColor: c.beet),
          onPressed: _busy ? null : () => _run(() => api.removeFromStack(widget.item.id), 'Removed from your stack'),
          child: const Text('Remove from my stack'),
        ),
      ],
    );
  }
}
