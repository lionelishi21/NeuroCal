import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/screens/cook_this.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:neurocal/widgets/toast.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'supplement_test.dart' show FakePicker;

Future<MockNeuroCalApi> _pump(WidgetTester tester, String photo, {required void Function(CookThisRecipe) onLog}) async {
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
        home: CookThisScreen(picker: FakePicker(photo), onLog: (r) async => onLog(r)),
      ),
    ),
  );
  await tester.tap(find.text('Choose a photo'));
  await tester.pumpAndSettle();
  return api;
}

Future<void> _tapCentered(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
}

void main() {
  testWidgets('a dish photo becomes a recipe: swaps, the pantry, the shopping list and a serving to log', (
    tester,
  ) async {
    CookThisRecipe? logged;
    final api = await _pump(tester, 'dinner.jpg', onLog: (r) => logged = r);

    expect(find.text('From your photo: Salmon with rice and greens'), findsOneWidget);
    expect(find.text('Lemon salmon with quinoa and spinach'), findsOneWidget);
    expect(find.text('540 kcal'), findsOneWidget);
    expect(find.textContaining('Quinoa instead of white rice'), findsOneWidget);
    // Spinach and lemons are in the sample pantry.
    expect(find.text('In your pantry'), findsNWidgets(2));
    expect(find.text('5 to buy'), findsOneWidget);

    await _tapCentered(tester, find.text('Add 5 to shopping list'));
    await tester.pumpAndSettle();
    expect(find.text('Added 5 items to your shopping list'), findsOneWidget);
    expect(find.text('Added to your shopping list'), findsOneWidget);
    final list = await tester.runAsync(api.shoppingList);
    expect(list!.items.map((i) => i.name), containsAll(['Salmon fillets', 'Quinoa', 'Garlic']));
    expect(list.items.map((i) => i.name), isNot(contains('Spinach')));

    await _tapCentered(tester, find.text('Log a serving'));
    await tester.pumpAndSettle();
    expect(logged?.toItem().calories, 540);
  });

  testWidgets('a photo that can’t be made out says why and offers the photo buttons again', (tester) async {
    await _pump(tester, 'dark-dinner.jpg', onLog: (_) {});
    expect(find.textContaining('That photo is too dark.', findRichText: true), findsOneWidget);
    expect(find.text('Take a photo'), findsOneWidget);
  });
}
