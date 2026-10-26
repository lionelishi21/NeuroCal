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
}
