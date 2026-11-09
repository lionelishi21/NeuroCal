import 'package:flutter/material.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/sheet.dart';

/// "Plan a fast": fast until a time, for a day without meals or a longer fast. The choices count from
/// the last meal (or now) and stop at the limit the API allows: past the usual limit (48 hours), only
/// once the person ticks that they've checked with their doctor. Returns the new status, or null.
Future<FastingStatus?> showPlanFastSheet(BuildContext context, FastingStatus? status) =>
    showAppSheet<FastingStatus>(context, title: 'Plan a fast', builder: (_) => _PlanFast(status));

String _clock(DateTime t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

/// "12:00 tomorrow", "20:30 today".
String fastEnd(DateTime t, DateTime now) {
  final day = DateTime(t.year, t.month, t.day).difference(DateTime(now.year, now.month, now.day)).inDays;
  final when = switch (day) {
    0 => 'today',
    1 => 'tomorrow',
    _ => const ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][t.weekday - 1],
  };
  return '${_clock(t)} $when';
}

class _PlanFast extends StatefulWidget {
  const _PlanFast(this.status);

  final FastingStatus? status;

  @override
  State<_PlanFast> createState() => _PlanFastState();
}

class _PlanFastState extends State<_PlanFast> {
  DateTime? _until;
  var _busy = false;
  var _doctorChecked = false;
  String? _problem;

  /// What the fast counts from, like the API: the last meal while it's within the limit, otherwise now.
  DateTime get _from {
    final now = DateTime.now();
    final last = widget.status?.lastMealAt;
    return last != null && now.difference(last).inMinutes < _limit * 60 ? last : now;
  }

  /// The usual limit, and the one after a doctor check (0 when not offered).
  int get _usual => widget.status?.planLimitHours ?? 48;
  int get _long => widget.status?.longPlanLimitHours ?? 0;

  /// The longest fast this sheet offers at all.
  int get _limit => _long > _usual ? _long : _usual;

  bool _fits(DateTime until, DateTime now) =>
      until.difference(now).inMinutes >= 30 && until.difference(_from).inMinutes <= _limit * 60;

  /// Longer than the usual limit: needs the doctor check.
  bool _isLong(DateTime until) => until.difference(_from).inMinutes > _usual * 60;

  List<({String label, DateTime until})> _choices(DateTime now) {
    final tomorrow = DateTime(now.year, now.month, now.day + 1);
    return [
      for (final c in [
        (label: 'Until noon tomorrow', until: tomorrow.add(const Duration(hours: 12))),
        (label: '16 hours', until: _from.add(const Duration(hours: 16))),
        (label: '24 hours', until: _from.add(const Duration(hours: 24))),
        (label: '48 hours', until: _from.add(const Duration(hours: 48))),
        (label: '72 hours', until: _from.add(const Duration(hours: 72))),
      ])
        if (_fits(c.until, now)) c,
    ];
  }

  /// A day (today up to the limit), then a time on it.
  Future<void> _pickTime() async {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final last = _from.add(Duration(hours: _limit));
    final day = await showDatePicker(
      context: context,
      helpText: 'Fast until which day?',
      initialDate: today.add(const Duration(days: 1)).isAfter(last) ? today : today.add(const Duration(days: 1)),
      firstDate: today,
      lastDate: DateTime(last.year, last.month, last.day),
    );
    if (day == null || !mounted) return;
    final picked = await showTimePicker(
      context: context,
      helpText: 'Until what time?',
      initialTime: const TimeOfDay(hour: 12, minute: 0),
    );
    if (picked == null || !mounted) return;
    final until = DateTime(day.year, day.month, day.day, picked.hour, picked.minute);
    setState(() {
      _until = until;
      _problem = !until.isAfter(now.add(const Duration(minutes: 29)))
          ? 'Pick an end at least half an hour from now.'
          : _fits(until, now)
          ? null
          : 'That’s longer than $_limit hours from your last meal. Pick an earlier time.';
    });
  }

  Future<void> _start() async {
    final until = _until;
    if (until == null) return;
    setState(() {
      _busy = true;
      _problem = null;
    });
    try {
      final status = await AppScope.of(context).api.planFast(until, longFast: _isLong(until));
      if (mounted) Navigator.of(context).pop(status);
    } on ApiException catch (e) {
      if (mounted) setState(() => _problem = e.status == 400 ? e.message : 'Try again in a moment.');
    } catch (_) {
      if (mounted) setState(() => _problem = 'Check your connection and try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final now = DateTime.now();
    if (_limit == 0) {
      return const SheetNote(
        lead: 'Not with your health profile.',
        detail: 'Fasting isn’t advised with the conditions in your profile. Check with your clinician first.',
      );
    }
    final choices = _choices(now);
    final until = _until;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        Text(
          [
            'Today and the timer switch to your fast until it ends. Logging a meal ends it early.',
            if (widget.status?.lastMealAt case final last? when _from == last)
              'It counts from your last meal, at ${fastEnd(last, now)}.',
          ].join(' '),
          style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
        ),
        for (final choice in choices)
          ChoicePill(
            label: '${choice.label} · ends ${fastEnd(choice.until, now)}',
            semanticLabel: '${choice.label}, ends ${fastEnd(choice.until, now)}',
            radius: Radii.option,
            selected: until == choice.until,
            onTap: () => setState(() {
              _until = choice.until;
              _problem = null;
            }),
          ),
        ChoicePill(
          label: until != null && !choices.any((ch) => ch.until == until)
              ? 'Until ${fastEnd(until, now)}'
              : 'Pick a time',
          radius: Radii.option,
          selected: until != null && !choices.any((ch) => ch.until == until),
          onTap: _pickTime,
        ),
        Text(
          _long > _usual
              ? 'Water, black coffee and plain tea don’t break your fast. Up to $_usual hours from your last meal, or $_long once you’ve checked with your doctor.'
              : 'Water, black coffee and plain tea don’t break your fast. Up to $_usual hours from your last meal; check with your clinician before longer fasts.',
          style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
        ),
        if (until != null && until.difference(_from) > const Duration(hours: 24))
          const SheetNote(
            lead: 'Over 24 hours.',
            detail: 'Check with your clinician first. Keep drinking water, take electrolytes (a pinch of salt, potassium, magnesium), and stop if you feel dizzy, faint or unwell. Break the fast with a small meal.',
            watch: true,
          ),
        if (until != null && _isLong(until))
          CheckboxListTile(
            value: _doctorChecked,
            onChanged: (on) => setState(() => _doctorChecked = on == true),
            controlAffinity: ListTileControlAffinity.leading,
            contentPadding: EdgeInsets.zero,
            title: Text(
              'I’ve checked with my doctor that a fast over $_usual hours is safe for me',
              style: const TextStyle(fontSize: TextSize.sm, height: 1.35),
            ),
          ),
        if (_problem != null) SheetNote(lead: 'Can’t plan that.', detail: _problem!),
        SheetAction(
          label: _busy ? 'Starting…' : 'Start fasting',
          onPressed: _busy || until == null || !_fits(until, now) || (_isLong(until) && !_doctorChecked)
              ? null
              : _start,
        ),
      ],
    );
  }
}
