import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/main.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Links the app asked to open, most recent last.
final opened = <Uri>[];

Future<(ThemeController, MockAuthClient)> pumpApp(WidgetTester tester, {Map<String, Object> saved = const {}}) async {
  // A small phone, so layout overflows fail the test.
  tester.view.physicalSize = const Size(360, 740);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues(saved);
  final theme = ThemeController(await SharedPreferences.getInstance());
  final auth = MockAuthClient();
  final api = MockNeuroCalApi()..latency = Duration.zero;
  opened.clear();
  await tester.pumpWidget(
    NeuroCalApp(
      api: api,
      auth: auth,
      theme: theme,
      openLink: (link) async {
        opened.add(link);
        return true;
      },
    ),
  );
  return (theme, auth);
}

void main() {
  testWidgets('sign in, then Today shows the Focus Score and the meals', (tester) async {
    await pumpApp(tester);
    expect(find.text('Eat for how you want to think.'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'sam@example.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'correct-horse');
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();

    expect(find.text('Today'), findsOneWidget);
    expect(find.text('Focus Score'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Lunch'), 200);
    expect(find.text('Breakfast'), findsOneWidget);
    expect(find.text('Lunch'), findsOneWidget);
  });

  testWidgets('the appearance switch forces a mode and remembers it', (tester) async {
    final (theme, _) = await pumpApp(tester);
    MaterialApp app() => tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app().themeMode, ThemeMode.system);

    await tester.tap(find.text('Dark'));
    await tester.pumpAndSettle();
    expect(app().themeMode, ThemeMode.dark);
    expect((await SharedPreferences.getInstance()).getString(ThemeController.key), 'dark');

    await tester.tap(find.text('Match device'));
    await tester.pumpAndSettle();
    expect(app().themeMode, ThemeMode.system);
    expect((await SharedPreferences.getInstance()).getString(ThemeController.key), isNull);
    expect(theme.value, ThemeMode.system);
  });

  testWidgets('a saved choice applies on launch', (tester) async {
    await pumpApp(tester, saved: {ThemeController.key: 'light'});
    expect(tester.widget<MaterialApp>(find.byType(MaterialApp)).themeMode, ThemeMode.light);
  });

  testWidgets('create an account with the mock code', (tester) async {
    final (_, auth) = await pumpApp(tester);
    await tester.ensureVisible(find.text('Create an account'));
    await tester.tap(find.text('Create an account'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'new@example.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'long-enough-1');
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Create account'));
    await tester.tap(find.widgetWithText(FilledButton, 'Create account'));
    await tester.pumpAndSettle();

    expect(find.text('Check your email'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextFormField, 'Verification code'), MockAuthClient.mockCode);
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Verify email'));
    await tester.tap(find.widgetWithText(FilledButton, 'Verify email'));
    await tester.pumpAndSettle();

    expect(auth.signedIn, isTrue);
    expect(find.text('Today'), findsOneWidget);
  });

  Future<void> signIn(WidgetTester tester) async {
    await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'sam@example.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'correct-horse');
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();
  }

  testWidgets('log a meal by hand', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.text('Log a meal'));
    await tester.pumpAndSettle();

    await tester.enterText(find.widgetWithText(TextField, 'Item'), 'Lentil soup');
    await tester.enterText(find.widgetWithText(TextField, 'kcal'), '320');
    await tester.tap(find.byTooltip('Add item'));
    await tester.pumpAndSettle();
    expect(find.text('Lentil soup'), findsOneWidget);

    await tester.ensureVisible(find.text('Log meal · 320 kcal'));
    await tester.tap(find.text('Log meal · 320 kcal'));
    await tester.pumpAndSettle();
    expect(find.text('Meal logged'), findsOneWidget);
    await tester.scrollUntilVisible(find.textContaining('Lentil soup'), 200);
    expect(find.textContaining('Lentil soup'), findsOneWidget);
  });

  testWidgets('a check-in needs a flag and updates the stress input', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.widgetWithText(OutlinedButton, 'Check in'));
    await tester.pumpAndSettle();

    final save = find.widgetWithText(FilledButton, 'Save check-in');
    expect(tester.widget<FilledButton>(save).onPressed, isNull);
    await tester.tap(find.text('Sharp'));
    await tester.pumpAndSettle();
    await tester.tap(save);
    await tester.pumpAndSettle();
    expect(find.text('Check-in saved'), findsOneWidget);
  });

  testWidgets('this week and sleep tabs show the week, and screen time can be logged', (tester) async {
    await pumpApp(tester);
    await signIn(tester);

    await tester.tap(find.widgetWithText(InkWell, 'This week'));
    await tester.pumpAndSettle();
    expect(find.text('Today so far'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Routines to try'), 300);
    expect(find.text('Weak points this week'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Affiliate link'), 300);
    await tester.scrollUntilVisible(find.text('See product').first, 100);
    await tester.ensureVisible(find.text('See product').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('See product').first);
    await tester.pump();
    expect(opened.single.toString(), 'https://example.com/sunrise-alarm');
    await tester.scrollUntilVisible(find.text('Every day'), 300);

    await tester.tap(find.widgetWithText(InkWell, 'Sleep').last);
    await tester.pumpAndSettle();
    expect(find.text('Your nights on one clock'), findsOneWidget);
    expect(find.text('2 of 7'), findsOneWidget);

    await tester.tap(find.widgetWithText(OutlinedButton, 'Log screen time'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('90'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Log screen time'));
    await tester.pumpAndSettle();
    expect(find.text('Screen time logged'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('90 min'), 300);

    await tester.tap(find.widgetWithText(FilledButton, 'Log sleep'));
    await tester.pumpAndSettle();
    expect(find.text('Went to bed'), findsOneWidget);
    expect(find.text('Woke up'), findsOneWidget);
  });
}
