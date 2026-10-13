import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/screens/weight_cards.dart';
import 'package:neurocal/screens/weight_sheets.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:neurocal/weight_units.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<MockNeuroCalApi> pumpWith(WidgetTester tester, Widget Function(BuildContext) body) async {
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
      child: MaterialApp(theme: buildTheme(Brightness.light), home: Scaffold(body: Builder(builder: body))),
    ),
  );
  return api;
}

void main() {
  test('pounds and kilos convert both ways', () {
    expect(WeightUnit.lb.format(100), '220.5 lb');
    expect(WeightUnit.lb.toKg(220.462), closeTo(100, 0.001));
    expect(WeightUnit.kg.format(92.44), '92.4 kg');
  });

  testWidgets('the goal sheet checks the numbers and the safety answer, then saves and logs today', (tester) async {
    final api = await pumpWith(
      tester,
      (context) => TextButton(onPressed: () => showWeightGoalSheet(context, unit: WeightUnit.kg), child: const Text('Open')),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    await tester.enterText(find.widgetWithText(TextField, 'Weight now'), '95');
    await tester.enterText(find.widgetWithText(TextField, 'Target'), '97');
    await tester.ensureVisible(find.text('Save goal'));
    await tester.tap(find.text('Save goal'));
    await tester.pumpAndSettle();
    expect(find.textContaining('below your weight now'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextField, 'Target'), '85');
    await tester.ensureVisible(find.text('Save goal'));
    await tester.tap(find.text('Save goal'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Answer the health question'), findsOneWidget);

    await tester.ensureVisible(find.text('Yes'));
    await tester.tap(find.text('Yes'));
    await tester.pumpAndSettle();
    expect(find.textContaining('cap fasting at 12 hours'), findsOneWidget);
    await tester.ensureVisible(find.text('Save goal'));
    await tester.tap(find.text('Save goal'));
    await tester.pumpAndSettle();

    // The mock waits on a timer, which only runs outside the test's fake clock.
    final profile = (await tester.runAsync(api.me))!;
    expect(profile.weightGoal!.targetKg, 85);
    expect(profile.weightGoal!.fastingCaution, isTrue);
    expect((await tester.runAsync(api.weights))!.entries.single.kg, 95);
  });

  testWidgets('the weight card shows the trend, what is left and the weekly change', (tester) async {
    await pumpWith(
      tester,
      (_) => SingleChildScrollView(
        child: WeightCard(
          WeightHistory(
            entries: [for (var i = 0; i < 8; i++) (date: '2026-10-0${i + 1}', kg: 95 - i * 0.1)],
            trendKg: 94.6,
            weeklyChangeKg: -0.6,
            targetKg: 85,
            toGoKg: 9.6,
            plannedWeeklyLossKg: 0.71,
            projectedOn: '2027-01-20',
          ),
          unit: WeightUnit.kg,
          onLog: () {},
          onGoal: () {},
        ),
      ),
    );
    expect(find.text('94.6 kg'), findsOneWidget);
    expect(find.text('9.6 kg to go to 85.0 kg'), findsOneWidget);
    expect(find.textContaining('0.6 kg down this week.'), findsOneWidget);
    expect(find.textContaining('around 20 Jan'), findsOneWidget);
  });

  testWidgets('the fasting card times the fast against its goal', (tester) async {
    final now = DateTime.now();
    await pumpWith(
      tester,
      (_) => FastingCard(
        FastingStatus(
          protocol: '16_8',
          fastHours: 16,
          kind: FastingKind.fasting,
          since: now.subtract(const Duration(hours: 13, minutes: 20)),
          goalAt: now.add(const Duration(hours: 2, minutes: 40)),
          streakDays: 1,
        ),
        onBoundary: () {},
      ),
    );
    expect(find.text('16:8 fast'), findsOneWidget);
    expect(find.text('Fasting · 13 h 20 m'), findsOneWidget);
    expect(find.textContaining(RegExp(r'Goal 16 h at \d\d:\d\d\. 2 h (39|40) m to go')), findsOneWidget);
    expect(find.textContaining('habit hunger'), findsOneWidget);
  });

  test('a catalog food keeps its processing level when it becomes a meal item', () {
    const bread = CatalogFood(
      id: 'sourdough',
      name: 'Sourdough bread',
      category: 'grains',
      serving: '1 large slice (64 g)',
      grams: 64,
      calories: 174,
      macros: Macros(proteinG: 7, carbsG: 33, fatG: 1.5),
      fiberG: 1.5,
      glycemicLoad: GlycemicLoad.medium,
      processing: FoodProcessing.processed,
      why: 'Long fermentation.',
    );
    expect(bread.toItem().processing, FoodProcessing.processed);
    expect(bread.toItem().toJson()['processing'], 'processed');
    expect(FoodItem.fromJson({...bread.toItem().toJson(), 'processing': 'ultra_processed'}).processing, FoodProcessing.ultraProcessed);
  });
}
