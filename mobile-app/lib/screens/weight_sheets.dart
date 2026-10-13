import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../weight_units.dart';
import '../widgets/sheet.dart';

const _paces = [(0.5, 'Gentle'), (0.75, 'Steady'), (1.0, 'Faster')];
const _minKg = 25.0;
const _maxKg = 350.0;

/// Set or change the weight goal: current and target weight, pace and the safety question.
/// Saving also logs today's weight. Returns true when something changed.
Future<bool?> showWeightGoalSheet(BuildContext context, {required WeightUnit unit, WeightGoal? current, double? lastKg}) =>
    showAppSheet<bool>(
      context,
      title: current == null ? 'Set your weight goal' : 'Your weight goal',
      builder: (_) => _WeightGoal(unit: unit, current: current, lastKg: lastKg),
    );

/// Log today's weight. Returns true when saved.
Future<bool?> showLogWeightSheet(BuildContext context, {required WeightUnit unit, double? lastKg}) =>
    showAppSheet<bool>(context, title: 'Log your weight', builder: (_) => _LogWeight(unit: unit, lastKg: lastKg));

/// Up to three digits and one decimal. Checks the whole value: a pattern that can match nothing
/// makes FilteringTextInputFormatter loop forever.
final _decimal = [
  TextInputFormatter.withFunction(
    (old, next) => RegExp(r'^\d{0,3}([.,]\d?)?$').hasMatch(next.text) ? next : old,
  ),
];
double? _parse(String text) => double.tryParse(text.trim().replaceAll(',', '.'));

class _WeightGoal extends StatefulWidget {
  const _WeightGoal({required this.unit, this.current, this.lastKg});

  final WeightUnit unit;
  final WeightGoal? current;
  final double? lastKg;

  @override
  State<_WeightGoal> createState() => _WeightGoalState();
}

class _WeightGoalState extends State<_WeightGoal> {
  late WeightUnit _unit = widget.unit;
  late final _now = TextEditingController(text: _show(widget.lastKg ?? widget.current?.startKg));
  late final _target = TextEditingController(text: _show(widget.current?.targetKg));
  late double _pace = widget.current?.pacePctPerWeek ?? 0.75;
  late bool? _caution = widget.current?.fastingCaution;
  var _busy = false;
  String? _error;

  String _show(double? kg) => kg == null ? '' : _unit.fromKg(kg).toStringAsFixed(1);

  @override
  void dispose() {
    _now.dispose();
    _target.dispose();
    super.dispose();
  }

  void _switchUnit(WeightUnit unit) {
    if (unit == _unit) return;
    double? kg(TextEditingController c) => _parse(c.text) == null ? null : _unit.toKg(_parse(c.text)!);
    final now = kg(_now);
    final target = kg(_target);
    setState(() {
      _unit = unit;
      _now.text = _show(now);
      _target.text = _show(target);
    });
    unit.save();
  }

