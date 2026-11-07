import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/screens/stack.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:neurocal/widgets/toast.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('a session is logged from the Stack, says what to expect, and is tested against days without', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({});
    final api = MockNeuroCalApi()..latency = Duration.zero;
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
          home: const StackScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final log = find.widgetWithText(OutlinedButton, 'Log a session');
    await tester.scrollUntilVisible(log, 200);
    await tester.tap(log);
    await tester.pumpAndSettle();
    expect(find.text('Pick a session'), findsOneWidget);

    await tester.tap(find.text('Sauna'));
    await tester.pumpAndSettle();
    expect(find.text('For sleep'), findsOneWidget);
    expect(find.textContaining('sleep more deeply the night after'), findsOneWidget);
    expect(find.text('20 min'), findsOneWidget);
    await tester.ensureVisible(find.text('Log session'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Log session'));
    await tester.pumpAndSettle();
    expect(find.text('Session logged'), findsOneWidget);
    expect(find.textContaining(' · Sauna · 20 min'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('1 session in 8 weeks'), 200);
    expect(find.text('A few more days of data to tell'), findsOneWidget);
  });

  testWidgets('Quantum Upgrade is started for a month, shown as running, and stopped', (tester) async {
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({});
    final api = MockNeuroCalApi()..latency = Duration.zero;
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
          home: const StackScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final log = find.widgetWithText(OutlinedButton, 'Log a session');
    await tester.scrollUntilVisible(log, 200);
    await tester.tap(log);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Quantum Upgrade'));
    await tester.pumpAndSettle();
    expect(find.text('No independent studies'), findsOneWidget);
    // A period, not a sitting: a start and how long it runs, no minutes.
    expect(find.text('30 min'), findsNothing);
    expect(find.text('Started'), findsOneWidget);
    expect(find.text('1 month'), findsOneWidget);
    expect(find.text('Ongoing'), findsOneWidget);

    final start = find.text('Start Quantum Upgrade');
    await tester.ensureVisible(start);
    await tester.pumpAndSettle();
    await tester.tap(start);
    await tester.pumpAndSettle();
    expect(find.text('Quantum Upgrade started'), findsOneWidget);
    expect(find.text('Running'), findsOneWidget);
    expect(find.textContaining(RegExp(r'^Since \d+ \w+ · until \d+ \w+$')), findsWidgets);

    // Starting it again over the same dates is refused, with the reason.
    await tester.ensureVisible(start);
    await tester.tap(start);
    await tester.pumpAndSettle();
    expect(find.textContaining('Those dates overlap'), findsOneWidget);

    final stop = find.widgetWithText(TextButton, 'Stop');
    await tester.ensureVisible(stop);
    await tester.pumpAndSettle();
    await tester.tap(stop);
    await tester.pumpAndSettle();
    expect(find.text('Quantum Upgrade stopped'), findsOneWidget);
    expect(find.text('Running'), findsNothing);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('1 day with it lately'), 200);
  });
}
