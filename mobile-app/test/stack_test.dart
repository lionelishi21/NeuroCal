import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/screens/stack.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:neurocal/widgets/toast.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('the checklist ticks supplements off, shows stack warnings and bottles running low', (tester) async {
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({});
    final api = MockNeuroCalApi()..latency = Duration.zero;
    final multi = (await tester.runAsync(
      () => api.addToStack(
        name: 'Daily Multi',
        ingredients: const [],
        servingsPerDay: 1,
        timing: StackTiming.withFood,
        servingsPerContainer: 5,
      ),
    ))!;
    await tester.runAsync(
      () => api.addToStack(name: 'Magnesium', ingredients: const [], servingsPerDay: 2, timing: StackTiming.evening),
    );
    final stack = SupplementStack(
      items: (await tester.runAsync(api.stack))!.items,
      flags: const [
        (
          kind: 'above_upper_limit',
          message: 'Together your supplements give 65 mg of zinc a day.',
          itemIds: <String>[],
        ),
      ],
    );

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
          home: Scaffold(
            body: SingleChildScrollView(child: StackCard(stack, onManage: () {})),
          ),
        ),
      ),
    );

    expect(find.text('0 of 2 taken'), findsOneWidget);
    expect(find.text('5 days left'), findsOneWidget);
    expect(find.textContaining('65 mg of zinc a day'), findsOneWidget);

    await tester.tap(find.text('Daily Multi'));
    await tester.pump();
    expect(find.text('1 of 2 taken'), findsOneWidget);
    // The save runs on the mock's (fake-clock) delay.
    await tester.pumpAndSettle();
    expect((await tester.runAsync(api.stack))!.items.firstWhere((i) => i.id == multi.id).takenToday, isTrue);
  });

  testWidgets(
    'each supplement runs as an experiment: what to expect, whether it works, and how it feels at two weeks',
    (tester) async {
      tester.view.physicalSize = const Size(360, 740);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      SharedPreferences.setMockInitialValues({});
      final api = MockNeuroCalApi()..latency = Duration.zero;
      final magnesium = (await tester.runAsync(
        () => api.addToStack(
          name: 'Magnesium glycinate',
          ingredients: const [(name: 'Magnesium', amount: 200, unit: 'mg', inBlend: false)],
          servingsPerDay: 1,
          timing: StackTiming.evening,
        ),
      ))!;
      // Two weeks and a bit on it.
      api.stackAddedOn[magnesium.id] = DateTime.now().subtract(const Duration(days: 15));
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

      expect(find.text('Collecting your numbers'), findsOneWidget);
      expect(find.text('2 weeks on Magnesium glycinate: how has it made you feel?'), findsOneWidget);
      await tester.tap(find.text('Better'));
      await tester.pumpAndSettle();
      expect(find.text('Thanks, noted'), findsOneWidget);
      expect(find.textContaining('how has it made you feel?'), findsNothing);

      await tester.tap(find.text('Magnesium glycinate'));
      await tester.pumpAndSettle();
      expect(find.text('Is it working?'), findsOneWidget);
      expect(find.textContaining('There aren’t enough nights of sleep from before you started'), findsOneWidget);
      expect(find.text('You said it makes you feel: better.'), findsOneWidget);
      expect(find.text('What to expect'), findsOneWidget);
      expect(find.text('Some evidence'), findsOneWidget);
      expect(find.text('Sleep · in about 14 days'), findsOneWidget);
    },
  );

  testWidgets('stopping a supplement keeps watching it: did the gain last?', (tester) async {
    tester.view.physicalSize = const Size(360, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({});
    final api = MockNeuroCalApi()..latency = Duration.zero;
    await tester.runAsync(
      () => api.addToStack(
        name: 'Focus blend',
        ingredients: const [(name: 'L-theanine', amount: 200, unit: 'mg', inBlend: false)],
        servingsPerDay: 1,
        timing: StackTiming.morning,
      ),
    );
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
    await tester.tap(find.text('Focus blend'));
    await tester.pumpAndSettle();
    final stop = find.text('I’ve stopped taking it');
    await tester.ensureVisible(stop);
    await tester.pumpAndSettle();
    await tester.tap(stop);
    await tester.pumpAndSettle();

    expect(find.text('Stopped lately'), findsOneWidget);
    expect(find.text('Watching after you stopped · day 1 of 28'), findsOneWidget);
    await tester.tap(find.text('Focus blend'));
    await tester.pumpAndSettle();
    expect(find.textContaining('watching whether your Brain speed holds for four weeks'), findsOneWidget);
  });
}
