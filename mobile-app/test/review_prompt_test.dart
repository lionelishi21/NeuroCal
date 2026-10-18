import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/review/review_prompt.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('asks at most once every 90 days, and a store error is swallowed', () async {
    SharedPreferences.setMockInitialValues({});
    var asked = 0;
    var now = DateTime(2026, 10, 17);
    final prompt = ReviewPrompt(await SharedPreferences.getInstance(), () async {
      asked++;
      throw Exception('store said no');
    }, now: () => now);

    expect(await prompt.maybeAsk(), isTrue);
    now = now.add(const Duration(days: 30));
    expect(await prompt.maybeAsk(), isFalse);
    now = now.add(const Duration(days: 61));
    expect(await prompt.maybeAsk(), isTrue);
    expect(asked, 2);
  });
}
