import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/theme/tokens.dart';
import 'package:neurocal/widgets/logo.dart';

// Regenerate: flutter test tool/icon_test.dart --update-goldens && dart run flutter_launcher_icons,
// then tool/splash_sizes.sh for the launch screens.
// Masters from the design's mark (design_system/.../assets/neurocal-icon.svg):
// - icon.png: the app icon, the mark on night at its own size and margin.
// - foreground.png: the Android adaptive icon's mark, transparent, filling the square (the launcher
//   insets it 16% and masks it, which leaves the ring inside the safe zone).
// - splash.png: the launch screen's mark, transparent, 148 dp at 4x.
// - splash_android12.png: Android 12's launch icon, 288 dp at 4x with the mark in the middle 192 dp
//   that the system shows.
Widget painted(double canvas, double mark, {Color? background}) => SizedBox.square(
  dimension: canvas,
  child: Center(
    child: CustomPaint(
      size: Size.square(mark),
      painter: LogoPainter(background: background),
    ),
  ),
);

Future<void> render(WidgetTester tester, String file, double canvas, double mark, {Color? background}) async {
  tester.view.physicalSize = Size.square(canvas);
  tester.view.devicePixelRatio = 1;
  await tester.pumpWidget(RepaintBoundary(child: painted(canvas, mark, background: background)));
  await expectLater(find.byType(RepaintBoundary).first, matchesGoldenFile('../assets/icon/$file'));
}

void main() {
  testWidgets('icons', (tester) async {
    addTearDown(tester.view.reset);
    await render(tester, 'icon.png', 1024, 1024, background: NeuroCalColors.night);
    await render(tester, 'foreground.png', 1024, 1024);
    await render(tester, 'splash.png', 592, 592);
    await render(tester, 'splash_android12.png', 1152, 768);
  });
}
