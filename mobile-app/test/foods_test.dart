import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/screens/foods.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:neurocal/widgets/sheet.dart';
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
      billing: MockBilling(active: true),
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

  testWidgets('eating out: pick a chain, open an item, switch to the better pick and log it with the chain name', (tester) async {
    final logged = await pumpFoods(tester);
    // Browsing stays on whole foods: chain items only show for Eating out or a search.
    expect(find.text('Big Mac'), findsNothing);

    await tester.tap(find.text('Eating out'));
    await tester.pumpAndSettle();
    expect(find.text('Almonds'), findsNothing);
    await tester.tap(find.widgetWithText(ChoicePill, 'KFC'));
    await tester.pumpAndSettle();
    expect(find.text('Original Recipe breast'), findsOneWidget);
    expect(find.text('Big Mac'), findsNothing);

    await tester.ensureVisible(find.text('Original Recipe breast'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Original Recipe breast'));
    await tester.pumpAndSettle();
    expect(find.text('KFC Original Recipe breast'), findsOneWidget);
    expect(find.text('404'), findsOneWidget);
    await tester.ensureVisible(find.text('Better pick here'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Better pick here'));
    await tester.pumpAndSettle();
    expect(find.text('KFC Original Recipe breast, skin and breading taken off'), findsOneWidget);
    expect(find.text('171'), findsOneWidget);
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Log it'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Log it'));
    await tester.pumpAndSettle();

    expect(logged.single.food.id, 'kfc-original-breast-skinless');
    expect(logged.single.food.toItem().name, 'KFC Original Recipe breast, skin and breading taken off');
  });

  testWidgets('a search finds chain items by place or dish', (tester) async {
    await pumpFoods(tester);
    await tester.enterText(find.byType(TextField), 'big mac');
    await tester.pumpAndSettle();
    expect(find.text('Big Mac'), findsOneWidget);
    expect(find.text("McDonald's · 563 kcal"), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'wendy');
    await tester.pumpAndSettle();
    expect(find.text('Dave\'s Single'), findsOneWidget);
  });

  testWidgets('Log a meal can add a food from the catalog', (tester) async {
    await pumpApp(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'sam@example.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'correct-horse');
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();

    await tester.tap(find.bySemanticsLabel('Add'));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: find.byType(BottomSheet), matching: find.text('Log a meal')));
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
