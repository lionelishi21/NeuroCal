import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/main.dart';
import 'package:neurocal/reminders/reminders.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  Future<FakeReminders> pumpSignedIn(WidgetTester tester, {bool allowed = true}) async {
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final device = FakeReminders(allowed: allowed);
    await tester.pumpWidget(
      NeuroCalApp(
        api: MockNeuroCalApi()..latency = Duration.zero,
        auth: MockAuthClient(),
        theme: ThemeController(prefs),
        reminders: ReminderSettings(prefs, device),
      ),
    );
    await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'sam@example.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'correct-horse');
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();
    return device;
  }

  Future<void> openMe(WidgetTester tester) async {
    await tester.tap(find.widgetWithText(InkWell, 'Me'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Evening · 20:30'), 200);
  }

  Future<void> flip(WidgetTester tester, Finder sw) async {
    await tester.ensureVisible(sw);
    await tester.pumpAndSettle();
    await tester.tap(sw);
    await tester.pumpAndSettle();
  }

  testWidgets('switching a reminder on schedules it every day, and off removes it', (tester) async {
    final device = await pumpSignedIn(tester);
    await openMe(tester);

    await flip(tester, find.byType(Switch).first);
    expect(device.scheduled, {ReminderSlot.morning});
    expect(find.text('Reminder set for 08:30 every day'), findsOneWidget);

    await flip(tester, find.byType(Switch).last);
    expect(device.scheduled, {ReminderSlot.morning, ReminderSlot.evening});

    await flip(tester, find.byType(Switch).first);
    expect(device.scheduled, {ReminderSlot.evening});
  });

  testWidgets('with notifications refused, the switch stays off and says how to fix it', (tester) async {
    final device = await pumpSignedIn(tester, allowed: false);
    await openMe(tester);

    await flip(tester, find.byType(Switch).first);
    expect(device.scheduled, isEmpty);
    expect(tester.widget<Switch>(find.byType(Switch).first).value, isFalse);
    expect(find.textContaining('Turn them on in your phone'), findsOneWidget);
  });

  testWidgets('tapping a reminder opens the check-in', (tester) async {
    final device = await pumpSignedIn(tester);
    await openMe(tester);

    device.tap();
    await tester.pumpAndSettle();
    expect(find.text('Save check-in'), findsOneWidget);
  });
}
