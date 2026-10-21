import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/widgets/move_figure.dart';

Widget _host(Widget child, {bool reduceMotion = false}) => MaterialApp(
  theme: buildTheme(Brightness.light),
  home: MediaQuery(
    data: MediaQueryData(disableAnimations: reduceMotion),
    child: Center(child: SizedBox(width: 200, height: 240, child: child)),
  ),
);

void main() {
  testWidgets('every move draws, and keeps moving at rep pace until it is paused', (tester) async {
    for (final kind in MoveKind.values) {
      await tester.pumpWidget(_host(MoveFigure(kind)));
      await tester.pump(const Duration(milliseconds: 500));
      expect(tester.takeException(), isNull);
      // A rest stands still; every move keeps repeating.
      expect(tester.hasRunningAnimations, kind != MoveKind.rest, reason: kind.name);
    }
    await tester.pumpWidget(_host(const MoveFigure(MoveKind.calfRaise, animate: false)));
    // Past the theme's own short fade from the rebuilt host.
    await tester.pump(const Duration(milliseconds: 500));
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets('under reduced motion it holds still', (tester) async {
    await tester.pumpWidget(_host(const MoveFigure(MoveKind.soleusPushUp), reduceMotion: true));
    await tester.pump();
    expect(tester.hasRunningAnimations, isFalse);
    expect(tester.takeException(), isNull);
  });

  testWidgets('a figure answering a tap plays its reps and then holds still', (tester) async {
    await tester.pumpWidget(_host(const MoveFigure(MoveKind.walk, reps: 3)));
    await tester.pump(const Duration(milliseconds: 500));
    expect(tester.hasRunningAnimations, isTrue);
    // Three strides there and back at 550 ms each way.
    await tester.pump(const Duration(seconds: 4));
    expect(tester.hasRunningAnimations, isFalse);
  });
}
