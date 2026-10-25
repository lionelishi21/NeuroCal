import 'package:flutter/material.dart';

import '../theme/tokens.dart';
import 'logo.dart';

/// While the app starts (the profile and the subscription loading): the mark, the name and the promise
/// on the brand's night, with a short bar sliding along. From the Brand Assets splash design; the
/// phone's own launch screen shows the mark on the same night just before it.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final _slide = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _slide.value = 0.3;
    } else if (!_slide.isAnimating) {
      _slide.repeat();
    }
  }

  @override
  void dispose() {
    _slide.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: NeuroCalColors.night,
    body: Semantics(
      label: 'NeuroCal is loading',
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -0.12),
            radius: 0.9,
            colors: [NeuroCalColors.nightGlow, NeuroCalColors.night],
            stops: [0, 0.62],
          ),
        ),
        child: Stack(
          children: [
            Center(
              child: Transform.translate(
                offset: const Offset(0, -20),
                child: const Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    LogoMark(size: 148),
                    SizedBox(height: Space.s3),
                    Text(
                      'NeuroCal',
                      style: TextStyle(
                        fontSize: 38,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -1,
                        color: NeuroCalColors.onNight,
                      ),
                    ),
                    SizedBox(height: Space.s3),
                    Text(
                      'Lose weight. Think clearer.',
                      style: TextStyle(
                        fontSize: TextSize.lg,
                        fontWeight: FontWeight.w500,
                        color: NeuroCalColors.onNightSoft,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 72,
              child: Center(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: SizedBox(
                    width: 64,
                    height: 4,
                    child: ColoredBox(
                      color: NeuroCalColors.nightTrack,
                      child: AnimatedBuilder(
                        animation: _slide,
                        // 40% of the track, sliding through it and back in from the left.
                        builder: (context, _) => FractionallySizedBox(
                          widthFactor: 0.4,
                          alignment: Alignment(-2.5 + 5 * _slide.value, 0),
                          child: const DecoratedBox(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.all(Radius.circular(2)),
                              gradient: LinearGradient(colors: [NeuroCalColors.ringFrom, NeuroCalColors.ringTo]),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
