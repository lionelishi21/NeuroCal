import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/sheet.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';

/// Log how a session went: deep work, study, training, creative work or gaming, rated for how sharp
/// it felt, with a result where one fits. [initial] picks the activity first. [onChanged] runs after
/// each change.
Future<void> showPerformanceSheet(BuildContext context, {Activity? initial, required VoidCallback onChanged}) =>
    showAppSheet<void>(
      context,
      title: 'Log performance',
      builder: (_) => _LogPerformance(initial: initial, onChanged: onChanged),
    );

IconData activityIcon(Activity activity) => switch (activity) {
  Activity.deepWork => Icons.work_outline_rounded,
  Activity.study => Icons.menu_book_rounded,
  Activity.training => Icons.fitness_center_rounded,
  Activity.creative => Icons.palette_outlined,
  Activity.gaming => Icons.sports_esports_rounded,
};

/// The five steps of sharpness, 1 to 5.
const sharpnessLabels = ['Foggy', 'Slow', 'OK', 'Sharp', 'Locked in'];

/// Every activity's name, before the API has said (the same as the backend's).
String activityLabel(Activity a) => switch (a) {
  Activity.deepWork => 'Deep work',
  Activity.study => 'Study',
  Activity.training => 'Training',
  Activity.creative => 'Creative work',
  Activity.gaming => 'Gaming',
};

String _when(DateTime t) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(t.year, t.month, t.day);
  final clock = '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
  return switch (today.difference(day).inDays) {
    0 => clock,
    1 => 'Yesterday $clock',
    _ => '${day.day}/${day.month} $clock',
  };
}

class _LogPerformance extends StatefulWidget {
  const _LogPerformance({this.initial, required this.onChanged});

  final Activity? initial;
  final VoidCallback onChanged;

  @override
  State<_LogPerformance> createState() => _LogPerformanceState();
}

class _LogPerformanceState extends State<_LogPerformance> {
  PerformanceView? _view;
  Activity? _activity;
  int? _minutes;
  int? _sharpness;
  final _result = TextEditingController();
  final _game = TextEditingController();
  final _wins = TextEditingController();
  final _losses = TextEditingController();
  final _ratingBefore = TextEditingController();
  final _ratingAfter = TextEditingController();
  var _busy = false;
  String? _problem;

  static final _digits = [FilteringTextInputFormatter.digitsOnly];

