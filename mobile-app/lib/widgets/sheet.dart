import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// Opens a bottom sheet in the app's style: a title with a close button, then [builder]'s content.
/// The sheet rises above the keyboard and scrolls when it is taller than the screen.
Future<T?> showAppSheet<T>(BuildContext context, {required String title, required WidgetBuilder builder}) =>
    showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      barrierColor: NeuroCalColors.scrim,
      builder: (context) => SafeArea(
        child: Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, Space.s5),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 14,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Semantics(
                        header: true,
                        child: Text(
                          title,
                          style: const TextStyle(
                            fontSize: TextSize.xl,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.3,
                          ),
                        ),
                      ),
                    ),
                    Transform.translate(
                      offset: const Offset(10, 0),
                      child: IconButton(
                        tooltip: 'Close',
                        icon: Icon(Icons.close_rounded, color: context.colors.inkSoft),
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                    ),
                  ],
                ),
                builder(context),
              ],
            ),
          ),
        ),
      ),
    );

/// A note inside a sheet: a bold lead that names it, then one or two plain sentences.
class SheetNote extends StatelessWidget {
  const SheetNote({super.key, required this.lead, required this.detail, this.watch = false});

  final String lead;
  final String detail;

  /// "Watch this" (amber) rather than a problem (red).
  final bool watch;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      liveRegion: !watch,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: Space.s3),
        decoration: BoxDecoration(
          color: watch ? c.glucoseSoft : c.beetSoft,
          borderRadius: BorderRadius.circular(Radii.option),
        ),
        child: Text.rich(
          TextSpan(
            children: [
              TextSpan(
                text: '$lead ',
                style: TextStyle(fontWeight: FontWeight.w800, color: watch ? c.glucoseInk : c.beet),
              ),
              TextSpan(text: detail),
            ],
          ),
          style: TextStyle(fontSize: TextSize.xs, height: 1.45, color: c.ink),
        ),
      ),
    );
  }
}

/// The sheet's one main action: 56 px, full width.
class SheetAction extends StatelessWidget {
  const SheetAction({super.key, required this.label, required this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => FilledButton(
    style: FilledButton.styleFrom(
      minimumSize: const Size.fromHeight(56),
      textStyle: const TextStyle(fontSize: TextSize.base, fontWeight: FontWeight.w700),
    ),
    onPressed: onPressed,
    child: Text(label),
  );
}

/// A pill that is filled when chosen: check-in feelings, screen-time amounts.
class ChoicePill extends StatelessWidget {
  const ChoicePill({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.radius = Radii.pill,
    this.height = 44,
    this.semanticLabel,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final double radius;
  final double height;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final shape = BorderRadius.circular(radius);
    return Semantics(
      button: true,
      selected: selected,
      label: semanticLabel ?? label,
      excludeSemantics: true,
      child: Material(
        color: selected ? c.synapse : c.paper,
        shape: RoundedRectangleBorder(
          borderRadius: shape,
          side: BorderSide(color: selected ? c.synapse : c.ruleStrong, width: 1.5),
        ),
        child: InkWell(
          borderRadius: shape,
          onTap: onTap,
          child: Container(
            height: height,
            alignment: Alignment.center,
            padding: EdgeInsets.symmetric(horizontal: radius == Radii.pill ? Space.s4 : Space.s1),
            child: Text(
              label,
              style: TextStyle(
                fontSize: TextSize.md,
                fontWeight: FontWeight.w700,
                color: selected ? c.onAccent : c.ink,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
