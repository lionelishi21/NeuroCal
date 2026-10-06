import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// A white card with a hairline border, as every block in the design sits on.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(Space.s4),
    this.radius = Radii.card,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: padding,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: c.paper,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: c.rule),
      ),
      child: child,
    );
  }
}

/// The small grey heading of a settings group.
class GroupLabel extends StatelessWidget {
  const GroupLabel(this.text, {super.key, this.top = 22});

  final String text;
  final double top;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(Space.s1, top, Space.s1, Space.s2),
    child: Semantics(
      header: true,
      child: Text(
        text,
        style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: context.colors.inkSoft),
      ),
    ),
  );
}

/// The heavier heading of a block of content, with an optional note at the far end.
class BlockTitle extends StatelessWidget {
  const BlockTitle(this.text, {super.key, this.note});

  final String text;
  final String? note;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(Space.s1, 22, Space.s1, Space.s2),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Expanded(
          child: Semantics(
            header: true,
            child: Text(
              text,
              style: const TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w700),
            ),
          ),
        ),
        if (note != null)
          Text(
            note!,
            style: TextStyle(fontSize: TextSize.xs, color: context.colors.inkSoft),
          ),
      ],
    ),
  );
}

/// A soft violet pill: the secondary action inside a card.
class SoftButton extends StatelessWidget {
  const SoftButton({super.key, required this.label, required this.onPressed, this.height = 44, this.semanticLabel});

  final String label;
  final VoidCallback? onPressed;
  final double height;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      button: true,
      label: semanticLabel ?? label,
      excludeSemantics: true,
      child: Material(
        color: c.synapseSoft,
        shape: const StadiumBorder(),
        child: InkWell(
          onTap: onPressed,
          customBorder: const StadiumBorder(),
          child: Container(
            height: height,
            alignment: Alignment.center,
            padding: EdgeInsets.symmetric(horizontal: height >= 44 ? Space.s4 : Space.s3),
            child: Text(
              label,
              style: TextStyle(
                fontSize: height >= 44 ? TextSize.sm : TextSize.xs,
                fontWeight: FontWeight.w700,
                color: c.synapseInk,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A thin rounded bar filled to [value] (0–1).
class Meter extends StatelessWidget {
  const Meter({super.key, required this.value, required this.color, this.height = 4});

  final double value;
  final Color color;
  final double height;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: ClipRRect(
      borderRadius: BorderRadius.circular(Radii.pill),
      child: LinearProgressIndicator(
        value: value.clamp(0, 1),
        minHeight: height,
        backgroundColor: context.colors.track,
        color: color,
      ),
    ),
  );
}

/// Placeholder blocks while a screen loads; [heights] are the blocks it stands in for.
class ScreenLoading extends StatelessWidget {
  const ScreenLoading({super.key, required this.label, required this.heights});

  final String label;
  final List<double> heights;

  @override
  Widget build(BuildContext context) => Semantics(
    label: label,
    child: Column(
      spacing: Space.s3,
      children: [
        for (final height in heights)
          Container(
            height: height,
            decoration: BoxDecoration(color: context.colors.track, borderRadius: BorderRadius.circular(Radii.card)),
          ),
      ],
    ),
  );
}

/// A screen that didn't load: what failed, then one retry.
class ScreenFailed extends StatelessWidget {
  const ScreenFailed({super.key, required this.title, required this.detail, required this.onRetry});

  final String title;
  final String detail;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppCard(
      radius: Radii.hero,
      padding: const EdgeInsets.fromLTRB(20, Space.s5, 20, Space.s5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExcludeSemantics(
            child: Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: c.beetSoft, shape: BoxShape.circle),
              child: Text(
                '!',
                style: TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800, color: c.beet, height: 1),
              ),
            ),
          ),
          const SizedBox(height: Space.s3),
          Text(
            title,
            style: const TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800, height: 1.2),
          ),
          const SizedBox(height: Space.s2),
          Text(
            detail,
            style: TextStyle(fontSize: TextSize.md, color: c.inkSoft),
          ),
          const SizedBox(height: Space.s4),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
            onPressed: onRetry,
            child: const Text('Try again'),
          ),
        ],
      ),
    );
  }
}

/// Nothing here yet: one line on what goes here, then the action that fills it.
class EmptyCard extends StatelessWidget {
  const EmptyCard({super.key, required this.title, required this.detail, this.action});

  final String title;
  final String detail;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return CustomPaint(
      painter: _DashedBorder(color: c.ruleStrong, radius: Radii.card),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: Space.s2),
            Text(
              detail,
              style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
            ),
            if (action != null) ...[const SizedBox(height: Space.s3), action!],
          ],
        ),
      ),
    );
  }
}

class _DashedBorder extends CustomPainter {
  const _DashedBorder({required this.color, required this.radius});

  final Color color;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    final outline = Path()
      ..addRRect(RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(radius)).deflate(0.75));
    for (final metric in outline.computeMetrics()) {
      for (var at = 0.0; at < metric.length; at += 10) {
        canvas.drawPath(metric.extractPath(at, at + 5), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorder old) => old.color != color || old.radius != radius;
}

/// The screen's main actions, floating above the tab bar on a fade so content scrolls out underneath.
class ActionBar extends StatelessWidget {
  const ActionBar({super.key, required this.children});

  final List<Widget> children;

  /// Bottom padding a scrolling screen needs so its last row clears the bar.
  static const clearance = 96.0;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [c.mist.withValues(alpha: 0), c.mist],
          stops: const [0, 0.35],
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Space.s4, Space.s4, Space.s4, Space.s3),
        child: Row(spacing: 10, children: children),
      ),
    );
  }
}
