import 'dart:async';

import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// done: it happened. info: for your information. problem: it did not happen.
enum ToastTone { done, info, problem }

/// Shows [message] at the top of the screen for four seconds, replacing any toast already there.
void showToast(BuildContext context, String message, [ToastTone tone = ToastTone.done]) =>
    context.findAncestorStateOfType<_ToastHostState>()?.show(message, tone);

/// Hosts the app's toasts above every screen and sheet. Wrap the app's navigator in it.
class ToastHost extends StatefulWidget {
  const ToastHost({super.key, required this.child});

  final Widget child;

  @override
  State<ToastHost> createState() => _ToastHostState();
}

class _ToastHostState extends State<ToastHost> {
  ({String message, ToastTone tone, int id})? _toast;
  Timer? _timer;
  var _count = 0;

  void show(String message, ToastTone tone) {
    _timer?.cancel();
    _timer = Timer(const Duration(seconds: 4), () => setState(() => _toast = null));
    setState(() => _toast = (message: message, tone: tone, id: ++_count));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final toast = _toast;
    final (dot, mark) = switch (toast?.tone) {
      ToastTone.info => (c.inkFaint, 'i'),
      ToastTone.problem => (NeuroCalColors.signalProblem, '!'),
      _ => (c.ion, '✓'),
    };
    return Stack(
      children: [
        widget.child,
        if (toast != null)
          Positioned(
            top: MediaQuery.paddingOf(context).top + Space.s2,
            left: Space.s4,
            right: Space.s4,
            child: IgnorePointer(
              child: TweenAnimationBuilder<double>(
                key: ValueKey(toast.id),
                tween: Tween(begin: 0, end: 1),
                duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 280),
                curve: Motion.settle,
                builder: (context, t, child) => Opacity(
                  opacity: t,
                  child: Transform.translate(offset: Offset(0, -16 * (1 - t)), child: child),
                ),
                child: Semantics(
                  liveRegion: true,
                  child: Material(
                    type: MaterialType.transparency,
                    child: Container(
                      constraints: const BoxConstraints(minHeight: 52),
                      padding: const EdgeInsets.symmetric(horizontal: Space.s4, vertical: Space.s2),
                      decoration: BoxDecoration(
                        color: c.toast,
                        borderRadius: BorderRadius.circular(Radii.control),
                        boxShadow: const [BoxShadow(color: Color(0x40000000), blurRadius: 30, offset: Offset(0, 10))],
                      ),
                      child: Row(
                        children: [
                          ExcludeSemantics(
                            child: Container(
                              width: 22,
                              height: 22,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(color: dot, shape: BoxShape.circle),
                              child: Text(
                                mark,
                                style: const TextStyle(
                                  fontSize: TextSize.xxs,
                                  fontWeight: FontWeight.w800,
                                  color: NeuroCalColors.onSignal,
                                  height: 1,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              toast.message,
                              style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.onToast),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
