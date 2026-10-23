import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/share_card.dart';
import '../widgets/ui.dart';

/// The biohacking level (docs/NCBM.md §8): where you are on the ladder from Aware to Upgraded, what the
/// next level needs and how close each habit is. Earned by habits over 28 days, never by buying anything.
class LevelView extends StatefulWidget {
  const LevelView({super.key, required this.changes});

  /// Fires when something was logged on any tab.
  final Listenable changes;

  @override
  State<LevelView> createState() => _LevelViewState();
}

class _LevelViewState extends State<LevelView> {
  Future<Level>? _level;

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
    _level ??= _load();
  }

  void _reload() => setState(() {
    _level = _load();
  });

  static const _seenKey = 'levelSeen';

  /// A level higher than the last one seen, until it's shared or dismissed.
  var _reached = false;

  /// Loads the level and notes a new one, so the view can mark the moment.
  Future<Level> _load() async {
    final level = await AppScope.of(context).api.level();
    try {
      final prefs = await SharedPreferences.getInstance();
      final seen = prefs.getInt(_seenKey);
      if (seen != null && level.level > seen) {
        if (mounted) setState(() => _reached = true);
      } else {
        await prefs.setInt(_seenKey, level.level);
      }
    } catch (_) {
      // Without storage there's no level-up moment; the level still shows.
    }
    return level;
  }

  Future<void> _seen(Level level) async {
    setState(() => _reached = false);
    try {
      await (await SharedPreferences.getInstance()).setInt(_seenKey, level.level);
    } catch (_) {
      // Shown again next time; harmless.
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder(
    future: _level,
    builder: (context, snapshot) => ListView(
      padding: const EdgeInsets.fromLTRB(Space.s4, Space.s4, Space.s4, Space.s6),
      children: [
        const ScreenTitle('Your level', detail: 'From your habits over the last 28 days'),
        const SizedBox(height: 14),
        if (snapshot.hasError)
          ScreenFailed(
            title: "Couldn't load your level",
            detail: 'Check your connection and try again.',
            onRetry: _reload,
          )
        else if (!snapshot.hasData)
          const ScreenLoading(label: 'Loading your level', heights: [180, 220])
        else
          ..._body(context, snapshot.data!),
      ],
    ),
  );

  List<Widget> _body(BuildContext context, Level l) {
    final c = context.colors;
    final next = l.level < 5 ? l.level + 1 : null;
    final nextHabits = [
      for (final r in l.requirements)
        if (r.level == next) r,
    ];
    final held = [
      for (final r in l.requirements)
        if (r.level <= l.level) r,
    ];
    return [
      if (_reached) ...[
        _Reached(
          l,
          onShare: () {
            _seen(l);
            showShareLevel(context, level: l.level, name: l.name, justReached: true);
          },
          onDismiss: () => _seen(l),
        ),
        const SizedBox(height: Space.s3),
      ],
      _Ladder(l),
      if (l.level > 0 && !_reached)
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: () => showShareLevel(context, level: l.level, name: l.name),
            icon: const Icon(Icons.ios_share_rounded, size: 18),
            label: const Text('Share your level'),
          ),
        ),
      if (next == null)
        Padding(
          padding: const EdgeInsets.only(top: Space.s3),
          child: Text(
            'You hold every level. Keep the habits and it stays.',
            style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
          ),
        )
      else ...[
        BlockTitle(
          'To reach ${Level.names[next]}',
          note: '${nextHabits.where((r) => r.met).length} of ${nextHabits.length} done',
        ),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(children: [for (final (i, r) in nextHabits.indexed) _Habit(r, divider: i > 0)]),
        ),
      ],
      if (held.isNotEmpty) ...[
        const BlockTitle('Habits you hold'),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(children: [for (final (i, r) in held.indexed) _Habit(r, divider: i > 0)]),
        ),
      ],
      Padding(
        padding: const EdgeInsets.only(top: Space.s3),
        child: Text(
          'A level holds while its habits do. Each level needs every level below it.',
          style: TextStyle(fontSize: TextSize.xs, color: c.inkFaint),
        ),
      ),
    ];
  }
}

