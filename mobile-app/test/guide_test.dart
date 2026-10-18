import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/analytics/analytics.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/reminders/reminders.dart';
import 'package:neurocal/screens/guide.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<(FakeReminders, FakeAnalytics)> pumpGuide(WidgetTester tester, {bool allowed = true}) async {
  tester.view.physicalSize = const Size(360, 740);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final device = FakeReminders(allowed: allowed);
  final analytics = FakeAnalytics();
  await tester.pumpWidget(
    AppScope(
      api: MockNeuroCalApi()..latency = Duration.zero,
      auth: MockAuthClient(),
      theme: ThemeController(prefs),
      timeZone: () async => 'Europe/London',
      openLink: (_) async => true,
      billing: MockBilling(active: true),
      reminders: ReminderSettings(prefs, device),
      analytics: analytics,
      child: MaterialApp(theme: buildTheme(Brightness.light), home: const GuideScreen(offerReminders: true)),
    ),
  );
  for (var i = 0; i < 3; i++) {
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
  }
  return (device, analytics);
}

void main() {
  testWidgets('the first guide ends by turning on all three check-in reminders', (tester) async {
    final (device, analytics) = await pumpGuide(tester);
    expect(find.text('Where things are'), findsOneWidget);
    await tester.tap(find.text('Turn on reminders and start'));
    await tester.pumpAndSettle();
    expect(device.windows, ReminderSlot.values.toSet());
    expect(analytics.names, contains('reminders_on'));
  });

  testWidgets('refusing notifications still starts the day, and says nothing was turned on', (tester) async {
    final (device, analytics) = await pumpGuide(tester, allowed: false);
    await tester.tap(find.text('Turn on reminders and start'));
    await tester.pumpAndSettle();
    expect(device.scheduled, isEmpty);
    expect(analytics.names, contains('reminders_refused'));
  });
}
