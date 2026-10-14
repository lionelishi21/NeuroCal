import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/food_image.dart';
import '../widgets/ui.dart';
import 'weight_cards.dart';

/// The rest of the Stack tab after the supplements: the fasting timer, when fasting is on, and the
/// way into the food catalog.
class PlanExtras extends StatefulWidget {
  const PlanExtras({super.key, required this.changes, required this.onBrowseFoods, required this.onOpenPantry});

  final Listenable changes;
  final VoidCallback onBrowseFoods;
  final VoidCallback onOpenPantry;

  @override
  State<PlanExtras> createState() => _PlanExtrasState();
}

class _PlanExtrasState extends State<PlanExtras> {
  Future<FastingStatus?>? _fasting;

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
    _fasting ??= _load();
  }

  Future<FastingStatus?> _load() =>
      AppScope.of(context).api.fasting().then<FastingStatus?>((f) => f.kind == FastingKind.off ? null : f).catchError((Object _) => null);

  void _reload() => setState(() {
    _fasting = _load();
  });

  @override
  Widget build(BuildContext context) => FutureBuilder(
    future: _fasting,
    builder: (context, snapshot) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (snapshot.data case final fasting?) ...[
          const BlockTitle('Fasting'),
          FastingCard(fasting, onBoundary: _reload),
        ],
        const BlockTitle('Foods'),
        _PantryCard(onTap: widget.onOpenPantry),
        const SizedBox(height: Space.s3),
        BrowseFoodsCard(onTap: widget.onBrowseFoods),
      ],
    ),
  );
}

/// A way into the food catalog: a strip of foods for focus and a link.
class BrowseFoodsCard extends StatelessWidget {
  const BrowseFoodsCard({super.key, required this.onTap});

  final VoidCallback onTap;

  static const _preview = [('salmon', 'fish'), ('blueberries', 'fruit'), ('walnuts', 'nuts_seeds'), ('eggs', 'eggs_dairy')];

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      button: true,
      label: 'Browse foods for focus, energy and sleep',
      excludeSemantics: true,
      child: Material(
        color: c.paper,
        borderRadius: BorderRadius.circular(Radii.card),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(Space.s4, 14, Space.s3, 14),
            child: Row(
              spacing: Space.s3,
              children: [
                SizedBox(
                  width: 104,
                  height: 40,
                  child: Stack(
                    children: [
                      for (final (i, (id, category)) in _preview.indexed)
                        Positioned(
                          left: i * 21.0,
                          child: Container(
                            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: c.paper, width: 2)),
                            child: ClipOval(child: FoodImage(id: id, category: category, size: 36, radius: 18)),
                          ),
                        ),
                    ],
                  ),
                ),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Browse foods', style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700)),
                      Text('For focus, energy, sleep and calm', style: TextStyle(fontSize: TextSize.xs)),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right_rounded, color: c.inkSoft),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The way into the pantry and its recipe ideas.
class _PantryCard extends StatelessWidget {
  const _PantryCard({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      button: true,
      label: 'Your pantry: what can I make?',
      excludeSemantics: true,
      child: Material(
        color: c.paper,
        borderRadius: BorderRadius.circular(Radii.card),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(Space.s4, 14, Space.s3, 14),
            child: Row(
              spacing: Space.s3,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: c.glucoseSoft, shape: BoxShape.circle),
                  child: Icon(Icons.kitchen_rounded, size: 22, color: c.glucoseInk),
                ),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Your pantry', style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700)),
                      Text('What can I make from it?', style: TextStyle(fontSize: TextSize.xs)),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right_rounded, color: c.inkSoft),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

