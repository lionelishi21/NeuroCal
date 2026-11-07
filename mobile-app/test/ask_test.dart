import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/api.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/screens/ask.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:neurocal/widgets/toast.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Records what was sent; the first answer can fail.
class _Api extends MockNeuroCalApi {
  final sent = <(List<ChatMessage>, String)>[];
  var failOnce = false;

  @override
  Future<String> ask(List<ChatMessage> messages, {required String unit}) async {
    sent.add((List.of(messages), unit));
    if (failOnce) {
      failOnce = false;
      throw ApiException(429, 'That’s today’s limit of 40 questions. It resets tomorrow.', code: 'daily_limit');
    }
    return super.ask(messages, unit: unit);
  }
}

Future<_Api> _open(WidgetTester tester, {String? question}) async {
  tester.view.physicalSize = const Size(360, 740);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({'weightUnit': 'lb'});
  final api = _Api()..latency = Duration.zero;
  await tester.pumpWidget(
    AppScope(
      api: api,
      auth: MockAuthClient(),
      theme: ThemeController(await SharedPreferences.getInstance()),
      timeZone: () async => 'America/Chicago',
      openLink: (_) async => true,
      billing: MockBilling(active: true),
      child: MaterialApp(
        theme: buildTheme(Brightness.light),
        builder: (context, child) => ToastHost(child: child!),
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: FilledButton(
                onPressed: () => openAsk(context, question: question),
                child: const Text('Open'),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Open'));
  await tester.pumpAndSettle();
  return api;
}

void main() {
  testWidgets('a question from the weight card is asked straight away, in pounds, and answered', (tester) async {
    final api = await _open(tester, question: 'Why did my weight go up?');
    expect(api.sent.single.$2, 'lb');
    expect(api.sent.single.$1.single, (fromMe: true, text: 'Why did my weight go up?'));
    expect(find.text('Why did my weight go up?'), findsOneWidget);
    expect(find.textContaining('Almost certainly water'), findsOneWidget);
    expect(find.textContaining('Not medical advice'), findsOneWidget);
  });

  testWidgets('starters ask in a tap; a follow-up sends the whole conversation; a limit can be retried', (
    tester,
  ) async {
    final api = await _open(tester);
    expect(find.text('Ask about your weight, food, fasting or sleep.'), findsOneWidget);
    await tester.tap(find.text('How has my sleep been?'));
    await tester.pumpAndSettle();
    expect(find.textContaining('your sleep is the biggest lever'), findsOneWidget);

    api.failOnce = true;
    await tester.enterText(find.byType(TextField), 'And my weight?');
    await tester.tap(find.byTooltip('Send'));
    await tester.pumpAndSettle();
    expect(find.textContaining('today’s limit of 40 questions'), findsOneWidget);
    expect(api.sent.last.$1.length, 3);

    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Almost certainly water'), findsOneWidget);
    expect(find.textContaining('today’s limit'), findsNothing);
    expect(api.sent.last.$1.map((m) => m.fromMe), [true, false, true]);
  });
}
