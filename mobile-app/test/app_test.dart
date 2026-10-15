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
    // The code field takes focus with a number pad of its own, not the email field's keyboard.
    final code = tester.widget<EditableText>(
      find.descendant(of: find.widgetWithText(TextFormField, 'Verification code'), matching: find.byType(EditableText)),
    );
    expect(code.focusNode.hasFocus, isTrue);
    final client = tester.testTextInput.log.lastWhere((call) => call.method == 'TextInput.setClient');
    expect(((client.arguments as List)[1] as Map)['inputType']['name'], 'TextInputType.number');
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

  /// Opens the add menu in the tab bar and chooses [label].
  Future<void> add(WidgetTester tester, String label) async {
    await tester.tap(find.bySemanticsLabel('Add'));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: find.byType(BottomSheet), matching: find.text(label)));
    await tester.pumpAndSettle();
  }

  testWidgets('log a meal by hand', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await add(tester, 'Log a meal');

    await tester.tap(find.text('Add an item by hand instead'));
    await tester.pumpAndSettle();

    // A name and its calories are both needed.
    await tester.tap(find.widgetWithText(FilledButton, 'Add item'));
    await tester.pumpAndSettle();
    expect(find.text('Add a food name and its calories.'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextField, 'Food'), 'Lentil soup');
    await tester.enterText(find.widgetWithText(TextField, 'kcal'), '320');
    await tester.enterText(find.widgetWithText(TextField, 'Protein'), '18');
    await tester.tap(find.widgetWithText(FilledButton, 'Add item'));
    await tester.pumpAndSettle();
    expect(find.text('Lentil soup'), findsOneWidget);
    expect(find.text('18 g'), findsOneWidget);

    await tester.ensureVisible(find.text('Log meal, 320 kcal'));
    await tester.tap(find.text('Log meal, 320 kcal'));
    await tester.pumpAndSettle();
    expect(find.text('Meal logged'), findsOneWidget);
    await tester.scrollUntilVisible(find.textContaining('Lentil soup'), 200);
    expect(find.textContaining('Lentil soup'), findsOneWidget);
  });

  testWidgets('a check-in needs a flag and updates the stress input', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await add(tester, 'Check in');

    final save = find.widgetWithText(FilledButton, 'Save check-in');
    expect(tester.widget<FilledButton>(save).onPressed, isNull);
    await tester.tap(find.text('Sharp'));
    await tester.pumpAndSettle();
    await tester.tap(save);
    await tester.pumpAndSettle();
    expect(find.text('Check-in saved'), findsOneWidget);
  });

  testWidgets('delete account asks first, then signs out and forgets the account', (tester) async {
    final (_, auth) = await pumpApp(tester);
    await signIn(tester);

    await tester.tap(find.widgetWithText(InkWell, 'Me'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.widgetWithText(TextButton, 'Delete account'), 300);
    await tester.tap(find.widgetWithText(TextButton, 'Delete account'));
    await tester.pumpAndSettle();
    expect(find.text('Delete your account?'), findsOneWidget);

    // Closing the sheet keeps everything.
    await tester.tap(find.byTooltip('Close'));
    await tester.pumpAndSettle();
    expect(auth.signedIn, isTrue);

    await tester.tap(find.widgetWithText(TextButton, 'Delete account'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Delete account'));
    await tester.pumpAndSettle();
    expect(auth.signedIn, isFalse);
    expect(find.text('Eat for how you want to think.'), findsOneWidget);
    // The mock forgot the account: the old password no longer matters.
    expect(await auth.signIn('sam@example.com', 'a-different-password'), SignInStep.done);
  });

  testWidgets('Progress shows the week and sleep, and screen time can be logged', (tester) async {
    await pumpApp(tester);
    await signIn(tester);

    await tester.tap(find.widgetWithText(InkWell, 'Progress'));
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

  testWidgets('the tabs: a past day on Today, Body in Progress, and the Stack tab', (tester) async {
    await pumpApp(tester);
    await signIn(tester);

    // The week strip shows yesterday without today's extras.
    final yesterday = DateTime.now().subtract(const Duration(days: 1));
    await tester.tap(find.text('${yesterday.day}'));
    await tester.pumpAndSettle();
    expect(find.text('Looking back'), findsOneWidget);
    expect(find.text('Brain speed'), findsNothing);
    await tester.scrollUntilVisible(find.text('Back to today'), 300);
    await tester.tap(find.text('Back to today'));
    await tester.pumpAndSettle();
    expect(find.text('Looking back'), findsNothing);

    await tester.tap(find.widgetWithText(InkWell, 'Progress'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(InkWell, 'Body'));
    await tester.pumpAndSettle();
    expect(find.text('Weight and Brain speed'), findsOneWidget);

    await tester.tap(find.widgetWithText(InkWell, 'Level'));
    await tester.pumpAndSettle();
    expect(find.text('Fuelled'), findsWidgets);
    expect(find.text('To reach In rhythm'), findsOneWidget);
    expect(find.text('Eat and switch off screens on time, 5 nights a week'), findsOneWidget);

    await tester.tap(find.widgetWithText(InkWell, 'Stack'));
    await tester.pumpAndSettle();
    expect(find.text('Your stack'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Browse foods'), 300);
    expect(find.text('Browse foods'), findsOneWidget);
  });

  testWidgets('log exercise from the add menu: it shows on Today with its calories, and can be removed', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await add(tester, 'Log exercise');

    final log = find.widgetWithText(FilledButton, 'Log exercise');
    expect(tester.widget<FilledButton>(log).onPressed, isNull);
    await tester.tap(find.text('Walk'));
    await tester.ensureVisible(find.text('45 min'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('45 min'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(log);
    await tester.tap(log);
    await tester.pumpAndSettle();

    // (3.5 − 1) × 75 kg × 0.75 h in the mock, as on the API.
    expect(find.text('Exercise logged · 141 kcal burned'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('45 min · 141 kcal burned'), 200);
    expect(find.text('Walk · 45 min · moderate'), findsOneWidget);

    // Clear of the tab bar before tapping.
    await tester.ensureVisible(find.text('Walk · 45 min · moderate'));
    await Scrollable.ensureVisible(tester.element(find.text('Walk · 45 min · moderate')), alignment: 0.5);
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel('Remove walk'));
    await tester.pumpAndSettle();
    expect(find.text('Exercise removed'), findsOneWidget);
    expect(find.text('Walk · 45 min · moderate'), findsNothing);
  });

  testWidgets('the pantry: add items, get recipes marked by what you have, and log one', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.widgetWithText(InkWell, 'Stack'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.bySemanticsLabel('Your pantry: What can I make from it?'), 300);
    await tester.tap(find.bySemanticsLabel('Your pantry: What can I make from it?'));
    await tester.pumpAndSettle();

    expect(find.text('7 items'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextField, 'Add items'), 'rice, eggs');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();
    // Eggs were already there.
    expect(find.text('8 items'), findsOneWidget);

    await tester.scrollUntilVisible(find.text('What can I make?'), 300, scrollable: find.byType(Scrollable).first);
    await tester.tap(find.text('What can I make?'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Salmon and spinach scramble'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text('✓ Eggs'), findsOneWidget);
    expect(find.text('+ Chives'), findsOneWidget);
    expect(find.text('To buy: Chives'), findsOneWidget);

    await tester.ensureVisible(find.bySemanticsLabel('Log Salmon and spinach scramble'));
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel('Log Salmon and spinach scramble'));
    await tester.pumpAndSettle();
    expect(find.text('Log a meal'), findsWidgets);
    expect(find.text('Salmon and spinach scramble'), findsWidgets);
  });

  testWidgets('review a shopping list: swaps with cleaner choices, and the gadget the list calls for', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.widgetWithText(InkWell, 'Stack'));
    await tester.pumpAndSettle();
    final card = find.bySemanticsLabel('Review my shopping list: Cleaner swaps, and gadgets that help');
    await tester.scrollUntilVisible(card, 300);
    await tester.tap(card);
    await tester.pumpAndSettle();

    await tester.enterText(find.widgetWithText(TextField, 'Your list'), 'Frozen fries\nSpinach\nFlavoured yogurt');
    await tester.tap(find.text('Review my list'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Plain Greek yogurt with berries'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text('3 items · 2 to swap'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Ninja air fryer'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text('For Frozen fries'), findsOneWidget);
  });
}
