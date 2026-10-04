import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../theme/theme_controller.dart';
import '../theme/tokens.dart';

/// Match device / Light / Dark as one segmented pill, the same choices as the web app.
class AppearanceSwitch extends StatelessWidget {
  const AppearanceSwitch({super.key, this.compact = false});

  /// Smaller text for headers.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context).theme;
    final c = context.colors;
    return ValueListenableBuilder(
      valueListenable: controller,
      builder: (context, mode, _) {
        final pill = Semantics(
          container: true,
          label: 'Appearance',
          child: Container(
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              color: c.paper,
              borderRadius: BorderRadius.circular(Radii.pill),
              border: Border.all(color: c.rule),
            ),
            child: Row(
              mainAxisSize: compact ? MainAxisSize.min : MainAxisSize.max,
              children: [
                for (final option in ThemeMode.values)
                  _segment(context, option, selected: mode == option, onTap: () => controller.choose(option)),
              ],
            ),
          ),
        );
        // In a header the pill shrinks rather than overflow on the narrowest phones or with large text.
        return compact ? FittedBox(fit: BoxFit.scaleDown, child: pill) : pill;
      },
    );
  }

  Widget _segment(BuildContext context, ThemeMode option, {required bool selected, required VoidCallback onTap}) {
    final c = context.colors;
    final label = Text(
      ThemeController.labels[option]!,
      textAlign: TextAlign.center,
      style: TextStyle(
        fontSize: compact ? TextSize.xs : TextSize.sm,
        fontWeight: FontWeight.w600,
        color: selected ? c.onAccent : c.inkSoft,
      ),
    );
    final segment = Semantics(
      button: true,
      selected: selected,
      child: Material(
        color: selected ? c.synapse : Colors.transparent,
        borderRadius: BorderRadius.circular(Radii.pill),
        child: InkWell(
          borderRadius: BorderRadius.circular(Radii.pill),
          onTap: onTap,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: compact ? Space.s3 : Space.s2, vertical: compact ? 6 : 10),
            child: label,
          ),
        ),
      ),
    );
    return compact ? segment : Expanded(child: segment);
  }
}
