import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../coffee_fats.dart';
import '../theme/tokens.dart';
import '../widgets/sheet.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';

/// Log a cup of coffee: what it is and what's stirred in, in a tap or two, with today's cups below.
/// Not a meal: black and fat-only coffee keep a fast. [onChanged] runs after each cup logged or removed.
Future<void> showCoffeeSheet(BuildContext context, {required VoidCallback onChanged}) => showAppSheet<void>(
  context,
  title: 'Log coffee',
  builder: (_) => _LogCoffee(onChanged: onChanged),
);

/// One-tap cups: black, Bulletproof (C8 and grass-fed butter), and the ghee version.
const _presets = <(String, CoffeeKind, List<CoffeeAddIn>)>[
  ('Black', CoffeeKind.brewed, []),
  ('Bulletproof', CoffeeKind.brewed, [CoffeeAddIn.mctC8, CoffeeAddIn.butterGrassFed]),
  ('Bulletproof with ghee', CoffeeKind.brewed, [CoffeeAddIn.mctC8, CoffeeAddIn.gheeGrassFed]),
];

const _fats = [
  CoffeeAddIn.mctC8,
  CoffeeAddIn.mctC8C10,
  CoffeeAddIn.butterGrassFed,
  CoffeeAddIn.butter,
  CoffeeAddIn.gheeGrassFed,
  CoffeeAddIn.ghee,
];
const _extras = [CoffeeAddIn.creatine, CoffeeAddIn.collagen, CoffeeAddIn.milk, CoffeeAddIn.sugar];

String _clock(DateTime t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

class _LogCoffee extends StatefulWidget {
  const _LogCoffee({required this.onChanged});

  final VoidCallback onChanged;

  @override
  State<_LogCoffee> createState() => _LogCoffeeState();
}

class _LogCoffeeState extends State<_LogCoffee> {
  var _kind = CoffeeKind.brewed;
  final _addIns = <CoffeeAddIn>{};
  CoffeeDay? _day;
  var _busy = false;
  String? _problem;

  /// The MCT oil and butter or ghee scanned for this person's coffee, once loaded.
  ({CoffeeFat? mct, CoffeeFat? fat})? _mine;

  @override
  void initState() {
    super.initState();
    coffeeFats().then((f) {
      if (mounted) setState(() => _mine = f);
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_day == null) {
      AppScope.of(context).api
          .coffee()
          .then((d) {
            if (mounted) setState(() => _day = d);
          })
          .catchError((Object _) {});
    }
  }

  Future<void> _log() async {
    setState(() {
      _busy = true;
      _problem = null;
    });
    try {
      final day = await AppScope.of(context).api.logCoffee(_kind, _addIns.toList());
      if (!mounted) return;
      showToast(context, 'Cup logged');
      setState(() {
        _day = day;
        _addIns.clear();
        _kind = CoffeeKind.brewed;
      });
      widget.onChanged();
    } catch (_) {
      if (mounted) setState(() => _problem = "Couldn't log the cup. Check your connection and try again.");
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _remove(CoffeeCup cup) async {
    try {
      await AppScope.of(context).api.deleteCoffee(cup.id);
      if (!mounted) return;
      setState(() {
        _day = CoffeeDay(
          date: _day!.date,
          cups: [
            for (final c in _day!.cups)
              if (c.id != cup.id) c,
          ],
          caffeineMg: _day!.caffeineMg - cup.caffeineMg,
          kcal: _day!.kcal - cup.kcal,
          curfew: _day!.curfew,
        );
      });
      widget.onChanged();
    } catch (_) {
      if (mounted) showToast(context, "Couldn't remove the cup. Try again.", ToastTone.problem);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final kcal = _addIns.fold(_kind == CoffeeKind.espresso ? 1 : 2, (s, a) => s + a.kcal);
    final breaks = _addIns.where((a) => a.breaksFast).map((a) => a.label.toLowerCase()).toList();
    final day = _day;
    Widget chip(CoffeeAddIn a) => FilterChip(
      label: Text(a.label),
      selected: _addIns.contains(a),
      onSelected: (on) => setState(() => on ? _addIns.add(a) : _addIns.remove(a)),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        Wrap(
          spacing: Space.s2,
          runSpacing: Space.s2,
          children: [
            for (final (label, kind, addIns) in [
              // Their own cup, with what they scanned, first.
              if (_mine case (mct: final mct, fat: final fat) when mct != null || fat != null)
                (
                  'My Bulletproof',
                  CoffeeKind.brewed,
                  [mct?.addIn ?? CoffeeAddIn.mctC8, fat?.addIn ?? CoffeeAddIn.butterGrassFed],
                ),
              ..._presets,
            ])
              ActionChip(
                avatar: const Icon(Icons.coffee_rounded, size: 18),
                label: Text(label),
                onPressed: () => setState(() {
                  _kind = kind;
                  _addIns
                    ..clear()
                    ..addAll(addIns);
                }),
              ),
          ],
        ),
        if (_mine case (mct: final mct, fat: final fat) when mct != null || fat != null)
          Text(
            'My Bulletproof uses ${[if (mct != null) mct.name, if (fat != null) fat.name].join(' and ')}.',
            style: TextStyle(fontSize: TextSize.xs, height: 1.35, color: context.colors.inkSoft),
          ),
        const GroupLabel('The coffee', top: 0),
        Wrap(
          spacing: Space.s2,
          runSpacing: Space.s2,
          children: [
            for (final k in CoffeeKind.values)
              ChoiceChip(label: Text(k.label), selected: _kind == k, onSelected: (_) => setState(() => _kind = k)),
          ],
        ),
        const GroupLabel('Fats', top: 0),
        Wrap(spacing: Space.s2, runSpacing: Space.s2, children: [for (final a in _fats) chip(a)]),
        const GroupLabel('Extras', top: 0),
        Wrap(spacing: Space.s2, runSpacing: Space.s2, children: [for (final a in _extras) chip(a)]),
        Text(
          breaks.isEmpty
              ? '$kcal kcal, ${_kind.caffeineMg} mg caffeine. Keeps your fast going.'
              : '$kcal kcal, ${_kind.caffeineMg} mg caffeine. The ${breaks.join(' and ')} ends a fast.',
          style: TextStyle(
            fontSize: TextSize.sm,
            fontWeight: FontWeight.w700,
            color: breaks.isEmpty ? c.chlorophyll : c.glucoseInk,
          ),
        ),
        if (_problem != null) SheetNote(lead: "Couldn't log it.", detail: _problem!),
        SheetAction(label: _busy ? 'Logging…' : 'Log cup', onPressed: _busy ? null : _log),
        if (day != null && day.cups.isNotEmpty) ...[
          GroupLabel('Today · ${day.caffeineMg} mg caffeine · curfew ${day.curfew}', top: Space.s2),
          for (final cup in day.cups)
            Row(
              spacing: Space.s2,
              children: [
                SizedBox(
                  width: 44,
                  child: Text(
                    _clock(cup.takenAt),
                    style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w600, color: c.inkSoft),
                  ),
                ),
                Expanded(
                  child: Text(
                    cup.afterCurfew ? '${cup.name} · after curfew' : cup.name,
                    style: TextStyle(fontSize: TextSize.sm, color: cup.afterCurfew ? c.glucoseInk : c.ink),
                  ),
                ),
                IconButton(
                  tooltip: 'Remove ${cup.name}',
                  onPressed: () => _remove(cup),
                  icon: Icon(Icons.close_rounded, size: 18, color: c.inkSoft),
                ),
              ],
            ),
        ],
      ],
    );
  }
}
