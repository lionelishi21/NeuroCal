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
}
