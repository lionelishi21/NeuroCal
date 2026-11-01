import 'package:flutter/material.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/sheet.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';

/// Today's environment (docs/NCBM.md §3): the air where you live, four taps for the daily check
/// (morning daylight, a dark and a quiet bedroom, filtered water) and water drunk against the day's
/// target, with a sheet saying why each matters. Answers save as they're tapped.
class EnvironmentCard extends StatefulWidget {
  const EnvironmentCard(this.day, {super.key, required this.onChanged, this.framed = true});

  final EnvironmentDay day;

  /// False draws it as a row of Today's habits card, without its own card.
  final bool framed;

  /// Something was saved: the score and Today reload.
  final VoidCallback onChanged;

  @override
  State<EnvironmentCard> createState() => _EnvironmentCardState();
}

class _EnvironmentCardState extends State<EnvironmentCard> {
  late var _day = widget.day;

  @override
  void didUpdateWidget(EnvironmentCard old) {
    super.didUpdateWidget(old);
    if (old.day != widget.day) _day = widget.day;
  }

  /// A glass, the step for the water buttons.
  static const _glassMl = 250;

  /// The water total last sent, so an older reply can't undo a newer tap.
  int? _sentWaterMl;

  EnvironmentDay _with({Map<EnvironmentItem, bool>? check, int? waterMl, bool? electrolytes}) => EnvironmentDay(
    place: _day.place,
    aqi: _day.aqi,
    category: _day.category,
    check: check ?? _day.check,
    waterMl: waterMl ?? _day.waterMl,
    waterTargetMl: _day.waterTargetMl,
    electrolytes: electrolytes ?? _day.electrolytes,
    signal: _day.signal,
  );

  Future<void> _answer(EnvironmentItem item, bool kept) async {
    final before = _day;
    // Shown at once; put back if it doesn't save.
    setState(() => _day = _with(check: {..._day.check, item: kept}));
    try {
      final saved = await AppScope.of(context).api.saveEnvironmentCheck({item: kept});
      if (!mounted) return;
      setState(() => _day = saved);
      widget.onChanged();
    } catch (_) {
      if (!mounted) return;
      setState(() => _day = before);
      showToast(context, "Couldn't save that. Try again.", ToastTone.problem);
    }
  }

  /// Sets the day's total (or the electrolytes tick): shown at once, put back if it doesn't save.
  Future<void> _water({int? ml, bool? electrolytes}) async {
    final before = _day;
    setState(() => _day = _with(waterMl: ml, electrolytes: electrolytes));
    if (ml != null) _sentWaterMl = ml;
    try {
      final saved = await AppScope.of(context).api.saveWater(ml: ml, electrolytes: electrolytes);
      if (!mounted) return;
      // A newer tap is on its way: keep showing its total.
      if (ml == null || ml == _sentWaterMl) setState(() => _day = saved);
      widget.onChanged();
    } catch (_) {
      if (!mounted) return;
      setState(() => _day = before);
      showToast(context, "Couldn't save that. Try again.", ToastTone.problem);
    }
  }