  Future<void> _save() async {
    final now = _parse(_now.text);
    final target = _parse(_target.text);
    final nowKg = now == null ? null : _unit.toKg(now);
    final targetKg = target == null ? null : _unit.toKg(target);
    String? error;
    if (nowKg == null || targetKg == null) {
      error = 'Enter your weight now and your target.';
    } else if ([nowKg, targetKg].any((kg) => kg < _minKg || kg > _maxKg)) {
      error = 'Those weights look off. Check the unit (kg or lb).';
    } else if (targetKg >= nowKg) {
      error = 'Your target needs to be below your weight now.';
    } else if (_caution == null) {
      error = 'Answer the health question so we know how to keep fasting safe.';
    }
    if (error != null) {
      setState(() => _error = error);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final api = AppScope.of(context).api;
    try {
      final goal = WeightGoal(
        startKg: widget.current?.startKg ?? double.parse(nowKg!.toStringAsFixed(2)),
        targetKg: double.parse(targetKg!.toStringAsFixed(2)),
        startedOn: widget.current?.startedOn ?? isoDate(DateTime.now()),
        pacePctPerWeek: _pace,
        fastingCaution: _caution!,
      );
      await api.saveProfile({'weightGoal': goal.toJson()});
      await api.logWeight(double.parse(nowKg!.toStringAsFixed(2)));
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = "Couldn't save your goal. Check your connection and try again.";
        });
      }
    }
  }

  Future<void> _remove() async {
    setState(() => _busy = true);
    try {
      await AppScope.of(context).api.saveProfile({'weightGoal': null});
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = "Couldn't remove your goal. Try again.";
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final now = _parse(_now.text);
    final weekly = now == null ? null : now * _pace / 100;
    Widget field(TextEditingController controller, String label) => Expanded(
      child: TextField(
        controller: controller,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        inputFormatters: _decimal,
        onChanged: (_) => setState(() {}),
        decoration: InputDecoration(labelText: label, suffixText: _unit.label),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        Row(
          spacing: Space.s2,
          children: [
            for (final unit in WeightUnit.values)
              ChoicePill(label: unit.label, selected: _unit == unit, onTap: () => _switchUnit(unit)),
          ],
        ),
        Row(spacing: Space.s3, children: [field(_now, 'Weight now'), field(_target, 'Target')]),
        Text('Pace', style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: c.inkSoft)),
        Wrap(
          spacing: Space.s2,
          runSpacing: Space.s2,
          children: [
            for (final (pace, name) in _paces)
              ChoicePill(label: '$name · $pace%', selected: _pace == pace, onTap: () => setState(() => _pace = pace)),
          ],
        ),
        if (weekly != null)
          Text(
            'About ${weekly.toStringAsFixed(1)} ${_unit.label} a week. Losing more than 1% a week usually costs muscle too.',
            style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
          ),
        Text(
          'Do any of these apply to you? You take medication for diabetes, you are pregnant or breastfeeding, '
          "you're under 18, or you've had an eating disorder.",
          style: const TextStyle(fontSize: TextSize.sm, height: 1.4, fontWeight: FontWeight.w600),
        ),
        Row(
          spacing: Space.s2,
          children: [
            ChoicePill(label: 'Yes', selected: _caution == true, onTap: () => setState(() => _caution = true)),
            ChoicePill(label: 'No', selected: _caution == false, onTap: () => setState(() => _caution = false)),
          ],
        ),
        if (_caution == true)
          const SheetNote(
            lead: 'We’ll keep fasting gentle.',
            detail: 'The app will cap fasting at 12 hours and never suggest longer fasts. Talk to your doctor before changing how you eat.',
            watch: true,
          ),
        if (_error != null) SheetNote(lead: 'Check this.', detail: _error!),
        SheetAction(label: _busy ? 'Saving…' : 'Save goal', onPressed: _busy ? null : _save),
        if (widget.current != null)
          TextButton(
            style: TextButton.styleFrom(foregroundColor: c.beet),
            onPressed: _busy ? null : _remove,
            child: const Text('Remove weight goal'),
          ),
      ],
    );
  }
}

class _LogWeight extends StatefulWidget {
  const _LogWeight({required this.unit, this.lastKg});

  final WeightUnit unit;
  final double? lastKg;

  @override
  State<_LogWeight> createState() => _LogWeightState();
}

class _LogWeightState extends State<_LogWeight> {
  late final _value = TextEditingController(text: widget.lastKg == null ? '' : widget.unit.fromKg(widget.lastKg!).toStringAsFixed(1));
  var _busy = false;
  String? _error;

  @override
  void dispose() {
    _value.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final value = _parse(_value.text);
    final kg = value == null ? null : widget.unit.toKg(value);
    if (kg == null || kg < _minKg || kg > _maxKg) {
      setState(() => _error = 'Enter your weight in ${widget.unit.label}.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.of(context).api.logWeight(double.parse(kg.toStringAsFixed(2)));
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = "Couldn't save it. Check your connection and try again.";
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        TextField(
          controller: _value,
          autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: _decimal,
          decoration: InputDecoration(labelText: 'Weight today', suffixText: widget.unit.label),
        ),
        Text(
          'Weigh yourself at the same time each day, ideally in the morning before eating. '
          'Daily numbers jump around with water; the trend is what counts.',
          style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
        ),
        if (_error != null) SheetNote(lead: 'Check this.', detail: _error!),
        SheetAction(label: _busy ? 'Saving…' : 'Save weight', onPressed: _busy ? null : _save),
      ],
    );
  }
}