/// "You reached Fuelled": shown once per new level, with its card to share.
class _Reached extends StatelessWidget {
  const _Reached(this.level, {required this.onShare, required this.onDismiss});

  final Level level;
  final VoidCallback onShare;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppCard(
      padding: const EdgeInsets.fromLTRB(Space.s4, Space.s3, Space.s2, Space.s3),
      child: Row(
        children: [
          Icon(Icons.celebration_rounded, color: c.synapseInk),
          const SizedBox(width: Space.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 2,
              children: [
                Text(
                  'You reached ${level.name}',
                  style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
                ),
                Text(
                  'Level ${level.level} of 5, from your habits.',
                  style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                ),
              ],
            ),
          ),
          TextButton(onPressed: onShare, child: const Text('Share')),
          IconButton(
            tooltip: 'Dismiss',
            icon: Icon(Icons.close_rounded, color: c.inkSoft),
            onPressed: onDismiss,
          ),
        ],
      ),
    );
  }
}

/// The current level as a badge, and the five steps with the ones reached filled in.
class _Ladder extends StatelessWidget {
  const _Ladder(this.level);

  final Level level;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final still = MediaQuery.disableAnimationsOf(context);
    return Semantics(
      label: 'Level ${level.level} of 5: ${level.name}',
      excludeSemantics: true,
      child: AppCard(
        radius: Radii.hero,
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: Space.s4,
          children: [
            Row(
              spacing: Space.s4,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [NeuroCalColors.ringFrom, NeuroCalColors.ringTo],
                    ),
                  ),
                  child: Text(
                    '${level.level}',
                    style: const TextStyle(
                      fontSize: TextSize.xxxl,
                      fontWeight: FontWeight.w800,
                      color: NeuroCalColors.onSignal,
                      height: 1,
                    ),
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 2,
                    children: [
                      Text(
                        level.level == 0 ? 'Level 1 is next' : 'Level ${level.level} of 5',
                        style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: c.synapseInk),
                      ),
                      Text(
                        level.name,
                        style: const TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800, height: 1.15),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            Row(
              spacing: Space.s1,
              children: [
                for (var step = 1; step <= 5; step++)
                  Expanded(
                    child: Column(
                      spacing: 6,
                      children: [
                        // Steps reached fill in, one after another, when the view opens.
                        TweenAnimationBuilder<double>(
                          tween: Tween(begin: still ? 1 : 0, end: 1),
                          duration: Motion.step,
                          curve: Interval((step - 1) * 0.12, 1, curve: Motion.settle),
                          builder: (context, t, _) => Container(
                            height: 8,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(Radii.pill),
                              color: step <= level.level ? Color.lerp(c.track, c.synapse, t) : c.track,
                            ),
                          ),
                        ),
                        Text(
                          Level.names[step],
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          style: TextStyle(
                            fontSize: TextSize.xxxs,
                            fontWeight: step == level.level ? FontWeight.w800 : FontWeight.w600,
                            color: step <= level.level ? c.ink : c.inkFaint,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Habit extends StatelessWidget {
  const _Habit(this.habit, {required this.divider});

  final ({int level, String title, bool met, String progress}) habit;
  final bool divider;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return MergeSemantics(
      child: Container(
        padding: const EdgeInsets.fromLTRB(Space.s4, Space.s3, Space.s4, Space.s3),
        decoration: BoxDecoration(
          border: divider ? Border(top: BorderSide(color: c.rule)) : null,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: Space.s3,
          children: [
            Icon(
              habit.met ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
              size: 22,
              color: habit.met ? c.chlorophyll : c.ruleStrong,
              semanticLabel: habit.met ? 'Done' : 'Not yet',
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 2,
                children: [
                  Text(
                    habit.title,
                    style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, height: 1.3),
                  ),
                  Text(
                    habit.progress,
                    style: TextStyle(fontSize: TextSize.xs, height: 1.35, color: c.inkSoft),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