  @override
  void initState() {
    super.initState();
    _activity = widget.initial;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_view == null) {
      AppScope.of(context).api
          .performance()
          .then((v) {
            if (!mounted) return;
            setState(() {
              _view = v;
              if (_activity case final a?) _pick(a);
            });
          })
          .catchError((Object _) {
            if (mounted) setState(() => _problem = "Couldn't load your sessions. Check your connection.");
          });
    }
  }

  @override
  void dispose() {
    for (final c in [_result, _game, _wins, _losses, _ratingBefore, _ratingAfter]) {
      c.dispose();
    }
    super.dispose();
  }

  /// Picks an activity, with its usual length and, for gaming, the last game and rating.
  void _pick(Activity a) {
    _activity = a;
    _minutes = _view?.info(a)?.usualMinutes ?? _minutes;
    _result.clear();
    if (a == Activity.gaming) {
      final last = _view?.recent.where((s) => s.activity == Activity.gaming).firstOrNull;
      if (_game.text.isEmpty && last?.game != null) _game.text = last!.game!;
      if (_ratingBefore.text.isEmpty && last?.ratingAfter != null) _ratingBefore.text = '${last!.ratingAfter}';
    }
  }

  int? _number(TextEditingController c) => int.tryParse(c.text.trim());

  Future<void> _log() async {
    setState(() {
      _busy = true;
      _problem = null;
    });
    final gaming = _activity == Activity.gaming;
    final result = num.tryParse(_result.text.trim());
    final game = _game.text.trim();
    try {
      final view = await AppScope.of(context).api.logPerformance(
        activity: _activity!,
        minutes: _minutes!,
        sharpness: _sharpness!,
        result: _view?.info(_activity!)?.result == null ? null : result,
        game: gaming && game.isNotEmpty ? game : null,
        wins: gaming ? _number(_wins) : null,
        losses: gaming ? _number(_losses) : null,
        ratingBefore: gaming ? _number(_ratingBefore) : null,
        ratingAfter: gaming ? _number(_ratingAfter) : null,
      );
      if (!mounted) return;
      AppScope.of(context).analytics.track('logged', {'kind': 'performance', 'activity': _activity!.wire});
      showToast(context, 'Performance logged');
      setState(() {
        _view = view;
        _sharpness = null;
        _result.clear();
        _wins.clear();
        _losses.clear();
        // The next session usually starts where this one ended.
        if (_ratingAfter.text.isNotEmpty) _ratingBefore.text = _ratingAfter.text;
        _ratingAfter.clear();
      });
      widget.onChanged();
    } catch (_) {
      if (mounted) setState(() => _problem = "Couldn't log it. Check the numbers and your connection, then try again.");
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _remove(PerformanceSession s) async {
    try {
      await AppScope.of(context).api.deletePerformance(s.id);
      if (!mounted) return;
      final v = _view!;
      setState(() {
        _view = PerformanceView(
          date: v.date,
          recent: [
            for (final x in v.recent)
              if (x.id != s.id) x,
          ],
          activities: v.activities,
          summaries: v.summaries,
        );
      });
      widget.onChanged();
    } catch (_) {
      if (mounted) showToast(context, "Couldn't remove the session. Try again.", ToastTone.problem);
    }
  }

  Widget _field(TextEditingController c, String label, {String? suffix, bool decimal = false}) => TextField(
    controller: c,
    keyboardType: TextInputType.numberWithOptions(decimal: decimal),
    inputFormatters: decimal ? null : _digits,
    decoration: InputDecoration(labelText: label, suffixText: suffix),
  );

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final view = _view;
    if (view == null) {
      return _problem == null
          ? const Padding(
              padding: EdgeInsets.all(Space.s5),
              child: Center(child: CircularProgressIndicator()),
            )
          : SheetNote(lead: "Couldn't load.", detail: _problem!);
    }
    final info = _activity == null ? null : view.info(_activity!);
    final usual = info?.usualMinutes ?? 60;
    final lengths = {30, 60, 90, 120, 180, usual}.toList()..sort();
    final ready = _activity != null && _minutes != null && _sharpness != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        Text(
          'Log it when you finish. After a few, NeuroCal shows what goes with your best sessions.',
          style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
        ),
        Wrap(
          spacing: Space.s2,
          runSpacing: Space.s2,
          children: [
            for (final a in view.activities)
              ChoiceChip(
                avatar: Icon(activityIcon(a.activity), size: 18),
                label: Text(a.label),
                selected: _activity == a.activity,
                onSelected: (_) => setState(() => _pick(a.activity)),
              ),
          ],
        ),
        if (info != null) ...[
          const GroupLabel('How long', top: 0),
          Wrap(
            spacing: Space.s2,
            runSpacing: Space.s2,
            children: [
              for (final m in lengths)
                ChoicePill(
                  label: m < 60 || m % 60 != 0 ? '$m min' : '${m ~/ 60} h',
                  selected: _minutes == m,
                  onTap: () => setState(() => _minutes = m),
                ),
            ],
          ),
          const GroupLabel('How sharp did you feel?', top: 0),
          Wrap(
            spacing: Space.s2,
            runSpacing: Space.s2,
            children: [
              for (var i = 1; i <= 5; i++)
                ChoicePill(
                  label: '$i · ${sharpnessLabels[i - 1]}',
                  selected: _sharpness == i,
                  onTap: () => setState(() => _sharpness = i),
                ),
            ],
          ),
          if (info.result case final r?) _field(_result, '${r.label} (optional)', suffix: r.unit, decimal: true),
          if (info.activity == Activity.gaming) ...[
            TextField(
              controller: _game,
              textCapitalization: TextCapitalization.words,
              maxLength: 60,
              decoration: const InputDecoration(
                labelText: 'Game (optional)',
                hintText: 'Street Fighter 6',
                counterText: '',
              ),
            ),
            Row(
              spacing: Space.s3,
              children: [
                Expanded(child: _field(_wins, 'Wins')),
                Expanded(child: _field(_losses, 'Losses')),
              ],
            ),
            Row(
              spacing: Space.s3,
              children: [
                Expanded(child: _field(_ratingBefore, 'Rating before')),
                Expanded(child: _field(_ratingAfter, 'Rating after')),
              ],
            ),
            Text(
              'Ranked points, MMR or Elo: whatever your game shows. All optional.',
              style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
            ),
          ],
        ],
        if (_problem != null) SheetNote(lead: "Couldn't log it.", detail: _problem!),
        SheetAction(
          label: _busy
              ? 'Logging…'
              : _activity == null
              ? 'Pick what you did'
              : _sharpness == null
              ? 'Rate how sharp you felt'
              : 'Log performance',
          onPressed: _busy || !ready ? null : _log,
        ),
        if (view.recent.isNotEmpty) ...[
          const GroupLabel('Recent', top: Space.s2),
          for (final s in view.recent.take(5))
            Row(
              spacing: Space.s2,
              children: [
                Icon(activityIcon(s.activity), size: 20, color: c.inkSoft),
                Expanded(
                  child: Text(
                    '${_when(s.startedAt)} · ${view.info(s.activity)?.label ?? activityLabel(s.activity)} · '
                    '${s.sharpness}/5',
                    style: const TextStyle(fontSize: TextSize.sm),
                  ),
                ),
                IconButton(
                  tooltip: 'Remove this session',
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

/// Performance on Progress: what someone wants to be sharp for and what goes with their best
/// sessions. Before any session, it asks what they want to be sharp for.
class PerformanceSection extends StatelessWidget {
  const PerformanceSection(this.view, {super.key, required this.onLog, required this.onRetry});

  /// Null when it didn't load.
  final PerformanceView? view;
  final void Function(Activity?) onLog;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final v = view;
    if (v == null) {
      return ScreenFailed(
        title: "Couldn't load your sessions",
        detail: 'Check your connection and try again.',
        onRetry: onRetry,
      );
    }
    if (v.summaries.isEmpty) {
      return EmptyCard(
        title: 'What do you want to be sharp for?',
        detail:
            'Log a session when you finish one. After a few, NeuroCal shows what goes with your best ones: '
            'sleep, caffeine, meals, the time of day.',
        action: Wrap(
          spacing: Space.s2,
          runSpacing: Space.s2,
          children: [
            for (final a in Activity.values)
              ActionChip(
                avatar: Icon(activityIcon(a), size: 18),
                label: Text(v.info(a)?.label ?? activityLabel(a)),
                onPressed: () => onLog(a),
              ),
          ],
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: Space.s3,
      children: [
        for (final s in v.summaries)
          _ActivityCard(s, label: v.info(s.activity)?.label ?? activityLabel(s.activity), info: v.info(s.activity)),
        Text(
          'Patterns from your own sessions: they show what goes together, not what causes what.',
          style: TextStyle(fontSize: TextSize.xs, color: c.inkFaint),
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: SoftButton(label: 'Log performance', onPressed: () => onLog(null)),
        ),
      ],
    );
  }
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard(this.summary, {required this.label, this.info});

  final ActivitySummary summary;
  final String label;
  final ActivityInfo? info;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final s = summary;
    final facts = [
      '${s.sessions} ${s.sessions == 1 ? 'session' : 'sessions'}',
      'sharpness ${s.sharpness.toStringAsFixed(1)}/5',
      if (s.wins != null || s.losses != null) '${s.wins ?? 0}–${s.losses ?? 0}',
      if (s.ratingChange case final r?) 'rating ${r >= 0 ? '+' : '−'}${r.abs()}',
      if ((s.bestResult, info?.result) case (final best?, final r?))
        'best ${best % 1 == 0 ? best.toInt() : best}${r.unit ?? ' ${r.label.toLowerCase()}'}',
    ];
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: Space.s2,
        children: [
          Row(
            spacing: Space.s3,
            children: [
              Icon(activityIcon(s.activity), color: c.synapseInk),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 2,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
                    ),
                    Text(
                      '${facts.join(' · ')} · last 8 weeks',
                      style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                    ),
                  ],
                ),
              ),
            ],
          ),
          for (final i in s.insights)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: Space.s2,
              children: [
                Icon(i.winRate ? Icons.emoji_events_outlined : Icons.bolt_rounded, size: 18, color: c.chlorophyll),
                Expanded(
                  child: Text(i.summary, style: const TextStyle(fontSize: TextSize.sm, height: 1.4)),
                ),
              ],
            ),
          if (s.note case final note?)
            Text(
              note,
              style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
            ),
        ],
      ),
    );
  }
}
