import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/analytics/analytics.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/screens/first_meal.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:neurocal/widgets/toast.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'supplement_test.dart' show FakePicker;

Future<(MockNeuroCalApi, FakeAnalytics, List<bool>)> pumpFirstMeal(WidgetTester tester, String photo) async {
  tester.view.physicalSize = const Size(360, 740);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({});
  final api = MockNeuroCalApi()..latency = Duration.zero;
  final analytics = FakeAnalytics();
  final done = <bool>[];
  await tester.pumpWidget(
    AppScope(
      api: api,
      auth: MockAuthClient(),
      theme: ThemeController(await SharedPreferences.getInstance()),
      timeZone: () async => 'Europe/London',
      openLink: (_) async => true,
      billing: MockBilling(active: true),
      analytics: analytics,
      child: MaterialApp(
        theme: buildTheme(Brightness.light),
        builder: (context, child) => ToastHost(child: child!),
        home: FirstMealScreen(picker: FakePicker(photo), onDone: () => done.add(true)),
      ),
    ),
  );
  return (api, analytics, done);
}

void main() {
  testWidgets('a snapped meal is read, then logging it finishes onboarding', (tester) async {
    final (api, analytics, done) = await pumpFirstMeal(tester, 'lunch.jpg');
    // The mock's latency runs on the real clock, outside the test's fake one.
    final before = (await tester.runAsync(() => api.meals(DateTime.now())))!.length;
    await tester.tap(find.text('Take a photo'));
    await tester.pumpAndSettle();
    expect(find.text('Here’s your meal'), findsOneWidget);
    expect(find.textContaining('kcal'), findsWidgets);

    await tester.tap(find.text('Log it'));
    await tester.pumpAndSettle();
    expect(done, [true]);
    expect((await tester.runAsync(() => api.meals(DateTime.now())))!.length, before + 1);
    expect(analytics.names, containsAll(['first_meal_read', 'logged']));
  });

  testWidgets('a photo that can’t be read says how to retake it, and skipping still goes on', (tester) async {
    final (_, _, done) = await pumpFirstMeal(tester, 'dark.jpg');
    await tester.tap(find.text('Choose a photo'));
    await tester.pumpAndSettle();
    expect(find.textContaining('hard to read'), findsOneWidget);
    await tester.tap(find.text('Skip for now'));
    await tester.pumpAndSettle();
    expect(done, [true]);
  });
}
