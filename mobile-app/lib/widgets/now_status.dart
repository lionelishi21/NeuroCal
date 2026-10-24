import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../body_state.dart';
import '../theme/tokens.dart';

/// The colours of a state, strongest first: amber for caffeine, violet for a fat fast, teal for a fast.
/// Empty when nothing is going on, and the app keeps its usual blue-to-teal.
List<Color> stateColors(BodyState s, NeuroCalColors c) => [
  if (s.phase != null) c.glucose,
  if (s.fatFast) c.synapse else if (s.fasting) c.ion,
];

String _clock(DateTime t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

String _length(Duration d) => d.inMinutes < 60 ? '${d.inMinutes} min' : '${d.inHours} h';

/// "Now" at the top of Today: what the coffee and the fast are doing, a line each.
class NowStatus extends StatelessWidget {
  const NowStatus(this.state, {super.key});

  final BodyState state;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final s = state;
    final caffeine = switch (s.phase) {
      CaffeinePhase.rising => ('Caffeine rising', 'Peaks about ${_clock(s.peakAt!)}. Start your hardest task then.'),
      CaffeinePhase.peak => ('Peak focus window', '${s.caffeineMg} mg caffeine active. Do your hardest work now.'),
      CaffeinePhase.fading => ('Caffeine wearing off', '${s.caffeineMg} mg left in you.'),
      null => null,
    };
    final fast = !s.fasting
        ? null
        : s.fatFast
        ? (
            'Fat fast · ${_length(s.fastingFor!)}',
            'Your fast keeps going on the fat in your coffee. MCT oil turns into ketones, fuel for your brain.',
          )
        : ('Fasting · ${_length(s.fastingFor!)}', 'Water, black coffee and plain tea keep it going.');
    Widget row(Color dot, (String, String) text, {String? warning}) => Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: Space.s3,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Container(
            width: 12,
            height: 12,
            decoration: BoxDecoration(
              color: dot,
              shape: BoxShape.circle,
              boxShadow: [BoxShadow(color: dot.withValues(alpha: 0.5), blurRadius: 8)],
            ),
          ),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 2,
            children: [
              Text(
                text.$1,
                style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
              ),
              Text(
                text.$2,
                style: TextStyle(fontSize: TextSize.xs, height: 1.35, color: c.inkSoft),
              ),
              if (warning != null)
                Text(
                  warning,
                  style: TextStyle(
                    fontSize: TextSize.xs,
                    height: 1.35,
                    fontWeight: FontWeight.w700,
                    color: c.glucoseInk,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
    return Container(
      padding: const EdgeInsets.fromLTRB(Space.s4, Space.s3, Space.s4, 14),
      decoration: BoxDecoration(
        color: c.paper,
        borderRadius: BorderRadius.circular(Radii.card),
        border: Border.all(color: c.rule),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s3,
        children: [
          Text(
            'Now',
            style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w600, color: c.synapseInk),
          ),
          if (caffeine != null)
            row(
              c.glucose,
              caffeine,
              warning: s.lateCaffeine
                  ? 'About ${s.bedtimeMg} mg will still be in you at bedtime (${_clock(s.bedtime!)}). It costs deep sleep.'
                  : null,
            ),
          if (fast != null) row(s.fatFast ? c.synapse : c.ion, fast),
        ],
      ),
    );
  }
}

/// A glow behind the Focus Score ring in the state's colours. It breathes a few times when the state
/// changes (faster at peak caffeine), then rests; with reduced motion it stays still.
class StateAura extends StatefulWidget {
  const StateAura({super.key, required this.colors, required this.intensity, required this.child});

  final List<Color> colors;

  /// 0–1.
  final double intensity;
  final Widget child;

  @override
  State<StateAura> createState() => _StateAuraState();
}

class _StateAuraState extends State<StateAura> with SingleTickerProviderStateMixin {
  static const _breaths = 3;
  late final _pulse = AnimationController(vsync: this);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _breathe();
  }

  @override
  void didUpdateWidget(StateAura old) {
    super.didUpdateWidget(old);
    if (old.intensity != widget.intensity || !_same(old.colors, widget.colors)) _breathe();
  }

  static bool _same(List<Color> a, List<Color> b) =>
      a.length == b.length && [for (var i = 0; i < a.length; i++) a[i] == b[i]].every((x) => x);

  void _breathe() {
    if (widget.colors.isEmpty || MediaQuery.disableAnimationsOf(context)) {
      _pulse.value = 0;
      return;
    }
    // A breath is about 3 seconds, quicker when the caffeine is at its height.
    _pulse.duration = Duration(milliseconds: (3200 - 1400 * widget.intensity).round() * _breaths);
    _pulse.forward(from: 0);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = widget.colors;
    if (colors.isEmpty) return widget.child;
    return AnimatedBuilder(
      animation: _pulse,
      builder: (context, child) {
        // Each breath swells and settles: 0 at rest, 1 at its fullest.
        final breath = math.sin(math.pi * ((_pulse.value * _breaths) % 1));
        final strength = (0.25 + 0.25 * widget.intensity) * (1 + 0.6 * breath);
        return DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: colors.first.withValues(alpha: strength.clamp(0, 1)),
                blurRadius: 28 + 10 * breath,
                spreadRadius: 2 + 4 * breath,
                offset: colors.length > 1 ? const Offset(-6, -6) : Offset.zero,
              ),
              if (colors.length > 1)
                BoxShadow(
                  color: colors.last.withValues(alpha: (strength * 0.9).clamp(0, 1)),
                  blurRadius: 28 + 10 * breath,
                  spreadRadius: 2 + 4 * breath,
                  offset: const Offset(6, 6),
                ),
            ],
          ),
          child: child,
        );
      },
      child: widget.child,
    );
  }
}
