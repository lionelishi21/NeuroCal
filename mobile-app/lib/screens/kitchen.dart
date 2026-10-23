import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/food_image.dart';
import '../widgets/ui.dart';
import 'weight_cards.dart';
import '../widgets/toast.dart';
import 'plan_fast_sheet.dart';

/// The Kitchen tab: everything about food that isn't logging it. The fasting timer when fasting is on,
/// then planning and cooking, shopping, and the food catalog.
class KitchenScreen extends StatefulWidget {
  const KitchenScreen({
    super.key,
    required this.changes,
    required this.onOpenMealPlan,
    required this.onOpenPantry,
    required this.onOpenRecipe,
    required this.onOpenShopping,
    required this.onScanPackage,
    required this.onBrowseFoods,
    required this.onOpenCoffee,
  });

  final Listenable changes;
  final VoidCallback onOpenMealPlan;
  final VoidCallback onOpenPantry;
  final VoidCallback onOpenRecipe;
  final VoidCallback onOpenShopping;
  final VoidCallback onScanPackage;
  final VoidCallback onBrowseFoods;
  final VoidCallback onOpenCoffee;

  @override
  State<KitchenScreen> createState() => _KitchenScreenState();
}

class _KitchenScreenState extends State<KitchenScreen> {
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
      AppScope.of(context).api
          .fasting()
          .then<FastingStatus?>((f) => f.kind == FastingKind.off ? null : f)
          .catchError((Object _) => null);

  void _reload() {
    setState(() {
      _fasting = _load();
    });
  }

  Future<void> _plan(FastingStatus status) async {
    final planned = await showPlanFastSheet(context, status);
    if (planned == null || !mounted) return;
    showToast(context, 'Fasting until ${fastEnd(planned.planUntil!, DateTime.now())}');
    _reload();
  }

  Future<void> _end() async {
    try {
      await AppScope.of(context).api.endFast();
      if (mounted) showToast(context, 'Fast ended', ToastTone.info);
    } catch (_) {
      if (mounted) showToast(context, "Couldn't end the fast. Try again.", ToastTone.problem);
    }
    if (mounted) _reload();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: FutureBuilder(
        future: _fasting,
        builder: (context, snapshot) => ListView(
          padding: const EdgeInsets.fromLTRB(Space.s4, Space.s4, Space.s4, Space.s6),
          children: [
            const ScreenTitle('Kitchen', detail: 'Plan, cook and shop for steady energy'),
            if (snapshot.data case final fasting?) ...[
              const BlockTitle('Fasting'),
              FastingCard(fasting, onBoundary: _reload, onPlan: () => _plan(fasting), onEnd: _end),
            ],
            const BlockTitle('Plan and cook'),
            _LinkCard(
              icon: Icons.calendar_month_rounded,
              title: 'Meal plan',
              detail: 'Up to 3 days, with a shopping list',
              tone: _Tone.violet,
              onTap: widget.onOpenMealPlan,
            ),
            const SizedBox(height: Space.s3),
            _LinkCard(
              icon: Icons.kitchen_rounded,
              title: 'Your pantry',
              detail: 'What can I make from it?',
              tone: _Tone.amber,
              onTap: widget.onOpenPantry,
            ),
            const SizedBox(height: Space.s3),
            _LinkCard(
              icon: Icons.coffee_rounded,
              title: 'Your coffee',
              detail: 'Mould check, Bulletproof coffee and your caffeine curfew',
              tone: _Tone.amber,
              onTap: widget.onOpenCoffee,
            ),
            const SizedBox(height: Space.s3),
            _LinkCard(
              icon: Icons.calculate_outlined,
              title: 'Work out a recipe',
              detail: 'Calories and macros per serving',
              tone: _Tone.blue,
              onTap: widget.onOpenRecipe,
            ),
            const BlockTitle('Shop'),
            _LinkCard(
              icon: Icons.shopping_basket_outlined,
              title: 'Review my shopping list',
              detail: 'Cleaner swaps, and gadgets that help',
              tone: _Tone.green,
              onTap: widget.onOpenShopping,
            ),
            const SizedBox(height: Space.s3),
            _LinkCard(
              icon: Icons.qr_code_scanner_rounded,
              title: 'Scan a food package',
              detail: 'Is it ultra-processed? Who made it, and when?',
              tone: _Tone.amber,
              onTap: widget.onScanPackage,
            ),
            const BlockTitle('Learn'),
            BrowseFoodsCard(onTap: widget.onBrowseFoods),
          ],
        ),
      ),
    );
  }
}

/// A way into the food catalog: a strip of foods for focus and a link.
class BrowseFoodsCard extends StatelessWidget {
  const BrowseFoodsCard({super.key, required this.onTap});

  final VoidCallback onTap;

  static const _preview = [
    ('salmon', 'fish'),
    ('blueberries', 'fruit'),
    ('walnuts', 'nuts_seeds'),
    ('eggs', 'eggs_dairy'),
  ];

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
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: c.paper, width: 2),
                            ),
                            child: ClipOval(
                              child: FoodImage(id: id, category: category, size: 36, radius: 18),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Browse foods',
                        style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
                      ),
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

enum _Tone { amber, green, violet, blue }

/// A way into a tool from the Kitchen tab: an icon in its colour, a title and what it does.
class _LinkCard extends StatelessWidget {
  const _LinkCard({
    required this.icon,
    required this.title,
    required this.detail,
    required this.tone,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String detail;
  final _Tone tone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final (fill, ink) = switch (tone) {
      _Tone.amber => (c.glucoseSoft, c.glucoseInk),
      _Tone.green => (c.chlorophyllSoft, c.chlorophyll),
      _Tone.violet => (c.synapseSoft, c.synapseInk),
      _Tone.blue => (c.ionSoft, c.ionInk),
    };
    return Semantics(
      button: true,
      label: '$title: $detail',
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
                  decoration: BoxDecoration(color: fill, shape: BoxShape.circle),
                  child: Icon(icon, size: 22, color: ink),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
                      ),
                      Text(detail, style: const TextStyle(fontSize: TextSize.xs)),
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
