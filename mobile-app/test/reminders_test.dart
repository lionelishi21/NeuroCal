import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/api/models.dart';
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
      expect(
        [
          for (final n in nudgesFor(slots: {ReminderSlot.morning}, wakeHour: 7, now: morning9, days: 1)) clock(n.at),
        ],
        ['09:30'],
      );
    });

    test('a window checked in today gets no more nudges today, but does tomorrow', () {
      final nudges = nudgesFor(
        slots: {ReminderSlot.morning},
        wakeHour: 7,
        now: morning9,
        doneToday: {ReminderSlot.morning},
        days: 2,
      );
      expect(nudges.every((n) => n.at.day == 16), isTrue);
      expect(nudges, hasLength(3));
    });

    test('follows the wake time, and stays under the 64 notifications iOS keeps', () {
      expect(ReminderSlot.evening.range(5.5), '18:00–20:30');
      expect(
        nudgesFor(slots: ReminderSlot.values.toSet(), wakeHour: 7, now: DateTime(2026, 10, 15)).length,
        lessThanOrEqualTo(64),
      );
    });
  });

  group('supplements', () {
    StackItem item(String id, String name, StackTiming timing, {bool taken = false}) =>
        StackItem(id: id, name: name, servingsPerDay: 1, timing: timing, startedOn: '2026-10-01', takenToday: taken);

    test('one nudge per time of day, naming what to take; ticked-off times wait for tomorrow', () {
      final nudges = supplementNudgesFor(
        items: [
          (name: 'Magnesium', timing: StackTiming.evening, takenToday: false),
          (name: 'Creatine', timing: StackTiming.morning, takenToday: true),
          (name: 'Vitamin D', timing: StackTiming.any, takenToday: true),
        ],
        wakeHour: 7,
        now: DateTime(2026, 10, 15, 7, 30),
        days: 2,
      );
      expect(
        [for (final n in nudges) '${n.at.day} ${clock(n.at)} ${n.title}'],
        [
          '16 07:45 Morning supplements', // today's morning ones are all ticked
          '15 20:30 Evening supplements',
          '16 20:30 Evening supplements',
        ],
      );
      expect(nudges.first.body, 'Creatine and Vitamin D. Tick them off in your Stack.');
    });

    test('asks once, schedules with a tap that opens the Stack, and each supplement can be switched off', () async {
      SharedPreferences.setMockInitialValues({});
      final device = FakeReminders();
      final settings = ReminderSettings(
        await SharedPreferences.getInstance(),
        device,
        now: () => DateTime(2026, 10, 15, 7),
      );
      final items = [item('a', 'Magnesium', StackTiming.evening), item('b', 'Creatine', StackTiming.morning)];
      await settings.supplements(items);
      expect(device.oneOffs.values.map((n) => n.title).toSet(), {'Morning supplements', 'Evening supplements'});
      expect(device.oneOffs.values.every((n) => n.payload == stackPayload), isTrue);

      await settings.setSupplementReminder('a', false);
      expect(settings.remindsAbout('a'), isFalse);
      expect(device.oneOffs.values.map((n) => n.title).toSet(), {'Morning supplements'});

      await settings.clear();
      expect(device.oneOffs.keys.where((id) => id >= supplementNudgeIds), isEmpty);
    });

    test('no permission, no nudges', () async {
      SharedPreferences.setMockInitialValues({});
      final device = FakeReminders(allowed: false);
      final settings = ReminderSettings(
        await SharedPreferences.getInstance(),
        device,
        now: () => DateTime(2026, 10, 15, 7),
      );
      await settings.supplements([item('a', 'Magnesium', StackTiming.evening)]);
      expect(device.oneOffs, isEmpty);
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

  testWidgets('the weekly nudge is set for Sunday evening, and tapping it opens the week', (tester) async {
    final device = await pumpSignedIn(tester);
    final weekly = device.oneOffs[weeklyNudgeId]!;
    expect(weekly.at.weekday, DateTime.sunday);
    expect(weekly.at.hour, 18);
    expect(weekly.at.isAfter(DateTime.now()), isTrue);
    expect(weekly.payload, weeklyPayload);

    expect(find.text('This week'), findsNothing);
    device.tapWeek();
    await tester.pumpAndSettle();
    expect(find.text('This week'), findsWidgets);
  });

  testWidgets('tapping a supplement nudge opens the Stack', (tester) async {
    final device = await pumpSignedIn(tester);
    expect(find.text('Gadgets and practices'), findsNothing);
    device.tapStack();
    await tester.pumpAndSettle();
    expect(find.text('Your stack'), findsOneWidget);
  });

  test('the streak nudge is set for 20:00 while a streak is at risk, and goes once today counts', () async {
    SharedPreferences.setMockInitialValues({});
    final device = FakeReminders();
    var now = DateTime(2026, 10, 17, 10);
    final settings = ReminderSettings(await SharedPreferences.getInstance(), device, now: () => now);

    await settings.streak(days: 4, todayDone: false);
    expect(device.oneOffs[streakNudgeId]?.at, DateTime(2026, 10, 17, 20));
    expect(device.oneOffs[streakNudgeId]?.title, 'Keep your 4-day streak');
    // Check-in nudges being rescheduled leaves it alone.
    await settings.restore();
    expect(device.oneOffs, contains(streakNudgeId));

    await settings.streak(days: 5, todayDone: true);
    expect(device.oneOffs, isEmpty);
    now = DateTime(2026, 10, 17, 21);
    await settings.streak(days: 4, todayDone: false);
    expect(device.oneOffs, isEmpty);
  });
}
