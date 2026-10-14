import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/screens/food_scan_sheet.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'supplement_test.dart' show FakeLabelCamera, back, front, side;

/// Opens the sheet; the logged item, if any, lands in [logged].
Future<List<FoodItem?>> pumpFoodScan(WidgetTester tester, FakeLabelCamera camera) async {
  tester.view.physicalSize = const Size(360, 740);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({});
  final logged = <FoodItem?>[];
  await tester.pumpWidget(
    AppScope(
      api: MockNeuroCalApi()..latency = Duration.zero,
      auth: MockAuthClient(),
      theme: ThemeController(await SharedPreferences.getInstance()),
      timeZone: () async => 'Europe/London',
      openLink: (_) async => true,
      billing: MockBilling(active: true),
      child: MaterialApp(
        theme: buildTheme(Brightness.light),
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () async => logged.add(await showFoodScanSheet(context, camera: () => camera)),
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Open'));
  await tester.pumpAndSettle();
  return logged;
}

Future<void> scanOnce(WidgetTester tester, String button) async {
  await tester.tap(find.text(button));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(milliseconds: 700)); // first frame
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('a known barcode ends the scan at once and the serving can be logged', (tester) async {
    final logged = await pumpFoodScan(tester, FakeLabelCamera([front], barcodes: ['0123456789012']));
    await scanOnce(tester, 'Start scanning');

    expect(find.text('Member’s Selection Roasted Peanuts'), findsOneWidget);
    expect(find.text('Processed'), findsOneWidget);
    expect(find.text('166'), findsOneWidget);
    await tester.scrollUntilVisible(find.textContaining('Open Food Facts'), 200);
    await tester.scrollUntilVisible(find.text('Log it'), 200);
    await tester.tap(find.text('Log it'));
    await tester.pumpAndSettle();
    expect(logged.single?.processing, FoodProcessing.processed);
    expect(logged.single?.calories, 166);
  });

  testWidgets('an unknown barcode switches to reading the label, which flags it as ultra-processed', (tester) async {
    // One camera for both scans: frame 1 shows the barcode, frames 2–4 three sides of the label.
    final camera = FakeLabelCamera([front, front, back, side], barcodes: ['99999999']);
    await pumpFoodScan(tester, camera);
    await scanOnce(tester, 'Start scanning');
    expect(find.textContaining("We don't know that barcode yet"), findsOneWidget);

    // Label only now: barcodes are ignored and each new side is kept until three are in.
    await tester.tap(find.text('Scan the label'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    for (var i = 0; i < 3; i++) {
      await tester.pump(const Duration(milliseconds: 700));
    }
    await tester.pumpAndSettle();

    expect(find.text('Crunchy Co Honey Almond Granola'), findsOneWidget);
    expect(find.text('Ultra-processed'), findsOneWidget);
    expect(find.textContaining('it contains emulsifier, flavouring'), findsOneWidget);
    expect(find.textContaining('Open Food Facts'), findsNothing);
  });
}
