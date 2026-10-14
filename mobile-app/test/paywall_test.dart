import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/main.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('after sign-in a locked account sees its plan and the trial, and starting it opens the app', (tester) async {
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({});
    final billing = MockBilling();
    await tester.pumpWidget(
      NeuroCalApp(
        api: MockNeuroCalApi()..latency = Duration.zero,
        auth: MockAuthClient(),
        theme: ThemeController(await SharedPreferences.getInstance()),
        billing: billing,
        openLink: (_) async => true,
      ),
    );
    await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'sam@example.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'correct-horse');
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();

    expect(find.text('Your plan is ready, Sam'), findsOneWidget);
    expect(find.textContaining('2,200 kcal a day'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Start my 14-day free trial'), 200);
    expect(find.textContaining('Your trial ends and you’re charged \$59.99'), findsOneWidget);
    expect(find.textContaining('We email you a reminder, with how to cancel.'), findsOneWidget);
    // The small print sits under the button; the list builds it once scrolled into view.
    await tester.scrollUntilVisible(find.textContaining('Free for 14 days, then \$59.99 a year.'), 200);
    expect(find.textContaining('including during the trial at no charge'), findsOneWidget);

    // Monthly has no trial, so the button says what it costs.
    await tester.scrollUntilVisible(find.text('Monthly'), -200);
    await tester.tap(find.text('Monthly'));
    await tester.pumpAndSettle();
    expect(find.text('Subscribe for \$8.00 a month'), findsOneWidget);
    expect(find.textContaining('Your trial ends'), findsNothing);

    await tester.tap(find.text('Yearly'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Start my 14-day free trial'), 200);
    await tester.tap(find.text('Start my 14-day free trial'));
    await tester.pumpAndSettle();
    expect(billing.active, isTrue);
    expect(find.text('Focus Score'), findsOneWidget);
  });
}
