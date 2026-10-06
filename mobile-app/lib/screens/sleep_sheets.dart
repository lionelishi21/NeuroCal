import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../nights.dart';
import '../theme/tokens.dart';
import '../widgets/sheet.dart';

/// Bedtime today, or yesterday when it is later than the wake time.
({DateTime start, DateTime end}) sleepWindow(TimeOfDay bed, TimeOfDay wake, DateTime now) {
  final end = DateTime(now.year, now.month, now.day, wake.hour, wake.minute);
  var start = DateTime(now.year, now.month, now.day, bed.hour, bed.minute);
  if (!start.isBefore(end)) start = start.subtract(const Duration(days: 1));
  return (start: start, end: end);
}

/// Last night's late-screen window: yesterday 22:00 to today 04:00, local time (ARCHITECTURE §6.8).
({DateTime start, DateTime end}) lateScreenWindow(DateTime now) {
  final start = DateTime(now.year, now.month, now.day - 1, 22);
  return (start: start, end: start.add(const Duration(hours: 6)));
}

String _hhmm(TimeOfDay t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

/// When you went to bed and woke up. Returns true when logged.
Future<bool?> showLogSleepSheet(BuildContext context) =>
    showAppSheet<bool>(context, title: 'Log sleep', builder: (_) => const _LogSleep());

class _LogSleep extends StatefulWidget {
  const _LogSleep();

  @override
  State<_LogSleep> createState() => _LogSleepState();
}

class _LogSleepState extends State<_LogSleep> {
  var _bed = const TimeOfDay(hour: 23, minute: 0);
  var _wake = const TimeOfDay(hour: 7, minute: 0);
  var _busy = false;
  var _failed = false;

  Future<void> _pick(bool bed) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: bed ? _bed : _wake,
      helpText: bed ? 'Went to bed' : 'Woke up',
      builder: (context, child) =>
          MediaQuery(data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true), child: child!),
    );
    if (picked != null) setState(() => bed ? _bed = picked : _wake = picked);
  }

  Future<void> _save(DateTime start, DateTime end) async {
    setState(() {
      _busy = true;
      _failed = false;
    });
    try {
      await AppScope.of(context).api.logSleep(start, end);
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _failed = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final now = DateTime.now();
    final span = sleepWindow(_bed, _wake, now);
    final future = span.end.isAfter(now.add(const Duration(minutes: 5)));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        Row(
          spacing: 10,
          children: [
            Expanded(
              child: _TimeField(label: 'Went to bed', value: _hhmm(_bed), onTap: () => _pick(true)),
            ),
            Expanded(
              child: _TimeField(label: 'Woke up', value: _hhmm(_wake), problem: future, onTap: () => _pick(false)),
            ),
          ],
        ),
        if (future)
          SheetNote(
            lead: "That wake-up time hasn't happened yet.",
            detail: "It's ${_hhmm(TimeOfDay.fromDateTime(now))} now. Pick a time from this morning.",
          )
        else
          Container(
            padding: const EdgeInsets.symmetric(horizontal: Space.s4, vertical: 14),
            decoration: BoxDecoration(color: c.synapseSoft, borderRadius: BorderRadius.circular(Radii.control)),
            child: MergeSemantics(
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'You slept',
                      style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w600, color: c.synapseInk),
                    ),
                  ),
                  Text(
                    slept(span.end.difference(span.start).inMinutes),
                    style: TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800, color: c.synapseInk),
                  ),
                ],
              ),
            ),
          ),
        if (_failed) const SheetNote(lead: "Couldn't save your sleep.", detail: 'Check your connection and try again.'),
        SheetAction(
          label: _busy ? 'Logging…' : 'Log sleep',
          onPressed: _busy || future ? null : () => _save(span.start, span.end),
        ),
      ],
    );
  }
}

/// A big tappable time that opens the platform's time picker.
class _TimeField extends StatelessWidget {
  const _TimeField({required this.label, required this.value, required this.onTap, this.problem = false});

