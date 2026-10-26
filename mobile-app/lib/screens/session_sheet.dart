import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../combos.dart' show Evidence;
import '../theme/tokens.dart';
import '../widgets/sheet.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';

/// Log a gadget or practice session: a sauna, a cold plunge, meditation, blue-blocking glasses. Each
/// says what to expect first; today's sessions are listed below. [onChanged] runs after each change.
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
  SessionKind.blueBlocking => Icons.dark_mode_rounded,
  SessionKind.redLight => Icons.wb_twilight_rounded,
};

String _clock(DateTime t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

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
  });

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
          const GroupLabel('How long', top: 0),
          Wrap(
            spacing: Space.s2,
            runSpacing: Space.s2,
            children: [
              for (final m in lengths)
                ChoicePill(label: '$m min', selected: _minutes == m, onTap: () => setState(() => _minutes = m)),
            ],
          ),
        ],
        if (_problem != null) SheetNote(lead: "Couldn't log it.", detail: _problem!),
        SheetAction(
          label: _busy ? 'Logging…' : (_kind == null ? 'Pick a session' : 'Log session'),
          onPressed: _busy || _kind == null ? null : _log,
        ),
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
