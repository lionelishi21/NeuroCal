import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/widgets/logo.dart';

// Regenerate: flutter test tool/icon_test.dart --update-goldens && dart run flutter_launcher_icons
// Icon masters: the mark at 78% on night (#0C1324), as in the web app's apple-icon.png; plus a
// transparent foreground for Android adaptive icons (mark inside the 66% safe zone).
Widget mark(double scale, Color? bg) => Container(
  color: bg,
  alignment: Alignment.center,
  child: SizedBox.square(
    dimension: 1024 * scale,
    child: const CustomPaint(
      painter: LogoPainter(ring: Color(0xFF9D86FF), spark: Color(0xFF43D9C8)),
    ),
  ),
);

void main() {
  testWidgets('icons', (tester) async {
    tester.view.physicalSize = const Size(1024, 1024);
    tester.view.devicePixelRatio = 1;
    await tester.pumpWidget(RepaintBoundary(child: mark(0.78, const Color(0xFF0C1324))));
    await expectLater(find.byType(RepaintBoundary).first, matchesGoldenFile('../assets/icon/icon.png'));
    await tester.pumpWidget(RepaintBoundary(child: mark(0.5, null)));
    await expectLater(find.byType(RepaintBoundary).first, matchesGoldenFile('../assets/icon/foreground.png'));
  });
}
