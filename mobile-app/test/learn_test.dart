import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:neurocal/widgets/learn_shelf.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('the Learn shelf says why each book is there, and opens the book or the audiobook', (tester) async {
    tester.view.physicalSize = const Size(360, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({});
    final opened = <Uri>[];
    await tester.pumpWidget(
      AppScope(
        api: MockNeuroCalApi()..latency = Duration.zero,
        auth: MockAuthClient(),
        theme: ThemeController(await SharedPreferences.getInstance()),
        timeZone: () async => 'Europe/London',
        openLink: (uri) async {
          opened.add(uri);
          return true;
        },
        billing: MockBilling(active: true),
        child: MaterialApp(
          theme: buildTheme(Brightness.light),
          home: const Scaffold(body: SingleChildScrollView(child: LearnShelfSection())),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Read and listen'), findsOneWidget);
    expect(find.text('Why We Sleep'), findsOneWidget);
    expect(find.text('Sleep is pulling your Focus Score down most.'), findsOneWidget);
    expect(find.text('Affiliate links'), findsNothing);
    await tester.tap(find.text('Audiobook').first);
    await tester.pumpAndSettle();
    expect(opened.single.host, 'www.audible.com');
    expect(opened.single.queryParameters['keywords'], 'Why We Sleep Matthew Walker');
  });
}
