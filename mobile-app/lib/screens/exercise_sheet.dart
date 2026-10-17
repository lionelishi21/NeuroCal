import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/sheet.dart';
import 'calf_routine.dart';

/// Log exercise that just ended: what, how long and how hard. Returns it with its calories, or null.
Future<Exercise?> showExerciseSheet(BuildContext context) =>
    showAppSheet<Exercise>(context, title: 'Log exercise', builder: (_) => const _LogExercise());

IconData exerciseIcon(ExerciseKind kind) => switch (kind) {
  ExerciseKind.walk => Icons.directions_walk_rounded,
  ExerciseKind.run => Icons.directions_run_rounded,
  ExerciseKind.cycle => Icons.directions_bike_rounded,
  ExerciseKind.strength => Icons.fitness_center_rounded,
  ExerciseKind.hiit => Icons.local_fire_department_rounded,
  ExerciseKind.yoga => Icons.self_improvement_rounded,
  ExerciseKind.swim => Icons.pool_rounded,
  ExerciseKind.sport => Icons.sports_tennis_rounded,
  ExerciseKind.calf => Icons.airline_seat_legroom_normal_rounded,
  ExerciseKind.other => Icons.bolt_rounded,
};

class _LogExercise extends StatefulWidget {
  const _LogExercise();

  @override
  State<_LogExercise> createState() => _LogExerciseState();
}

class _LogExerciseState extends State<_LogExercise> {
  static const _presets = [10, 20, 30, 45, 60, 90];

  ExerciseKind? _kind;
  var _minutes = 30;
  var _intensity = ExerciseIntensity.moderate;
  var _busy = false;
  var _failed = false;

  Future<void> _calfPump() async {
    final logged = await showCalfRoutine(context);
    if (logged != null && mounted) Navigator.of(context).pop(logged);
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _failed = false;
    });
    try {
      final logged = await AppScope.of(context).api.logExercise(_kind!, _intensity, _minutes);
      if (mounted) Navigator.of(context).pop(logged);
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
    final label = TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.inkSoft);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        Material(
          color: c.chlorophyllSoft,
          borderRadius: BorderRadius.circular(Radii.option),
          child: InkWell(
            borderRadius: BorderRadius.circular(Radii.option),
            onTap: _calfPump,
            child: Padding(
              padding: const EdgeInsets.all(Space.s3),
              child: Row(
                spacing: Space.s3,
                children: [
                  Icon(exerciseIcon(ExerciseKind.calf), color: c.chlorophyll),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Do a calf pump', style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800, color: c.chlorophyll)),
                        Text('5 minutes, guided, mostly at your desk', style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft)),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right_rounded, color: c.chlorophyll),
                ],
              ),
            ),
          ),
        ),
        Text('What did you do?', style: label),
        Wrap(
          spacing: Space.s2,
          runSpacing: Space.s2,
          children: [
            for (final kind in ExerciseKind.values)
              ChoicePill(label: kind.label, selected: _kind == kind, onTap: () => setState(() => _kind = kind)),
          ],
        ),
        Row(
          children: [
            Expanded(child: Text('How long?', style: label)),
            Semantics(
              liveRegion: true,
              child: Text('$_minutes min', style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800)),
            ),
          ],
        ),
        Wrap(
          spacing: Space.s2,
          runSpacing: Space.s2,
          children: [
            for (final m in _presets) ChoicePill(label: '$m min', selected: _minutes == m, onTap: () => setState(() => _minutes = m)),
          ],
        ),
        Slider(
          value: _minutes.toDouble(),
          min: 5,
          max: 180,
          divisions: 35,
          label: '$_minutes min',
          onChanged: (v) => setState(() => _minutes = v.round()),
        ),
        Text('How hard?', style: label),
        Row(
          spacing: Space.s2,
          children: [
            for (final i in ExerciseIntensity.values)
              Expanded(
                child: ChoicePill(label: i.label, selected: _intensity == i, onTap: () => setState(() => _intensity = i)),
              ),
          ],
        ),
        Text(
          switch (_intensity) {
            ExerciseIntensity.light => 'Light: you could chat the whole way.',
            ExerciseIntensity.moderate => 'Moderate: you could talk, but not sing.',
            ExerciseIntensity.hard => 'Hard: only a few words at a time.',
          },
          style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
        ),
        if (_failed) const SheetNote(lead: "Couldn't log your exercise.", detail: 'Check your connection and try again.'),
        SheetAction(label: _busy ? 'Logging…' : 'Log exercise', onPressed: _busy || _kind == null ? null : _save),
      ],
    );
  }
}
