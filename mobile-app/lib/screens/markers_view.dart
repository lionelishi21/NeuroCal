import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../markers.dart';
import '../theme/tokens.dart';
import '../widgets/sheet.dart';
import '../widgets/ui.dart';

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
String _when(DateTime d) => '${d.day} ${_months[d.month - 1]}';
String _num(double v) => v == v.roundToDouble() ? '${v.round()}' : v.toStringAsFixed(1);

/// Health markers on Progress → Body: each with its latest reading, how it moved over about three months
/// (green the healthier way, amber the other), and a general adult reference. Never a diagnosis.
class MarkersSection extends StatelessWidget {
  const MarkersSection(this.markers, {super.key, required this.onAdd, this.onImport});

  /// Null when they didn't load.
  final List<MarkerSummary>? markers;
  final VoidCallback onAdd;

  /// Health Connect / Apple Health, when the phone has it and it isn't connected yet.
  final VoidCallback? onImport;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final list = markers ?? const <MarkerSummary>[];
    final actions = Wrap(
      spacing: Space.s2,
      runSpacing: Space.s2,
      children: [
        SoftButton(label: '+ Add a reading', semanticLabel: 'Add a health marker reading', onPressed: onAdd),
        if (onImport != null) TextButton(onPressed: onImport, child: const Text('Import heart data')),
      ],
    );
    if (list.isEmpty) {
      return EmptyCard(
        title: 'No markers yet',
        detail: 'Resting heart rate, VO2max, blood pressure, waist, grip strength and lab results, over months. They show how your healthspan habits are working.',
        action: actions,
      );
    }
    return AppCard(
      padding: const EdgeInsets.fromLTRB(Space.s4, Space.s2, Space.s4, Space.s3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, m) in list.indexed) ...[
            if (i > 0) Divider(height: 1, color: c.rule),
            _MarkerRow(m),
          ],
          const SizedBox(height: Space.s2),
          Align(alignment: Alignment.centerLeft, child: actions),
          Text(
            'References are general adult ranges, not a diagnosis. Your clinician sets your own targets.',
            style: TextStyle(fontSize: TextSize.xxs, height: 1.35, color: c.inkFaint),
          ),
        ],
      ),
    );
  }
}

class _MarkerRow extends StatelessWidget {
  const _MarkerRow(this.m);

  final MarkerSummary m;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final change = m.change;
    final (fill, ink) = switch (m.improving) {
      true => (c.chlorophyllSoft, c.chlorophyll),
      false => (c.glucoseSoft, c.glucoseInk),
      null => (c.mist, c.inkSoft),
    };
    final moved = change == null ? null : '${change > 0 ? '+' : change < 0 ? '−' : ''}${_num(change.abs())} ${m.unit} in 3 months';
    return Semantics(
      container: true,
      label: '${m.label}: ${_num(m.latest.value)} ${m.unit} on ${_when(m.latest.measuredAt)}${moved == null ? '' : ', $moved'}. ${m.reference}',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: Space.s3),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 4,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Expanded(child: Text(m.label, style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700))),
                Text('${_num(m.latest.value)} ', style: const TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w800)),
                Text(m.unit, style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft)),
              ],
            ),
            Row(
              spacing: Space.s2,
              children: [
                Text(_when(m.latest.measuredAt), style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft)),
                if (moved != null) Flexible(child: Tag(moved, fill: fill, ink: ink)),
              ],
            ),
            Text(m.reference, style: TextStyle(fontSize: TextSize.xs, height: 1.35, color: c.inkSoft)),
          ],
        ),
      ),
    );
  }
}

/// Type a reading in: which marker, its value, and (for lab results) when the test was.
Future<bool?> showAddMarkerSheet(BuildContext context) => showAppSheet<bool>(context, title: 'Add a reading', builder: (_) => const _AddMarker());

class _AddMarker extends StatefulWidget {
  const _AddMarker();

  @override
  State<_AddMarker> createState() => _AddMarkerState();
}

