import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/main.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The app's main screens against Flutter's accessibility guidelines: tap targets of at least
/// 48 × 48 (Android) and 44 × 44 (iOS), a label on everything tappable, and readable text contrast;
/// and the same screens with text twice the normal size on a small phone, where nothing may overflow.
Future<void> _open(WidgetTester tester, {Brightness brightness = Brightness.light, double textScale = 1}) async {
  tester.view.physicalSize = const Size(360, 740);
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.platformBrightnessTestValue = brightness;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearAllTestValues);
  SharedPreferences.setMockInitialValues({});
  await tester.pumpWidget(
    NeuroCalApp(
      api: MockNeuroCalApi()..latency = Duration.zero,
      auth: MockAuthClient(),
      theme: ThemeController(await SharedPreferences.getInstance()),
      openLink: (_) async => true,
    ),
  );
  await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'sam@example.com');
  await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'correct-horse');
  await tester.ensureVisible(find.widgetWithText(FilledButton, 'Sign in'));
  await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
  await tester.pumpAndSettle();
}

/// Each tab, scrolled through, then back to Today.
Future<void> _eachTab(WidgetTester tester, Future<void> Function(String tab) check) async {
  for (final tab in ['Today', 'Kitchen', 'Progress', 'Stack']) {
    await tester.tap(find.widgetWithText(InkWell, tab).last);
    await tester.pumpAndSettle();
    await check(tab);
  }
}

Future<void> _guidelines(WidgetTester tester, String where) async {
  final handle = tester.ensureSemantics();
  for (final (name, guideline) in [
    ('Android tap targets', androidTapTargetGuideline),
    ('iOS tap targets', iOSTapTargetGuideline),
    ('labels', labeledTapTargetGuideline),
    ('text contrast', textContrastGuideline),
  ]) {
    await expectLater(tester, meetsGuideline(guideline), reason: '$name on $where');
  }
  handle.dispose();
}

void main() {
  for (final brightness in Brightness.values) {
    testWidgets('every tab meets the guidelines (${brightness.name})', (tester) async {
      await _open(tester, brightness: brightness);
      // Today is drawn, not squeezed out of view by the tab bar.
      expect(find.text('Focus Score').hitTestable(), findsOneWidget);
      await _eachTab(tester, (tab) => _guidelines(tester, '$tab, ${brightness.name}'));
    });
  }

  testWidgets('text at twice the size fits on a small phone, on every tab and down each one', (tester) async {
    await _open(tester, textScale: 2);
    expect(find.text('Focus Score').hitTestable(), findsOneWidget);
    await _eachTab(tester, (tab) async {
      final list = find.byType(Scrollable).first;
      for (var i = 0; i < 12; i++) {
        await tester.drag(list, const Offset(0, -500));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: '$tab, scrolled ${i + 1} times');
      }
    });
  });

  testWidgets('text at twice the size fits in the add menu and each logging sheet', (tester) async {
    await _open(tester, textScale: 2);
    for (final entry in [
      'Log a meal',
      'Check in',
      'Log exercise',
      'Log sleep',
      'Log weight',
      'Log screen time',
      'Brain speed check',
    ]) {
      await tester.tap(find.bySemanticsLabel('Add'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'the add menu');
      final item = find.descendant(of: find.byType(BottomSheet), matching: find.text(entry));
      await tester.ensureVisible(item);
      await tester.pumpAndSettle();
      await tester.tap(item);
      await tester.pumpAndSettle();
      final lists = find.byType(Scrollable);
      if (lists.evaluate().isNotEmpty) {
        await tester.drag(lists.last, const Offset(0, -600), warnIfMissed: false);
        await tester.pumpAndSettle();
      }
      expect(tester.takeException(), isNull, reason: entry);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      // A closing sheet is laid out once more on its way out; that frame is never seen.
      tester.takeException();
    }
  });
}
