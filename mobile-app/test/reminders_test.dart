import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/main.dart';
import 'package:neurocal/reminders/reminders.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  group('nudgesFor', () {
    final morning9 = DateTime(2026, 10, 15, 9, 0);

    test('nudges at the start, an hour in, and a last call; never in the past', () {
      final nudges = nudgesFor(slots: {ReminderSlot.morning}, wakeHour: 7, now: DateTime(2026, 10, 15, 6), days: 1);
      expect([for (final n in nudges) clock(n.at)], ['07:30', '08:30', '09:30']);
      expect(nudges.last.body, 'Morning check-in closes at 10:00.');
      // At 09:00 only the last call is still ahead.
      expect([for (final n in nudgesFor(slots: {ReminderSlot.morning}, wakeHour: 7, now: morning9, days: 1)) clock(n.at)], ['09:30']);
    });

    test('a window checked in today gets no more nudges today, but does tomorrow', () {
      final nudges = nudgesFor(slots: {ReminderSlot.morning}, wakeHour: 7, now: morning9, doneToday: {ReminderSlot.morning}, days: 2);
      expect(nudges.every((n) => n.at.day == 16), isTrue);
      expect(nudges, hasLength(3));
    });

    test('follows the wake time, and stays under the 64 notifications iOS keeps', () {
      expect(ReminderSlot.evening.range(5.5), '18:00–20:30');
      expect(nudgesFor(slots: ReminderSlot.values.toSet(), wakeHour: 7, now: DateTime(2026, 10, 15)).length, lessThanOrEqualTo(64));
    });
  });

  test('checking in during a window marks it done and cancels its remaining nudges', () async {
    SharedPreferences.setMockInitialValues({});
    final device = FakeReminders();
    var now = DateTime(2026, 10, 15, 8, 0);
    final settings = ReminderSettings(await SharedPreferences.getInstance(), device, now: () => now);
    await settings.set(ReminderSlot.morning, true);
    expect(device.scheduled.where((n) => n.at.day == 15), hasLength(2)); // 08:30 and 09:30

    expect(settings.openAt(now), ReminderSlot.morning);
    await settings.checkedIn(now);
    expect(settings.doneOn(now), {ReminderSlot.morning});
    expect(device.scheduled.where((n) => n.at.day == 15), isEmpty);
    // A new day starts fresh.
    now = DateTime(2026, 10, 16, 8, 0);
    expect(settings.doneOn(now), isEmpty);
  });

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
    await tester.tap(find.bySemanticsLabel('Me'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Evening · 19:30–22:00'), 200);
  }

  Future<void> flip(WidgetTester tester, Finder sw) async {
    await tester.ensureVisible(sw);
    await tester.pumpAndSettle();
    await tester.tap(sw);
    await tester.pumpAndSettle();
  }

  testWidgets('switching a window on schedules its nudges, and off removes them', (tester) async {
    final device = await pumpSignedIn(tester);
    await openMe(tester);
    // Without a wake-up answer the windows assume 07:00.
    expect(find.text('Morning · 07:30–10:00'), findsOneWidget);

    await flip(tester, find.byType(Switch).first);
    expect(device.windows, {ReminderSlot.morning});
    expect(find.text('Morning window set: 07:30–10:00 every day'), findsOneWidget);

    await flip(tester, find.byType(Switch).last);
    expect(device.windows, {ReminderSlot.morning, ReminderSlot.evening});

    await flip(tester, find.byType(Switch).first);
    expect(device.windows, {ReminderSlot.evening});
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
