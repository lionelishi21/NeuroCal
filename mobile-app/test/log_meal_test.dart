import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/api.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/screens/log_meal_sheet.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'supplement_test.dart' show FakePicker;

/// The API with its photo reader down, as when the model provider is out of credits.
class _ReaderDown extends MockNeuroCalApi {
  @override
  Future<AnalyzeMealResult> analyzeMeal(Uint8List photo, String filename) async => throw ApiException(
    502,
    "The photo couldn't be analyzed right now. Try again in a moment.",
    code: 'upstream_failed',
  );
}

Future<void> _pumpOpen(WidgetTester tester, NeuroCalApi api, Future<void> Function(BuildContext) open) async {
  tester.view.physicalSize = const Size(360, 740);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({});
  final theme = ThemeController(await SharedPreferences.getInstance());
  await tester.pumpWidget(
    AppScope(
      api: api,
      auth: MockAuthClient(),
      theme: theme,
      timeZone: () async => 'Europe/London',
      openLink: (_) async => true,
      billing: MockBilling(active: true),
      child: MaterialApp(
        theme: buildTheme(Brightness.light),
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(onPressed: () => open(context), child: const Text('Open')),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Open'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('a scanned food with no nutrition opens the by-hand form with its name typed in', (tester) async {
    await _pumpOpen(
      tester,
      MockNeuroCalApi()..latency = Duration.zero,
      (context) => showLogMealSheet(context, draftName: 'Nestlé Nestum'),
    );
    expect(find.widgetWithText(TextField, 'Nestlé Nestum'), findsOneWidget);
  });

  testWidgets('when photo reading is down it says so and the meal can still be added by hand', (tester) async {
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({});
    final theme = ThemeController(await SharedPreferences.getInstance());
    await tester.pumpWidget(
      AppScope(
        api: _ReaderDown()..latency = Duration.zero,
        auth: MockAuthClient(),
        theme: theme,
        timeZone: () async => 'Europe/London',
        openLink: (_) async => true,
        billing: MockBilling(active: true),
        child: MaterialApp(
          theme: buildTheme(Brightness.light),
          home: Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () => showLogMealSheet(context, picker: FakePicker('lunch.jpg')),
                child: const Text('Open'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Choose a photo'));
    await tester.pumpAndSettle();

    expect(find.text("Photo reading isn't working right now"), findsOneWidget);
    expect(find.textContaining('Check your connection'), findsNothing);
    expect(find.text('Add an item by hand instead'), findsOneWidget);
  });
}
