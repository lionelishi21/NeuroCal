import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/health/sleep_sync.dart';
import 'package:neurocal/main.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  final bed = DateTime(2026, 10, 16, 23);
  SleepSegment seg(int fromMin, int toMin, {bool deep = false}) =>
      (start: bed.add(Duration(minutes: fromMin)), end: bed.add(Duration(minutes: toMin)), deep: deep);

  test('pieces less than an hour apart are one night, deep minutes add up, and naps are left out', () {
    final nights = nightsFrom([
      seg(0, 200),
      seg(60, 120, deep: true),
      seg(240, 450), // woke for 40 minutes: still the same night
      seg(300, 330, deep: true),
      seg(900, 960), // a one-hour nap the next afternoon
    ]);
    expect(nights, hasLength(1));
    expect(nights.single.start, bed);
    expect(nights.single.end, bed.add(const Duration(minutes: 450)));
    expect(nights.single.deepMinutes, 90);
  });

  test('sync sends nothing until connected, and nothing when access is refused', () async {
    SharedPreferences.setMockInitialValues({});
    final api = MockNeuroCalApi(sleepLogged: false)..latency = Duration.zero;
    final source = FakeSleepSource(grants: false, segments: [seg(0, 420)]);
    final sync = SleepSync(await SharedPreferences.getInstance(), source);
    expect(await sync.sync(api), 0);
    expect(sync.access, SleepAccess.notConnected);
    expect(await sync.connect(api), isNull);
    expect(api.imported, isEmpty);

    source.grants = true;
    expect(await sync.connect(api), 1);
    expect(api.imported.single.source, 'health_connect');
    await sync.disconnect();
    expect(await sync.sync(api), 0);
  });

  testWidgets('Up next asks to connect sleep; one tap imports last night and moves on', (tester) async {
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final api = MockNeuroCalApi(sleepLogged: false)..latency = Duration.zero;
    final now = DateTime.now();
    final night = (start: now.subtract(const Duration(hours: 9)), end: now.subtract(const Duration(hours: 1, minutes: 30)), deep: false);
    final sync = SleepSync(prefs, FakeSleepSource(segments: [night]));
    await tester.pumpWidget(NeuroCalApp(api: api, auth: MockAuthClient(), theme: ThemeController(prefs), sleepSync: sync));
    await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'sam@example.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'correct-horse');
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();

    expect(find.text('Connect your sleep'), findsOneWidget);
    expect(find.text('Log it by hand'), findsOneWidget);
    // Up next sits under the score, below the fold on this small phone.
    await tester.ensureVisible(find.text('Connect Health Connect'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Connect Health Connect'));
    await tester.pumpAndSettle();

    expect(find.text('Sleep connected. Last night is in'), findsOneWidget);
    expect(api.imported, hasLength(1));
    expect(find.text('Connect your sleep'), findsNothing);
    expect(find.text('Log last night’s sleep'), findsNothing);
  });

  test('heart readings become one per marker per finished day: heart rate averaged, blood pressure the last', () {
    final today = DateTime(2026, 10, 19, 9);
    MarkerSample at(String marker, double value, DateTime t) => (marker: marker, value: value, at: t);
    final days = dailyMarkers([
      at('resting_hr', 60, DateTime(2026, 10, 18, 6)),
      at('resting_hr', 63, DateTime(2026, 10, 18, 22)),
      at('bp_systolic', 128, DateTime(2026, 10, 18, 8)),
      at('bp_systolic', 121, DateTime(2026, 10, 18, 20)),
      at('resting_hr', 59, DateTime(2026, 10, 19, 6)), // today: not finished, left for tomorrow
    ], today);
    expect(days, hasLength(2));
    expect(days.firstWhere((d) => d.marker == 'resting_hr'), (marker: 'resting_hr', value: 61.5, day: DateTime(2026, 10, 18, 12)));
    expect(days.firstWhere((d) => d.marker == 'bp_systolic').value, 121);
  });

  test('sync sends heart readings too, once; a second sync adds nothing new', () async {
    SharedPreferences.setMockInitialValues({'neurocal.sleepSync.on': true});
    final api = MockNeuroCalApi(sleepLogged: false)..latency = Duration.zero;
    final now = DateTime.now();
    final yesterday = now.subtract(const Duration(days: 1));
    final source = FakeSleepSource(markers: [(marker: 'resting_hr', value: 58, at: yesterday)]);
    final sync = SleepSync(await SharedPreferences.getInstance(), source);
    expect(await sync.sync(api), 1);
    expect(await sync.sync(api), 0);
    // In the history next to the sample readings.
    final hr = (await api.markers()).firstWhere((m) => m.marker == 'resting_hr');
    expect(hr.points, contains(58));
  });

  test('glucose: a sensor day is summarised and sent; a day of finger-pricks is not', () async {
    final today = DateTime(2026, 10, 19, 9);
    final yesterday = DateTime(2026, 10, 18);
    final sensor = [for (var i = 0; i < 288; i++) (mgdl: i < 240 ? 100.0 : 160.0, at: yesterday.add(Duration(minutes: 5 * i)))];
    final pricks = [(mgdl: 95.0, at: DateTime(2026, 10, 17, 8)), (mgdl: 130.0, at: DateTime(2026, 10, 17, 13))];
    final days = glucoseDays([...sensor, ...pricks], today, 'health_connect');
    expect(days, hasLength(1));
    expect(days.single.date, '2026-10-18');
    expect(days.single.inRange140Pct, 83);
    expect(days.single.inRange180Pct, 100);
    expect(days.single.readings, 288);

    SharedPreferences.setMockInitialValues({'neurocal.sleepSync.on': true});
    final api = MockNeuroCalApi(sleepLogged: false)..latency = Duration.zero;
    final now = DateTime.now();
    final start = DateTime(now.year, now.month, now.day).subtract(const Duration(days: 1));
    final source = FakeSleepSource(glucose: [for (var i = 0; i < 200; i++) (mgdl: 110.0, at: start.add(Duration(minutes: 5 * i)))]);
    await SleepSync(await SharedPreferences.getInstance(), source).sync(api);
    expect((await api.glucose()).single.inRange140Pct, 100);
    expect((await api.focusScore(now)).glycemicFromSensor, isTrue);
  });
}
