import 'package:flutter/material.dart';

import '../api/api.dart' show ApiException;
import '../api/models.dart';
import '../app_scope.dart';
import '../combos.dart' show Evidence;
import '../theme/tokens.dart';
import '../widgets/sheet.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';

/// Log a gadget or practice session: a sauna, a cold plunge, meditation, blue-blocking glasses. Each
/// says what to expect first; today's sessions are listed below. A subscription that runs for weeks
/// (Quantum Upgrade) is started instead, with a start date and how long it runs, and listed as
/// running until it ends or is stopped. [onChanged] runs after each change.
Future<void> showSessionSheet(BuildContext context, {required VoidCallback onChanged}) => showAppSheet<void>(
  context,
  title: 'Log a session',
  builder: (_) => _LogSession(onChanged: onChanged),
);

IconData sessionIcon(SessionKind kind) => switch (kind) {
  SessionKind.sauna => Icons.hot_tub_rounded,
  SessionKind.coldPlunge => Icons.ac_unit_rounded,
  SessionKind.meditation => Icons.self_improvement_rounded,
  SessionKind.breathwork => Icons.air_rounded,
  SessionKind.braintap => Icons.headphones_rounded,
  SessionKind.quantumUpgrade => Icons.graphic_eq_rounded,
  SessionKind.blueBlocking => Icons.dark_mode_rounded,
  SessionKind.redLight => Icons.wb_twilight_rounded,
};