class _AddMarkerState extends State<_AddMarker> {
  var _marker = markerInfos.first;
  final _value = TextEditingController();
  var _daysAgo = 0;
  var _saving = false;
  String? _problem;

  @override
  void dispose() {
    _value.dispose();
    super.dispose();
  }

  double? get _parsed => double.tryParse(_value.text.trim().replaceAll(',', '.'));

  Future<void> _save() async {
    final value = _parsed;
    if (value == null || value < _marker.min || value > _marker.max) {
      setState(() => _problem = '${_marker.label} should be between ${_num(_marker.min)} and ${_num(_marker.max)} ${_marker.unit}.');
      return;
    }
    setState(() {
      _saving = true;
      _problem = null;
    });
    try {
      final now = DateTime.now();
      final at = _daysAgo == 0 ? null : DateTime(now.year, now.month, now.day - _daysAgo, 9);
      await AppScope.of(context).api.recordMarkers([(marker: _marker.id, value: value, measuredAt: at, source: 'manual')]);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _problem = e.message);
    } catch (_) {
      if (mounted) setState(() => _problem = 'Check your connection and try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        DropdownButtonFormField<String>(
          initialValue: _marker.id,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Marker'),
          items: [for (final m in markerInfos) DropdownMenuItem(value: m.id, child: Text(m.label, overflow: TextOverflow.ellipsis))],
          onChanged: (id) => setState(() {
            _marker = markerInfo(id!)!;
            _problem = null;
          }),
        ),
        TextField(
          controller: _value,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
          decoration: InputDecoration(labelText: 'Value', suffixText: _marker.unit, helperText: _marker.hint),
          onChanged: (_) => setState(() => _problem = null),
        ),
        Text('When', style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.inkSoft)),
        Wrap(
          spacing: Space.s2,
          runSpacing: Space.s2,
          children: [
            for (final (days, label) in const [(0, 'Today'), (1, 'Yesterday'), (7, 'Last week'), (30, 'Last month')])
              ChoicePill(label: label, height: 40, selected: _daysAgo == days, onTap: () => setState(() => _daysAgo = days)),
          ],
        ),
        if (_problem != null) SheetNote(lead: 'Check the value.', detail: _problem!),
        SheetAction(label: _saving ? 'Saving…' : 'Save', onPressed: _saving || _parsed == null ? null : _save),
      ],
    );
  }
}

/// Blood sugar from a glucose sensor on Progress → Body: the last week's average and time in range
/// (70–180 mg/dL with diabetes, else 70–140), and the latest day.
class GlucoseCard extends StatelessWidget {
  const GlucoseCard(this.days, {super.key, required this.diabetic});

  final List<GlucoseDay> days;
  final bool diabetic;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final week = days.length > 7 ? days.sublist(days.length - 7) : days;
    double avg(double Function(GlucoseDay) f) => week.fold(0.0, (s, d) => s + f(d)) / week.length;
    final inRange = avg((d) => diabetic ? d.inRange180Pct : d.inRange140Pct).round();
    final range = diabetic ? '70–180' : '70–140';
    final mean = avg((d) => d.meanMgdl).round();
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s2,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(
                child: Text('$inRange% in range', style: const TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800)),
              ),
              Text('avg $mean mg/dL', style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.inkSoft)),
            ],
          ),
          ClipRRect(
            borderRadius: BorderRadius.circular(Radii.pill),
            child: LinearProgressIndicator(value: inRange / 100, minHeight: 6, backgroundColor: c.track, color: inRange >= 70 ? c.chlorophyll : c.glucose),
          ),
          Text(
            'Time in $range mg/dL over the last ${week.length} ${week.length == 1 ? 'day' : 'days'} from your glucose sensor. It sets the blood-sugar part of your Focus Score.',
            style: TextStyle(fontSize: TextSize.xs, height: 1.35, color: c.inkSoft),
          ),
        ],
      ),
    );
  }
}