  Future<void> _setPlace() async {
    final saved = await showPlaceSheet(context, current: _day.place);
    if (saved == null || !mounted) return;
    setState(() => _day = saved);
    showToast(context, saved.place == null ? 'Place removed' : 'Air quality on for ${saved.place}');
    widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final d = _day;
    final (fill, ink) = switch (d.category) {
      'good' => (c.chlorophyllSoft, c.chlorophyll),
      'moderate' => (c.glucoseSoft, c.glucoseInk),
      null => (c.mist, c.inkSoft),
      _ => (c.beetSoft, c.beet),
    };
    const padding = EdgeInsets.fromLTRB(Space.s4, 14, Space.s3, 14);
    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: Space.s3,
      children: [
        Row(
          spacing: Space.s3,
          children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: c.ionSoft, shape: BoxShape.circle),
              child: Icon(Icons.air_rounded, size: 22, color: c.ionInk),
            ),
            const Expanded(
              child: Text(
                'Environment',
                style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
              ),
            ),
            if (d.aqi != null)
              Semantics(
                label: 'Air quality ${d.aqi}, ${d.categoryLabel}',
                excludeSemantics: true,
                child: Tag('AQI ${d.aqi} · ${d.categoryLabel}', fill: fill, ink: ink),
              ),
            IconButton(
              tooltip: 'Why these?',
              onPressed: () =>
                  showAppSheet<void>(context, title: 'Why these matter', builder: (_) => const _WhySheet()),
              icon: Icon(Icons.help_outline_rounded, size: 20, color: c.inkSoft),
            ),
          ],
        ),
        Text(
          'Tick the ones you did. Each one counts toward your Focus Score.',
          style: TextStyle(fontSize: TextSize.xs, height: 1.35, color: c.inkSoft),
        ),
        if (d.place == null)
          Row(
            children: [
              Expanded(
                child: Text(
                  'Set your town to add the air you breathe.',
                  style: TextStyle(fontSize: TextSize.xs, height: 1.35, color: c.inkSoft),
                ),
              ),
              SoftButton(label: 'Set town', onPressed: _setPlace),
            ],
          )
        else
          InkWell(
            onTap: _setPlace,
            borderRadius: BorderRadius.circular(Radii.option),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: Space.s1),
              child: Text(
                'Air in ${d.place} · change',
                style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
              ),
            ),
          ),
        // Two ticks a row, like the supplements above them.
        LayoutBuilder(
          builder: (context, box) => Wrap(
            children: [
              for (final item in EnvironmentItem.values)
                SizedBox(
                  width: box.maxWidth / 2,
                  child: _Tick(
                    label: item.label,
                    done: d.check[item] == true,
                    onTap: () => _answer(item, d.check[item] != true),
                  ),
                ),
            ],
          ),
        ),
        _WaterRow(
          ml: d.waterMl,
          targetMl: d.waterTargetMl,
          onAdd: () => _water(ml: d.waterMl + _glassMl),
          onRemove: d.waterMl == 0 ? null : () => _water(ml: (d.waterMl - _glassMl).clamp(0, d.waterMl)),
        ),
        _Tick(
          label: 'Added salt or electrolytes',
          done: d.electrolytes,
          onTap: () => _water(electrolytes: !d.electrolytes),
        ),
      ],
    );
    return widget.framed ? AppCard(padding: padding, child: body) : Padding(padding: padding, child: body);
  }
}

/// One answer of the daily check: a round tick and its label, ticked when kept today.
class _Tick extends StatelessWidget {
  const _Tick({required this.label, required this.done, required this.onTap});

  final String label;
  final bool done;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      checked: done,
      label: label,
      excludeSemantics: true,
      onTap: onTap,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Radii.option),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            spacing: Space.s2,
            children: [
              AnimatedContainer(
                duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 150),
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: done ? c.chlorophyll : null,
                  border: Border.all(color: done ? c.chlorophyll : c.ruleStrong, width: 2),
                ),
                child: done ? Icon(Icons.check_rounded, size: 16, color: c.onAccent) : null,
              ),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w600, color: done ? c.inkSoft : c.ink),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Water drunk today against the target, with a glass more or less.
class _WaterRow extends StatelessWidget {
  const _WaterRow({required this.ml, required this.targetMl, required this.onAdd, required this.onRemove});

  final int ml;
  final int targetMl;
  final VoidCallback onAdd;