String _clock(DateTime t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
String _date(DateTime t) => '${t.day} ${_months[t.month - 1]}';
DateTime _dayOf(DateTime t) => DateTime(t.year, t.month, t.day);

/// How long a period runs: a number of months, or until it's stopped (null).
const _runs = <(String, int?)>[('1 month', 1), ('3 months', 3), ('Ongoing', null)];

/// When a running period is due to end, in words.
String periodLine(LoggedSession s, DateTime now) {
  if (s.takenAt.isAfter(now)) {
    return 'Starts ${_date(s.takenAt)}${s.endsAt == null ? '' : ', until ${_date(s.endsAt!)}'}';
  }
  return 'Since ${_date(s.takenAt)} · ${s.endsAt == null ? 'until you stop it' : 'until ${_date(s.endsAt!)}'}';
}

class _LogSession extends StatefulWidget {
  const _LogSession({required this.onChanged});

  final VoidCallback onChanged;

  @override
  State<_LogSession> createState() => _LogSessionState();
}

class _LogSessionState extends State<_LogSession> {
  SessionsDay? _day;
  SessionKind? _kind;
  int? _minutes;

  /// For a period: the day it starts, and how many months it runs (null: until stopped).
  DateTime _startsOn = _dayOf(DateTime.now());
  int? _runMonths = 1;
  var _busy = false;
  String? _problem;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_day == null) {
      AppScope.of(context).api
          .sessions()
          .then((d) {
            if (mounted) setState(() => _day = d);
          })
          .catchError((Object _) {
            if (mounted) setState(() => _problem = "Couldn't load your sessions. Check your connection.");
          });
    }
  }

  void _pick(SessionKind kind) => setState(() {
    _kind = kind;
    _minutes = _day?.info(kind)?.usualMinutes;
    _startsOn = _dayOf(DateTime.now());
    _runMonths = 1;
  });

  Future<void> _pickStart() async {
    final today = _dayOf(DateTime.now());
    final picked = await showDatePicker(
      context: context,
      initialDate: _startsOn,
      firstDate: today.subtract(const Duration(days: 365)),
      lastDate: today.add(const Duration(days: 30)),
      helpText: 'When it started',
    );
    if (picked != null && mounted) setState(() => _startsOn = picked);
  }

  Future<void> _start(SessionKindInfo info) async {
    setState(() {
      _busy = true;
      _problem = null;
    });
    final now = DateTime.now();
    // Today starts now; another day starts at its beginning.
    final startsAt = _startsOn == _dayOf(now) ? now : _startsOn;
    final months = _runMonths;
    final endsAt = months == null
        ? null
        : DateTime(startsAt.year, startsAt.month + months, startsAt.day, startsAt.hour, startsAt.minute);
    try {
      final day = await AppScope.of(context).api.startPeriod(info.kind, startsAt: startsAt, endsAt: endsAt);
      if (!mounted) return;
      showToast(context, endsAt != null && !endsAt.isAfter(now) ? '${info.label} added' : '${info.label} started');
      setState(() => _day = day);
      widget.onChanged();
    } on ApiException catch (e) {
      if (mounted) setState(() => _problem = e.message);
    } catch (_) {
      if (mounted) setState(() => _problem = "Couldn't start it. Check your connection and try again.");
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _stop(LoggedSession s) async {
    final label = _day?.info(s.kind)?.label ?? 'Session';
    try {
      final day = await AppScope.of(context).api.endSession(s.id);
      if (!mounted) return;
      showToast(context, '$label stopped');
      setState(() => _day = day);
      widget.onChanged();
    } catch (_) {
      if (mounted) showToast(context, "Couldn't stop $label. Try again.", ToastTone.problem);
    }
  }

  Future<void> _log() async {
    setState(() {
      _busy = true;
      _problem = null;
    });
    try {
      final day = await AppScope.of(context).api.logSession(_kind!, minutes: _minutes);
      if (!mounted) return;
      showToast(context, 'Session logged');
      setState(() => _day = day);
      widget.onChanged();
    } catch (_) {
      if (mounted) setState(() => _problem = "Couldn't log the session. Check your connection and try again.");
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _remove(LoggedSession s) async {
    try {
      await AppScope.of(context).api.deleteSession(s.id);
      if (!mounted) return;
      final day = _day!;
      setState(() {
        _day = SessionsDay(
          date: day.date,
          sessions: [
            for (final x in day.sessions)
              if (x.id != s.id) x,
          ],
          running: [
            for (final x in day.running)
              if (x.id != s.id) x,
          ],
          kinds: day.kinds,
          insights: day.insights,
        );
      });
      widget.onChanged();
    } catch (_) {
      if (mounted) showToast(context, "Couldn't remove the session. Try again.", ToastTone.problem);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final day = _day;
    if (day == null) {
      return _problem == null
          ? const Padding(
              padding: EdgeInsets.all(Space.s5),
              child: Center(child: CircularProgressIndicator()),
            )
          : SheetNote(lead: "Couldn't load.", detail: _problem!);
    }
    final info = _kind == null ? null : day.info(_kind!);
    final usual = info?.usualMinutes ?? 10;
    // A few lengths around the usual one.
    final lengths = {(usual / 2).round().clamp(1, 600), usual, usual * 2}.toList()..sort();
    final today = _dayOf(DateTime.now());
    final otherDay = _startsOn != today && _startsOn != today.subtract(const Duration(days: 1));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        Wrap(
          spacing: Space.s2,
          runSpacing: Space.s2,
          children: [
            for (final k in day.kinds)
              ChoiceChip(
                avatar: Icon(sessionIcon(k.kind), size: 18),
                label: Text(k.label),
                selected: _kind == k.kind,
                onSelected: (_) => _pick(k.kind),
              ),
          ],
        ),
        if (info != null) ...[
          Container(
            padding: const EdgeInsets.all(Space.s3),
            decoration: BoxDecoration(color: c.synapseSoft, borderRadius: BorderRadius.circular(Radii.option)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: Space.s1,
              children: [
                Wrap(
                  spacing: Space.s2,
                  runSpacing: Space.s1,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      'For ${info.purpose.label.toLowerCase()}',
                      style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800, color: c.synapseInk),
                    ),
                    Tag(Evidence.values.byName(info.evidence).label, fill: c.paper, ink: c.synapseInk),
                  ],
                ),
                Text(info.expectation, style: const TextStyle(fontSize: TextSize.xs, height: 1.4)),
              ],
            ),
          ),
          if (info.period) ...[
            const GroupLabel('Started', top: 0),
            _Pills([
              for (final (label, back) in [('Today', 0), ('Yesterday', 1)])
                ChoicePill(
                  label: label,
                  selected: _startsOn == today.subtract(Duration(days: back)),
                  onTap: () => setState(() => _startsOn = today.subtract(Duration(days: back))),
                ),
              ChoicePill(label: otherDay ? _date(_startsOn) : 'Other day', selected: otherDay, onTap: _pickStart),
            ]),
            const GroupLabel('Runs for', top: 0),
            _Pills([
              for (final (label, months) in _runs)
                ChoicePill(
                  label: label,
                  selected: _runMonths == months,
                  onTap: () => setState(() => _runMonths = months),
                ),
            ]),
          ] else ...[
            const GroupLabel('How long', top: 0),
            _Pills([
              for (final m in lengths)
                ChoicePill(label: '$m min', selected: _minutes == m, onTap: () => setState(() => _minutes = m)),
            ]),
          ],
        ],
        if (_problem != null)
          SheetNote(lead: info?.period == true ? "Couldn't start it." : "Couldn't log it.", detail: _problem!),
        if (info != null && info.period)
          SheetAction(label: _busy ? 'Starting…' : 'Start ${info.label}', onPressed: _busy ? null : () => _start(info))
        else
          SheetAction(
            label: _busy ? 'Logging…' : (_kind == null ? 'Pick a session' : 'Log session'),
            onPressed: _busy || _kind == null ? null : _log,
          ),
        if (day.running.isNotEmpty) ...[
          const GroupLabel('Running', top: Space.s2),
          for (final s in day.running)
            Row(
              spacing: Space.s1,
              children: [
                Icon(sessionIcon(s.kind), size: 20, color: c.inkSoft),
                const SizedBox(width: Space.s1),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        day.info(s.kind)?.label ?? s.kind.wire,
                        style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
                      ),
                      Text(
                        periodLine(s, DateTime.now()),
                        style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                      ),
                    ],
                  ),
                ),
                if (!s.takenAt.isAfter(DateTime.now()))
                  TextButton(onPressed: () => _stop(s), child: const Text('Stop')),
                IconButton(
                  tooltip: 'Remove ${day.info(s.kind)?.label ?? 'session'}',
                  onPressed: () => _remove(s),
                  icon: Icon(Icons.close_rounded, size: 18, color: c.inkSoft),
                ),
              ],
            ),
        ],
        if (day.sessions.isNotEmpty) ...[
          const GroupLabel('Today', top: Space.s2),
          for (final s in day.sessions)
            Row(
              spacing: Space.s2,
              children: [
                Icon(sessionIcon(s.kind), size: 20, color: c.inkSoft),
                Expanded(
                  child: Text(
                    '${_clock(s.takenAt)} · ${day.info(s.kind)?.label ?? s.kind.wire}${s.minutes == null ? '' : ' · ${s.minutes} min'}',
                    style: const TextStyle(fontSize: TextSize.sm),
                  ),
                ),
                IconButton(
                  tooltip: 'Remove ${day.info(s.kind)?.label ?? 'session'}',
                  onPressed: () => _remove(s),
                  icon: Icon(Icons.close_rounded, size: 18, color: c.inkSoft),
                ),
              ],
            ),
        ],
      ],
    );
  }
}

/// Options side by side, sharing the width.
class _Pills extends StatelessWidget {
  const _Pills(this.children);

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Row(
    spacing: Space.s2,
    children: [for (final c in children) Expanded(child: c)],
  );
}