  final String label;
  final String value;
  final VoidCallback onTap;
  final bool problem;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final shape = BorderRadius.circular(Radii.control);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 6,
      children: [
        ExcludeSemantics(
          child: Text(
            label,
            style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
          ),
        ),
        Semantics(
          button: true,
          label: '$label, $value',
          excludeSemantics: true,
          child: Material(
            color: c.mist,
            shape: RoundedRectangleBorder(
              borderRadius: shape,
              side: BorderSide(color: problem ? c.beet : c.rule, width: 1.5),
            ),
            child: InkWell(
              borderRadius: shape,
              onTap: onTap,
              child: Container(
                height: 56,
                alignment: Alignment.centerLeft,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Text(
                  value,
                  style: const TextStyle(
                    fontSize: TextSize.xl,
                    fontWeight: FontWeight.w700,
                    fontFeatures: [FontFeature.tabularFigures()],
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

/// Minutes on screens after 22:00 last night. Returns true when logged.
Future<bool?> showLogScreenTimeSheet(BuildContext context) =>
    showAppSheet<bool>(context, title: 'Log screen time', builder: (_) => const _LogScreenTime());

class _LogScreenTime extends StatefulWidget {
  const _LogScreenTime();

  @override
  State<_LogScreenTime> createState() => _LogScreenTimeState();
}

class _LogScreenTimeState extends State<_LogScreenTime> {
  final _typed = TextEditingController(text: '30');
  var _busy = false;
  var _failed = false;

  @override
  void initState() {
    super.initState();
    _typed.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _typed.dispose();
    super.dispose();
  }

  Future<void> _save(int minutes) async {
    setState(() {
      _busy = true;
      _failed = false;
    });
    try {
      final window = lateScreenWindow(DateTime.now());
      await AppScope.of(context).api.logScreenTime(window.start, window.end, minutes);
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _failed = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final minutes = int.tryParse(_typed.text);
    final valid = minutes != null && minutes >= 0 && minutes <= 360;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        Text(
          'Minutes on screens after 22:00 last night.',
          style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
        ),
        Row(
          spacing: 6,
          children: [
            for (final pick in const [0, 15, 30, 60, 90])
              Expanded(
                child: ChoicePill(
                  label: pick == 0 ? 'None' : '$pick',
                  semanticLabel: pick == 0 ? 'None' : '$pick minutes',
                  selected: minutes == pick,
                  radius: Radii.option,
                  height: 48,
                  onTap: () => _typed.text = '$pick',
                ),
              ),
          ],
        ),
        Container(
          height: 56,
          padding: const EdgeInsets.symmetric(horizontal: Space.s4),
          decoration: BoxDecoration(
            color: c.mist,
            borderRadius: BorderRadius.circular(Radii.control),
            border: valid ? null : Border.all(color: c.beet, width: 1.5),
          ),
          child: Row(
            children: [
              SizedBox(
                width: 80,
                child: TextField(
                  controller: _typed,
                  keyboardType: TextInputType.number,
                  maxLength: 3,
                  style: const TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800),
                  decoration: const InputDecoration.collapsed(
                    hintText: '0',
                  ).copyWith(counterText: '', filled: false, semanticCounterText: ''),
                ),
              ),
              Text(
                'minutes',
                style: TextStyle(fontSize: TextSize.md, color: c.inkSoft),
              ),
            ],
          ),
        ),
        if (!valid)
          Text(
            'Enter a whole number of minutes between 0 and 360.',
            style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w600, color: c.beet),
          ),
        if (_failed)
          const SheetNote(lead: "Couldn't save your screen time.", detail: 'Check your connection and try again.'),
        SheetAction(
          label: _busy ? 'Logging…' : 'Log screen time',
          onPressed: _busy || !valid ? null : () => _save(minutes),
        ),
      ],
    );
  }
}
