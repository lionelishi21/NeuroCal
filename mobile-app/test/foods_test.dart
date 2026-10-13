import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/screens/foods.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_test.dart' show pumpApp;

Future<List<PickedFood>> pumpFoods(WidgetTester tester) async {
  tester.view.physicalSize = const Size(360, 740);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({});
  final logged = <PickedFood>[];
  await tester.pumpWidget(
    AppScope(
      api: MockNeuroCalApi()..latency = Duration.zero,
      auth: MockAuthClient(),
      theme: ThemeController(await SharedPreferences.getInstance()),
      timeZone: () async => 'Europe/London',
      openLink: (_) async => true,
      child: MaterialApp(theme: buildTheme(Brightness.light), home: FoodsScreen(onLog: logged.add)),
    ),
  );
  await tester.pumpAndSettle();
  return logged;
}

void main() {
  testWidgets('browse: search, filter by goal, then log a food with its servings', (tester) async {
    final logged = await pumpFoods(tester);
    expect(find.text('Almonds'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'salm');
    await tester.pumpAndSettle();
    expect(find.text('Salmon'), findsOneWidget);
    expect(find.text('Almonds'), findsNothing);

    await tester.enterText(find.byType(TextField), '');
    await tester.tap(find.text('Sleep'));
    await tester.pumpAndSettle();
    expect(find.text('Kiwi'), findsOneWidget);
    expect(find.text('Salmon'), findsNothing);
    await tester.tap(find.text('All'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'salmon');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Salmon'));
    await tester.pumpAndSettle();
    expect(find.textContaining('omega-3'), findsOneWidget);
    expect(find.text('247'), findsOneWidget); // kcal for one fillet
    await tester.ensureVisible(find.text('2'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('2'));
    await tester.pumpAndSettle();
    expect(find.text('494'), findsOneWidget);
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Log it'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Log it'));
    await tester.pumpAndSettle();

    expect(logged.single.food.id, 'salmon');
    expect(logged.single.servings, 2);
    final item = logged.single.food.toItem(logged.single.servings);
    expect(item.portion, '2 × 1 fillet (120 g)');
    expect(item.macros.proteinG, 53);
  });

  testWidgets('Log a meal can add a food from the catalog', (tester) async {
    await pumpApp(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'sam@example.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'correct-horse');
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, 'Log a meal'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Search foods'));
    await tester.pumpAndSettle();
    expect(find.text('Add a food'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'blueb');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Blueberries'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Add to meal'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Add to meal'));
    await tester.pumpAndSettle();

    expect(find.text('Add a food'), findsNothing);
    expect(find.text('Blueberries'), findsOneWidget);
    expect(find.textContaining('1 cup (148 g)'), findsWidgets);
  });
}
