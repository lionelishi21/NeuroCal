import 'package:flutter/material.dart';

import '../api/models.dart';
import '../theme/tokens.dart';

/// Days something was taken against days it wasn't, in one line. Taking it adds no points to the
/// Focus Score; this is how it shows what it does for this person.
class DayEffectNote extends StatelessWidget {
  const DayEffectNote(this.effect, {super.key});

  final DayEffect effect;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final (icon, color) = switch (effect.verdict) {
      'helping' => (Icons.trending_up_rounded, c.chlorophyll),
      'worse' => (Icons.trending_down_rounded, c.beet),
      _ => (Icons.trending_flat_rounded, c.inkSoft),
    };
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: Space.s2,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Icon(icon, size: 16, color: color),
        ),
        Expanded(
          child: Text(effect.summary, style: const TextStyle(fontSize: TextSize.sm, height: 1.4)),
        ),
      ],
    );
  }
}
