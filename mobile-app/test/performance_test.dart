import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/screens/performance.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:neurocal/widgets/toast.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  Future<void> pump(WidgetTester tester, MockNeuroCalApi api) async {
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({});
    final view = (await tester.runAsync(api.performance))!;
    await tester.pumpWidget(
      AppScope(
        api: api,
        auth: MockAuthClient(),
        theme: ThemeController(await SharedPreferences.getInstance()),
        timeZone: () async => 'Europe/London',
        openLink: (_) async => true,
        billing: MockBilling(active: true),
        child: MaterialApp(
          theme: buildTheme(Brightness.light),
          builder: (context, child) => ToastHost(child: child!),
          home: Scaffold(
            body: Builder(
              builder: (context) => SingleChildScrollView(
                child: PerformanceSection(
                  view,
                  onLog: (a) => showPerformanceSheet(context, initial: a, onChanged: () {}),
                  onRetry: () {},
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('asks what you want to be sharp for, and logs a gaming session with its results', (tester) async {
    final api = MockNeuroCalApi()..latency = Duration.zero;
    await pump(tester, api);
    expect(find.text('What do you want to be sharp for?'), findsOneWidget);

    await tester.tap(find.text('Gaming'));
    await tester.pumpAndSettle();
    // Gaming is picked, at its usual length; the button waits for a rating.
    expect(find.widgetWithText(TextField, 'Wins'), findsOneWidget);
    expect(find.text('Rate how sharp you felt'), findsOneWidget);

    await tester.ensureVisible(find.text('4 · Sharp'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('4 · Sharp'));
    await tester.enterText(find.widgetWithText(TextField, 'Game (optional)'), 'Street Fighter 6');
    await tester.enterText(find.widgetWithText(TextField, 'Wins'), '7');
    await tester.enterText(find.widgetWithText(TextField, 'Losses'), '3');
    await tester.pumpAndSettle();
    final log = find.text('Log performance').last;
    await tester.ensureVisible(log);
    await tester.pumpAndSettle();
    await tester.tap(log);
    await tester.pumpAndSettle();
    expect(find.text('Performance logged'), findsOneWidget);
    expect(find.textContaining('Gaming · 4/5'), findsOneWidget);

    final saved = (await tester.runAsync(api.performance))!;
    expect(saved.recent.single, isA<PerformanceSession>());
    expect(
      (saved.recent.single.game, saved.recent.single.wins, saved.recent.single.minutes),
      ('Street Fighter 6', 7, 90),
    );
  });

  testWidgets('shows each activity with what goes with its best sessions, or how many more it needs', (tester) async {
    final api = MockNeuroCalApi()..latency = Duration.zero;
    await tester.runAsync(() async {
      for (var i = 0; i < 6; i++) {
        await api.logPerformance(activity: Activity.deepWork, minutes: 90, sharpness: 4, result: 3 + i);
      }
      await api.logPerformance(activity: Activity.study, minutes: 60, sharpness: 3);
    });
    await pump(tester, api);
    expect(find.text('Deep work'), findsOneWidget);
    expect(find.textContaining('6 sessions · sharpness 4.0/5 · best 8 tasks finished'), findsOneWidget);
    expect(find.textContaining("after a good night's sleep"), findsOneWidget);
    expect(find.text('Log 5 more sessions and NeuroCal can show what goes with your best ones.'), findsOneWidget);
  });
}
