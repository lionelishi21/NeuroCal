import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import 'food_image.dart';

/// The food catalog's entry for an ingredient name ("cherry tomatoes", "Salmon fillet"), or null.
/// The longest catalog name inside the ingredient wins, so "sweet potato" beats "potato".
CatalogFood? foodFor(String ingredient, List<CatalogFood> foods) {
  final name = ingredient.toLowerCase();
  CatalogFood? best;
  for (final f in foods) {
    final fname = f.name.toLowerCase();
    final singular = fname.endsWith('s') ? fname.substring(0, fname.length - 1) : fname;
    if (singular.length < 3) continue;
    if (name.contains(singular) && (best == null || fname.length > best.name.length)) best = f;
  }
  return best;
}

/// A meal's picture: its main ingredients' photos from the food catalog, overlapping on a soft wash of
/// the brand gradient, popping in one after another. Without a match, a plate.
class MealVisual extends StatelessWidget {
  const MealVisual({super.key, required this.ingredients, this.height = 128});

  /// Ingredient names, most important first.
  final List<String> ingredients;
  final double height;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return FutureBuilder(
      future: AppScope.of(context).api.foods(),
      builder: (context, snapshot) {
        final foods = snapshot.data ?? const <CatalogFood>[];
        final picked = <CatalogFood>[];
        for (final i in ingredients) {
          final f = foodFor(i, foods);
          if (f != null && !picked.any((p) => p.id == f.id)) picked.add(f);
          if (picked.length == 3) break;
        }
        return ExcludeSemantics(
          child: Container(
            height: height,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(Radii.option),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color.alphaBlend(NeuroCalColors.ringFrom.withValues(alpha: 0.16), c.paper),
                  Color.alphaBlend(NeuroCalColors.ringTo.withValues(alpha: 0.16), c.paper),
                ],
              ),
            ),
            child: Center(
              child: picked.isEmpty
                  ? _Pop(index: 0, child: _Plate(size: height * 0.62))
                  : SizedBox(
                      height: height * 0.72,
                      width: height * 0.72 * (1 + 0.62 * (picked.length - 1)),
                      child: Stack(
                        children: [
                          for (final (i, f) in picked.indexed)
                            Positioned(
                              left: i * height * 0.72 * 0.62,
                              top: 0,
                              bottom: 0,
                              child: _Pop(
                                index: i,
                                // A slight fan, like plates set down on a table.
                                tilt: (i - (picked.length - 1) / 2) * 0.08,
                                child: Container(
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(color: c.paper, width: 3),
                                    boxShadow: [BoxShadow(color: c.ink.withValues(alpha: 0.12), blurRadius: 10, offset: const Offset(0, 4))],
                                  ),
                                  child: ClipOval(child: FoodImage(id: f.id, category: f.category, size: height * 0.72 - 6, radius: height)),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
            ),
          ),
        );
      },
    );
  }
}

class _Plate extends StatelessWidget {
  const _Plate({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: c.paper, shape: BoxShape.circle, border: Border.all(color: c.rule, width: 2)),
      child: Icon(Icons.restaurant_rounded, size: size * 0.45, color: c.synapseInk),
    );
  }
}

/// Scales and fades in after the ones before it; still under reduced motion.
class _Pop extends StatelessWidget {
  const _Pop({required this.index, required this.child, this.tilt = 0});

  final int index;
  final double tilt;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final still = MediaQuery.disableAnimationsOf(context);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: still ? 1 : 0, end: 1),
      duration: const Duration(milliseconds: 650),
      curve: Interval((index * 0.18).clamp(0, 0.6), 1, curve: Curves.easeOutBack),
      builder: (context, t, child) => Opacity(
        opacity: t.clamp(0, 1),
        child: Transform.rotate(angle: tilt * t, child: Transform.scale(scale: 0.6 + 0.4 * t, child: child)),
      ),
      child: child,
    );
  }
}

/// A search for the dish on YouTube, so people can watch someone make it.
Uri videoSearchFor(String dish) => Uri.https('www.youtube.com', '/results', {'search_query': '$dish recipe'});
