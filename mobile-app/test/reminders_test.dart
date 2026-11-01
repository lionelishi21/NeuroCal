import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/main.dart';
import 'package:neurocal/push/push.dart';
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

  Future<FakeReminders> pumpSignedIn(
    WidgetTester tester, {
    bool allowed = true,
    MockNeuroCalApi? api,
    FakePush? push,
  }) async {
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final device = FakeReminders(allowed: allowed);
    await tester.pumpWidget(
      NeuroCalApp(
        api: api ?? (MockNeuroCalApi()..latency = Duration.zero),
        auth: MockAuthClient(),
        theme: ThemeController(prefs),
        reminders: ReminderSettings(prefs, device),
        push: push,
      ),
    );
    await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'sam@example.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'correct-horse');
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();
    return device;
  }

  /// Me → Notifications.
  Future<void> openMe(WidgetTester tester) async {
    await tester.tap(find.bySemanticsLabel('Me'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Reminders and email'), 200);
    await tester.tap(find.text('Reminders and email'));
    await tester.pumpAndSettle();
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

    // The third switch: morning, afternoon, evening come first.
    await flip(tester, find.byType(Switch).at(2));
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
    await tester.tap(find.bySemanticsLabel('Me'));
    await tester.pumpAndSettle();

    device.tap();
    await tester.pumpAndSettle();
    expect(find.text('Save check-in'), findsOneWidget);
  });

  testWidgets('the weekly nudge is set for Monday morning, and tapping it opens the report', (tester) async {
    final device = await pumpSignedIn(tester);
    final weekly = device.oneOffs[nudgeIdOf(NudgeKind.weekly)]!;
    expect(weekly.at.weekday, DateTime.monday);
    expect(weekly.at.hour, 8);
    expect(weekly.at.isAfter(DateTime.now()), isTrue);
    expect(weekly.payload, weeklyPayload);
    expect(weekly.title, 'Your weekly report is ready');

    expect(find.text('Weekly report'), findsNothing);
    device.tapWeek();
    await tester.pumpAndSettle();
    expect(find.text('Weekly report'), findsOneWidget);
    expect(find.text('Focus Score 70, up 6'), findsOneWidget);
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
    final id = nudgeIdOf(NudgeKind.streak);
    expect(device.oneOffs[id]?.at, DateTime(2026, 10, 17, 20));
    expect(device.oneOffs[id]?.title, 'Keep your 4-day streak');
    // Check-in nudges being rescheduled leaves it alone.
    await settings.restore();
    expect(device.oneOffs, contains(id));

    await settings.streak(days: 5, todayDone: true);
    expect(device.oneOffs, isEmpty);
    now = DateTime(2026, 10, 17, 21);
    await settings.streak(days: 4, todayDone: false);
    expect(device.oneOffs, isEmpty);
  });

  group('other reminders', () {
    final now = DateTime(2026, 10, 19, 10); // a Monday

    test('brain speed checks come at the time of the latest one, and not twice today', () {
      final n = brainCheckNudges(now: now, wakeHour: 7, checks: [DateTime(2026, 10, 18, 9, 15)]);
      expect(
        [for (final x in n) x.at],
        [DateTime(2026, 10, 19, 9, 15).add(const Duration(days: 1)), DateTime(2026, 10, 21, 9, 15)],
      );
      expect(n.first.at.hour, 9);
      // Not checked today, and 09:15 is past: tomorrow and the day after.
      final done = brainCheckNudges(
        now: DateTime(2026, 10, 19, 8),
        wakeHour: 7,
        checks: [DateTime(2026, 10, 19, 7, 50)],
      );
      expect(done.every((x) => x.at.day != 19), isTrue);
      expect(
        brainCheckNudges(now: DateTime(2026, 10, 19, 6), wakeHour: 7, checks: const []).first.at,
        DateTime(2026, 10, 19, 8, 30),
      );
    });

    test('water nudges today only when well behind, and the fast nudge comes when it ends', () {
      expect(
        waterNudges(now: now, ml: 500, targetMl: 2400).first.body,
        'You’re at 500 of 2400 ml. A glass now keeps your focus up this afternoon.',
      );
      expect(waterNudges(now: now, ml: 1500, targetMl: 2400).every((x) => x.at.day != 19), isTrue);
      expect(fastNudges(now: now, endsAt: DateTime(2026, 10, 19, 12)).single.at, DateTime(2026, 10, 19, 12));
      expect(fastNudges(now: now, endsAt: DateTime(2026, 10, 19, 9)), isEmpty);
    });

    test('two weeks into a supplement, the evening before a plan ends, and a week after a weigh-in', () {
      expect(
        supplementCheckNudges(
          now: now,
          wakeHour: 7,
          items: [(name: 'Magnesium', startedOn: '2026-10-10', ours: false)],
        ).single,
        (
          at: DateTime(2026, 10, 24, 10),
          title: 'Is Magnesium working?',
          body: 'You’ve taken it for two weeks. Notice any change in focus, sleep or energy? Your Brain speed checks show it too.',
        ),
      );
      expect(
        supplementCheckNudges(
          now: now,
          wakeHour: 7,
          items: [(name: 'MitoProof Sleep Formula', startedOn: '2026-10-10', ours: true)],
        ).single.body,
        'You’ve taken it for two weeks. Notice any change in focus, sleep or energy? Your Stack shows how it’s going, and reorders it from MitoProof.',
      );
      expect(
        runningLowNudges(
          now: now,
          wakeHour: 7,
          items: [
            (name: 'Magnesium', daysLeft: 12, ours: false),
            (name: 'MitoProof Sleep Formula', daysLeft: 6, ours: true),
            (name: 'Creatine', daysLeft: 3, ours: false),
            (name: 'Fish oil', daysLeft: null, ours: false),
          ],
        ),
        [
          (
            at: DateTime(2026, 10, 26, 10),
            title: 'Magnesium runs out in 5 days',
            body: 'Restock now so you don’t miss a day: gaps make it hard to tell if it works.',
          ),
          (
            at: DateTime(2026, 10, 20, 10),
            title: 'MitoProof Sleep Formula runs out in 5 days',
            body: 'Reorder it from MitoProof in your Stack so you don’t miss a day.',
          ),
        ],
      );
      expect(
        mealPlanNudges(now: now, createdAt: DateTime(2026, 10, 19, 9), days: 3).single.at,
        DateTime(2026, 10, 20, 19),
      );
      expect(mealPlanNudges(now: now, createdAt: DateTime(2026, 10, 19, 9), days: 1), isEmpty);
      expect(weighInNudges(now: now, wakeHour: 7, lastWeighIn: '2026-10-15').single.at, DateTime(2026, 10, 22, 7, 30));
      // Already due and this morning's time has passed: tomorrow.
      expect(weighInNudges(now: now, wakeHour: 7, lastWeighIn: '2026-10-01').single.at, DateTime(2026, 10, 20, 7, 30));
    });

    test('quiet hours run from bedtime to waking, and at most four a day, the most useful first', () {
      expect(inQuietHours(DateTime(2026, 10, 19, 22, 30), 7), isTrue);
      expect(inQuietHours(DateTime(2026, 10, 19, 6, 59), 7), isTrue);
      expect(inQuietHours(DateTime(2026, 10, 19, 21, 59), 7), isFalse);
      Planned at(int h) => (at: DateTime(2026, 10, 19, h), title: '$h', body: '');
      final picked = pickNudges(
        plans: {
          NudgeKind.morningLight: [at(11)],
          NudgeKind.water: [at(15)],
          NudgeKind.brainCheck: [at(12)],
          NudgeKind.windDown: [at(21)],
          NudgeKind.streak: [at(20)],
          NudgeKind.movement: [at(17), at(23)],
          NudgeKind.fastDone: [at(23)],
        },
        on: NudgeKind.values.toSet(),
        quiet: true,
        wakeHour: 7,
        now: now,
      );
      // Movement's 23:00 is in quiet hours; the fast isn't held back by them or by the limit.
      expect(
        [for (final p in picked) p.kind],
        [NudgeKind.fastDone, NudgeKind.streak, NudgeKind.brainCheck, NudgeKind.windDown, NudgeKind.water],
      );
    });

    test('switching a kind off cancels it, and plans survive a restart', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final device = FakeReminders();
      final settings = ReminderSettings(prefs, device, now: () => now);
      await settings.plan({NudgeKind.water: waterNudges(now: now, ml: 0, targetMl: 2000)});
      expect(device.oneOffs.keys, [
        nudgeIdOf(NudgeKind.water),
        nudgeIdOf(NudgeKind.water, 1),
        nudgeIdOf(NudgeKind.water, 2),
      ]);
      // Off by default until switched on.
      expect(settings.isOn(NudgeKind.morningLight), isFalse);

      await settings.setKind(NudgeKind.water, false);
      expect(device.oneOffs, isEmpty);
      final again = ReminderSettings(prefs, device, now: () => now);
      await again.setKind(NudgeKind.water, true);
      expect(device.oneOffs, hasLength(3));
    });
  });

  group('server notifications', () {
    testWidgets('signing in saves this phone for push, and signing out drops it', (tester) async {
      final push = FakePush();
      await pumpSignedIn(tester, push: push);
      expect(push.registered, hasLength(1));
      expect(push.unregistered, 0);

      final scope = AppScope.of(tester.element(find.byType(Scaffold).first));
      await scope.auth.signOut();
      await tester.pumpAndSettle();
      expect(push.unregistered, 1);
    });

    testWidgets('each server notification and email has a switch, saved to the server', (tester) async {
      final api = MockNeuroCalApi()..latency = Duration.zero;
      await pumpSignedIn(tester, api: api);
      await openMe(tester);

      await tester.scrollUntilVisible(find.text('Unhealthy air'), 200);
      expect(find.text('From NeuroCal'), findsOneWidget);
      final air = find.descendant(
        of: find.ancestor(of: find.text('Unhealthy air'), matching: find.byType(Row)).first,
        matching: find.byType(Switch),
      );
      expect(tester.widget<Switch>(air).value, isTrue);
      await flip(tester, air);
      final saved = (await tester.runAsync(api.notificationSettings))!;
      expect(saved.isOn(PushKind.airQuality), isFalse);
      expect(saved.isOn(PushKind.focusScore), isTrue);

      await tester.scrollUntilVisible(find.text('After a week away'), 200);
      final away = find.descendant(
        of: find.ancestor(of: find.text('After a week away'), matching: find.byType(Row)).first,
        matching: find.byType(Switch),
      );
      await flip(tester, away);
      expect((await tester.runAsync(api.notificationSettings))!.comeBackEmail, isFalse);
    });

    test(
      'settings read every kind as on unless the server says off (product news: off unless on), and send each back',
      () {
        final s = NotificationSettings.fromJson({
          'weeklyReport': true,
          'comeBackEmail': false,
          'push': {'airQuality': false},
        });
        expect(s.isOn(PushKind.airQuality), isFalse);
        expect(s.isOn(PushKind.levelUp), isTrue);
        expect(s.isOn(PushKind.productNews), isFalse);
        expect(
          NotificationSettings.fromJson({
            'push': {'productNews': true},
          }).isOn(PushKind.productNews),
          isTrue,
        );
        expect(s.toJson()['push'], containsPair('airQuality', false));
        expect(s.toJson()['comeBackEmail'], isFalse);
      },
    );
  });
}
