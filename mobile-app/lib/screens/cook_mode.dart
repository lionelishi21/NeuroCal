import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/meal_visual.dart';
import '../widgets/sheet.dart';

/// Cook a dish step by step, full screen and in large type: gather the ingredients first (tick them
/// off), then one step at a time. Steps slide in as you move; the screen stays awake while cooking.
Future<void> showCookMode(BuildContext context, {required String title, required List<String> ingredients, required List<String> steps}) =>
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => CookMode(title: title, ingredients: ingredients, steps: steps),
      ),
    );

class CookMode extends StatefulWidget {
  const CookMode({super.key, required this.title, required this.ingredients, required this.steps});

  final String title;
  final List<String> ingredients;
  final List<String> steps;

  @override
  State<CookMode> createState() => _CookModeState();
}

class _CookModeState extends State<CookMode> {
  /// 0 is the ingredients; 1… are the steps.
  var _page = 0;
  var _forward = true;
  final _have = <int>{};

  int get _pages => widget.steps.length + 1;

  void _go(int page) {
    if (page < 0 || page >= _pages) return;
    HapticFeedback.selectionClick();
    setState(() {
      _forward = page > _page;
      _page = page;
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final still = MediaQuery.disableAnimationsOf(context);
    final last = _page == _pages - 1;
    return Scaffold(
      backgroundColor: c.mist,
      appBar: AppBar(
        backgroundColor: c.mist,
        surfaceTintColor: Colors.transparent,
        title: Text(widget.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            tooltip: 'Watch how',
            icon: const Icon(Icons.play_circle_outline_rounded),
            onPressed: () => AppScope.of(context).openLink(videoSearchFor(widget.title)),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Space.s4, 0, Space.s4, Space.s4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: Space.s3,
            children: [
              Semantics(
                label: _page == 0 ? 'Ingredients' : 'Step $_page of ${widget.steps.length}',
                child: TweenAnimationBuilder<double>(
                  tween: Tween(end: (_page + 1) / _pages),
                  duration: still ? Duration.zero : Motion.select,
                  curve: Motion.settle,
                  builder: (context, v, _) => ClipRRect(
                    borderRadius: BorderRadius.circular(Radii.pill),
                    child: LinearProgressIndicator(value: v, minHeight: 6, backgroundColor: c.track, color: c.synapse),
                  ),
                ),
              ),
              Text(
                _page == 0 ? 'Gather what you need' : 'Step $_page of ${widget.steps.length}',
                style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.synapseInk),
              ),
              Expanded(
                child: AnimatedSwitcher(
                  duration: still ? Duration.zero : Motion.select,
                  transitionBuilder: (child, animation) => SlideTransition(
                    position: Tween(begin: Offset(_forward ? 0.25 : -0.25, 0), end: Offset.zero).animate(CurvedAnimation(parent: animation, curve: Motion.settle)),
                    child: FadeTransition(opacity: animation, child: child),
                  ),
                  child: KeyedSubtree(key: ValueKey(_page), child: _page == 0 ? _ingredients(context) : _step(context, widget.steps[_page - 1])),
                ),
              ),
              Row(
                spacing: Space.s2,
                children: [
                  if (_page > 0)
                    Expanded(
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(56), side: BorderSide(color: c.ruleStrong, width: 1.5)),
                        onPressed: () => _go(_page - 1),
                        child: const Text('Back'),
                      ),
                    ),
                  Expanded(
                    flex: 2,
                    child: SheetAction(
                      label: _page == 0 ? 'Start cooking' : last ? 'Done' : 'Next step',
                      onPressed: last ? () => Navigator.of(context).pop() : () => _go(_page + 1),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _ingredients(BuildContext context) {
    final c = context.colors;
    return ListView(
      children: [
        MealVisual(ingredients: widget.ingredients, height: 140),
        const SizedBox(height: Space.s3),
        for (final (i, item) in widget.ingredients.indexed)
          CheckboxListTile(
            value: _have.contains(i),
            onChanged: (v) => setState(() => v == true ? _have.add(i) : _have.remove(i)),
            controlAffinity: ListTileControlAffinity.leading,
            contentPadding: EdgeInsets.zero,
            title: Text(
              item,
              style: TextStyle(
                fontSize: TextSize.md,
                fontWeight: FontWeight.w600,
                decoration: _have.contains(i) ? TextDecoration.lineThrough : null,
                color: _have.contains(i) ? c.inkSoft : c.ink,
              ),
            ),
          ),
      ],
    );
  }

  Widget _step(BuildContext context, String step) => Center(
    child: SingleChildScrollView(
      child: Text(step, style: const TextStyle(fontSize: TextSize.xxl, fontWeight: FontWeight.w700, height: 1.35, letterSpacing: -0.3)),
    ),
  );
}

/// "Cook" (step by step) and "Watch how" (videos of the dish), for a recipe card.
class CookActions extends StatelessWidget {
  const CookActions({super.key, required this.title, required this.ingredients, required this.steps});

  final String title;
  final List<String> ingredients;
  final List<String> steps;

  @override
  Widget build(BuildContext context) => Wrap(
    children: [
      if (steps.isNotEmpty)
        TextButton.icon(
          onPressed: () => showCookMode(context, title: title, ingredients: ingredients, steps: steps),
          icon: const Icon(Icons.soup_kitchen_outlined, size: 18),
          label: const Text('Cook'),
        ),
      TextButton.icon(
        onPressed: () => AppScope.of(context).openLink(videoSearchFor(title)),
        icon: const Icon(Icons.play_circle_outline_rounded, size: 18),
        label: const Text('Watch how'),
      ),
    ],
  );
}
