import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/widgets/logo.dart';
import 'package:neurocal/widgets/splash.dart';

void main() {
  testWidgets('the splash shows the mark, the name and the promise, and holds still with reduced motion', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        theme: buildTheme(Brightness.light),
        home: const MediaQuery(data: MediaQueryData(disableAnimations: true), child: SplashScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(LogoMark), findsOneWidget);
    expect(find.text('NeuroCal'), findsOneWidget);
    expect(find.text('Lose weight. Think clearer.'), findsOneWidget);
    expect(find.bySemanticsLabel('NeuroCal is loading'), findsOneWidget);
  });
}
