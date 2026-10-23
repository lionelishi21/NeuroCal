import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../health/sleep_sync.dart';
import '../lab_units.dart';
import '../theme/tokens.dart';
import '../weight_units.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';
import 'markers_view.dart';
import 'progress_photos_view.dart';
import 'capture.dart';
import 'level.dart';
import 'sleep.dart';
import 'weight_cards.dart';
import 'weight_sheets.dart';
import 'week.dart';

/// How things are going: the past week, sleep and evenings, and body (weight and Brain speed),
/// one at a time under a switch. Each keeps its place while another is open.
class ProgressScreen extends StatefulWidget {
  const ProgressScreen({super.key, required this.changes, required this.onChanged, required this.onCapture});

  /// Fires when something was logged on any tab.
  final Listenable changes;
  final VoidCallback onChanged;
  final void Function(Capture) onCapture;

  @override
  State<ProgressScreen> createState() => _ProgressScreenState();
}

class _ProgressScreenState extends State<ProgressScreen> {
  static const _views = ['This week', 'Sleep', 'Body', 'Level'];
  var _view = 0;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(Space.s4, Space.s3, Space.s4, 0),
            child: Container(
              padding: const EdgeInsets.all(Space.s1),
              decoration: BoxDecoration(color: c.paper, borderRadius: BorderRadius.circular(Radii.pill)),
              child: Row(
                children: [
                  for (final (i, label) in _views.indexed)
                    Expanded(
                      child: Semantics(
                        button: true,
                        selected: _view == i,
                        inMutuallyExclusiveGroup: true,
                        excludeSemantics: true,
                        label: label,
                        child: Material(
                          color: _view == i ? c.synapse : Colors.transparent,
                          shape: const StadiumBorder(),
                          child: InkWell(
                            customBorder: const StadiumBorder(),
                            onTap: () => setState(() => _view = i),
                            child: Container(
                              height: 40,
                              alignment: Alignment.center,
                              child: Text(
                                label,
                                style: TextStyle(
                                  fontSize: TextSize.sm,
                                  fontWeight: FontWeight.w700,
                                  color: _view == i ? c.onAccent : c.inkSoft,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Expanded(
            child: IndexedStack(
              index: _view,
              children: [
                WeekScreen(changes: widget.changes),
                SleepScreen(changes: widget.changes, onChanged: widget.onChanged),
                _Body(changes: widget.changes, onCapture: widget.onCapture, onChanged: widget.onChanged),
                LevelView(changes: widget.changes),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

typedef _BodyData = ({
  WeightHistory? weights,
  WeightUnit unit,
  LabUnits labUnits,
  BrainCheckHistory? brain,
  List<MarkerSummary>? markers,
  List<GlucoseDay> glucose,
  bool diabetic,
});

/// Weight trend and Brain speed over the past month.
class _Body extends StatefulWidget {
  const _Body({required this.changes, required this.onCapture, required this.onChanged});

  final Listenable changes;
  final void Function(Capture) onCapture;
  final VoidCallback onChanged;

  @override
  State<_Body> createState() => _BodyState();
}

class _BodyState extends State<_Body> {
  Future<_BodyData>? _data;

  @override
  void initState() {
    super.initState();
    widget.changes.addListener(_reload);
  }

  @override
  void dispose() {
    widget.changes.removeListener(_reload);
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _data ??= _load();
  }

  Future<_BodyData> _load() async {
    final api = AppScope.of(context).api;
    final unit = WeightUnit.load(Localizations.localeOf(context));
    final labUnits = LabUnits.load(Localizations.localeOf(context));
    final weights = api.weights(days: 60).then<WeightHistory?>((w) => w).catchError((Object _) => null);
    final brain = api.brainChecks(days: 30).then<BrainCheckHistory?>((b) => b).catchError((Object _) => null);
    final markers = api.markers().then<List<MarkerSummary>?>((m) => m).catchError((Object _) => null);
    final glucose = api.glucose().catchError((Object _) => <GlucoseDay>[]);
    final profile = api.me().then<Profile?>((p) => p).catchError((Object _) => null);
    final conditions = (await profile)?.healthConditions ?? const <String>[];
    return (
      weights: await weights,
      unit: await unit,
      labUnits: await labUnits,
      brain: await brain,
      markers: await markers,
      glucose: await glucose,
      diabetic: conditions.contains('type1_diabetes') || conditions.contains('type2_diabetes'),
    );
  }

  void _reload() => setState(() {
    _data = _load();
  });

  /// The weigh-in nearest [day], within three days, in the person's unit.
  String? _weightOn(_BodyData data, DateTime day) {
    final entries = data.weights?.entries ?? const <WeighIn>[];
    WeighIn? best;
    var bestGap = 4;
    for (final e in entries) {
      final gap = DateTime.parse(e.date).difference(DateTime(day.year, day.month, day.day)).inDays.abs();
      if (gap < bestGap) {
        best = e;
        bestGap = gap;
      }
    }
    return best == null ? null : data.unit.format(best.kg);
  }

  Future<void> _addMarker() async {
    final units = (await _data)!.labUnits;
    if (!mounted) return;
    if (await showAddMarkerSheet(context, units: units) == true && mounted) {
      showToast(context, 'Reading saved');
      widget.onChanged();
    }
  }

  /// Health Connect or Apple Health is on the phone but not connected yet.
  bool get _canImport => AppScope.of(context).sleepSync?.access == SleepAccess.notConnected;

  /// Connects the health store (sleep and heart data) and imports what's there.
  Future<void> _importHealth() async {
    final scope = AppScope.of(context);
    final sync = scope.sleepSync;
    if (sync == null) return;
    final imported = await sync.connect(scope.api);
    if (!mounted) return;
    if (imported == null) {
      showToast(context, "${sync.source.name} didn't give access", ToastTone.info);
    } else {
      scope.analytics.track('sleep_connected', {'moment': 'markers'});
      showToast(context, 'Connected to ${sync.source.name}');
      widget.onChanged();
    }
  }

  Future<void> _goal(_BodyData data) async {
    final profile = await AppScope.of(context).api.me().catchError((Object _) => null);
    if (!mounted) return;
    final saved = await showWeightGoalSheet(
      context,
      unit: data.unit,
      current: profile?.weightGoal,
      lastKg: data.weights?.entries.lastOrNull?.kg,
    );
    if (saved == true && mounted) {
      showToast(context, 'Weight goal saved');
      _reload();
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder(
    future: _data,
    builder: (context, snapshot) => ListView(
      padding: const EdgeInsets.fromLTRB(Space.s4, Space.s4, Space.s4, Space.s6),
      children: [
        const ScreenTitle('Body', detail: 'Weight, Brain speed and health markers'),
        const SizedBox(height: 14),
        if (!snapshot.hasData)
          const ScreenLoading(label: 'Loading', heights: [180, 180])
        else ...[
          if (snapshot.data!.weights case final weights?)
            WeightCard(
              weights,
              unit: snapshot.data!.unit,
              onLog: () => widget.onCapture(Capture.weight),
              onGoal: () => _goal(snapshot.data!),
            )
          else
            ScreenFailed(
              title: "Couldn't load your weight",
              detail: 'Check your connection and try again.',
              onRetry: _reload,
            ),
          if (AppScope.of(context).photos case final photos?) ...[
            const BlockTitle('Progress photos', note: 'Only on this phone'),
            ProgressPhotosSection(store: photos, weightOn: (day) => _weightOn(snapshot.data!, day)),
          ],
          const BlockTitle('Brain speed'),
          _BrainHistory(snapshot.data!.brain, onCheck: () => widget.onCapture(Capture.brain)),
          if (snapshot.data!.glucose.isNotEmpty) ...[
            const BlockTitle('Blood sugar'),
            GlucoseCard(snapshot.data!.glucose, diabetic: snapshot.data!.diabetic, units: snapshot.data!.labUnits),
          ],
          const BlockTitle('Health markers'),
          MarkersSection(
            snapshot.data!.markers,
            units: snapshot.data!.labUnits,
            onUnits: (u) async {
              await u.save();
              _reload();
            },
            onAdd: _addMarker,
            onImport: _canImport ? _importHealth : null,
          ),
        ],
      ],
    ),
  );
}

/// The last checks as columns against your usual, newest on the right.
class _BrainHistory extends StatelessWidget {
  const _BrainHistory(this.history, {required this.onCheck});

  final BrainCheckHistory? history;
  final VoidCallback onCheck;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final checks = (history?.checks ?? const <BrainCheck>[]).take(14).toList().reversed.toList();
    final usual = history?.baselineScore;
    if (checks.isEmpty) {
      return EmptyCard(
        title: 'No checks yet',
        detail: 'A 2-minute reaction check. Do it daily and see how sleep, food and fasting move it.',
        action: SoftButton(label: 'Start a check', onPressed: onCheck),
      );
    }
    return AppCard(
      padding: const EdgeInsets.all(Space.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s3,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(
                child: Text(
                  '${checks.last.score}',
                  style: const TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800, letterSpacing: -0.4),
                ),
              ),
              Text(
                usual == null ? 'Your usual after 3 checks' : 'Your usual: $usual',
                style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
              ),
            ],
          ),
          Semantics(
            label: 'Last ${checks.length} checks: ${checks.map((k) => k.score).join(', ')}',
            child: ExcludeSemantics(
              child: SizedBox(
                height: 96,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  spacing: Space.s1,
                  children: [
                    for (final k in checks)
                      Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          spacing: 2,
                          children: [
                            Flexible(
                              child: FractionallySizedBox(
                                heightFactor: (k.score / 100).clamp(0.06, 1.0),
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: usual != null && k.score < usual ? c.glucose : c.synapse,
                                    borderRadius: BorderRadius.circular(Radii.pill),
                                  ),
                                ),
                              ),
                            ),
                            Text(
                              weekdayShort[k.takenAt.toLocal().weekday - 1][0],
                              style: TextStyle(fontSize: TextSize.xxxs, color: c.inkFaint),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          Text(
            'Typical reaction ${checks.last.medianMs} ms. Columns under your usual are amber.',
            style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
          ),
          SoftButton(label: 'Start a check', onPressed: onCheck),
        ],
      ),
    );
  }
}