  /// Null when there's nothing to take off.
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final reached = ml >= targetMl;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: Space.s2,
      children: [
        Semantics(
          label: 'Water: ${thousands(ml)} of ${thousands(targetMl)} ml${reached ? ', target reached' : ''}',
          excludeSemantics: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: Space.s2,
            children: [
              Row(
                spacing: Space.s2,
                children: [
                  Icon(Icons.water_drop_rounded, size: 18, color: c.ionInk),
                  const Expanded(
                    child: Text(
                      'Water',
                      style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800),
                    ),
                  ),
                  Text(
                    reached ? 'Target reached · ${thousands(ml)} ml' : '${thousands(ml)} of ${thousands(targetMl)} ml',
                    style: TextStyle(
                      fontSize: TextSize.xs,
                      fontWeight: FontWeight.w700,
                      color: reached ? c.chlorophyll : c.inkSoft,
                    ),
                  ),
                ],
              ),
              Meter(value: ml / targetMl, color: reached ? c.chlorophyll : c.ionInk, height: 6),
            ],
          ),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          spacing: Space.s2,
          children: [
            SoftButton(label: '−', semanticLabel: 'Remove a glass', height: 36, onPressed: onRemove),
            SoftButton(label: '+ Glass', semanticLabel: 'Add a glass, 250 ml', height: 36, onPressed: onAdd),
          ],
        ),
      ],
    );
  }
}

/// What each tick is for: the habit, and why it moves focus.
class _WhySheet extends StatelessWidget {
  const _WhySheet();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: Space.s4,
      children: [
        Text(
          'Your surroundings and how much you drink shape how well you sleep and how alert you feel. These are the easiest to change.',
          style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
        ),
        for (final (label, why) in [
          for (final item in EnvironmentItem.values) (item.label, item.why),
          (
            'Water',
            'Being even slightly short of water dulls attention and memory and makes you tired. Your target comes from your weight, with more on days you exercise. Drinking past it earns nothing more.',
          ),
          (
            'Salt or electrolytes',
            'A pinch of salt or an electrolyte mix helps the water stay in you rather than pass straight through, especially while fasting or after a sweaty workout. It isn\'t scored.',
          ),
        ])
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: Space.s1,
            children: [
              Text(
                label,
                style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800),
              ),
              Text(
                why,
                style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
              ),
            ],
          ),
      ],
    );
  }
}

/// Set the town for air quality. Returns the day with it, or null when closed.
Future<EnvironmentDay?> showPlaceSheet(BuildContext context, {String? current}) => showAppSheet<EnvironmentDay>(
  context,
  title: 'Air quality where you live',
  builder: (_) => _PlaceSheet(current: current),
);

class _PlaceSheet extends StatefulWidget {
  const _PlaceSheet({this.current});

  final String? current;

  @override
  State<_PlaceSheet> createState() => _PlaceSheetState();
}

class _PlaceSheetState extends State<_PlaceSheet> {
  final _place = TextEditingController();
  var _busy = false;
  String? _problem;

  @override
  void dispose() {
    _place.dispose();
    super.dispose();
  }

  Future<void> _save(String? place) async {
    setState(() {
      _busy = true;
      _problem = null;
    });
    try {
      final day = await AppScope.of(context).api.setEnvironmentPlace(place);
      if (mounted) Navigator.of(context).pop(day);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _problem = e.status == 400 ? e.message : 'Places can’t be looked up right now. Try again soon.');
      }
    } catch (_) {
      if (mounted) setState(() => _problem = 'Check your connection and try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        Text(
          'Your town or postcode. We keep it rounded to about 10 km and use it only for the day’s air quality.',
          style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
        ),
        TextField(
          controller: _place,
          autofocus: true,
          textCapitalization: TextCapitalization.words,
          textInputAction: TextInputAction.done,
          decoration: InputDecoration(labelText: 'Town or postcode', hintText: widget.current ?? 'e.g. Austin'),
          onSubmitted: (v) => v.trim().isEmpty ? null : _save(v.trim()),
        ),
        if (_problem != null) SheetNote(lead: 'Not found.', detail: _problem!),
        SheetAction(
          label: _busy ? 'Looking it up…' : 'Save',
          onPressed: _busy ? null : () => _place.text.trim().isEmpty ? null : _save(_place.text.trim()),
        ),
        if (widget.current != null)
          TextButton(onPressed: _busy ? null : () => _save(null), child: const Text('Stop using my town')),
      ],
    );
  }
}
