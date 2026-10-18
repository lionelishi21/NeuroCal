import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:neurocal/api/api.dart';
import 'package:neurocal/api/models.dart';

void main() {
  test('sends the ID token and the local date, and parses meals', () async {
    late http.Request seen;
    final api = HttpNeuroCalApi(
      baseUrl: 'https://api.example.com/',
      token: () async => 'id-token',
      client: MockClient((req) async {
        seen = req;
        return http.Response(
          jsonEncode([
            {
              'id': 'm1',
              'kind': 'breakfast',
              'eatenAt': '2026-09-29T08:10:00-05:00',
              'items': [
                {
                  'name': 'Oats',
                  'portion': '1 cup',
                  'calories': 300,
                  'macros': {'proteinG': 10, 'carbsG': 54, 'fatG': 5},
                  'glycemicLoad': 'high',
                },
              ],
            },
          ]),
          200,
        );
      }),
    );

    final meals = await api.meals(DateTime(2026, 9, 29));
    expect(seen.url.toString(), 'https://api.example.com/meals?date=2026-09-29');
    expect(seen.headers['authorization'], 'Bearer id-token');
    expect(meals.single.calories, 300);
    expect(meals.single.highGlycemic, isTrue);
  });

  test('a 401 surfaces as unauthorized', () async {
    final api = HttpNeuroCalApi(
      baseUrl: 'https://api.example.com',
      token: () async => null,
      client: MockClient((_) async => http.Response('', 401)),
    );
    await expectLater(
      api.focusScore(DateTime(2026, 9, 29)),
      throwsA(isA<ApiException>().having((e) => e.unauthorized, 'unauthorized', isTrue)),
    );
  });

  test('an API error surfaces its sentence and code, not the raw body', () async {
    final api = HttpNeuroCalApi(
      baseUrl: 'https://api.example.com',
      token: () async => 't',
      client: MockClient((_) async => http.Response('{"code":"daily_limit","message":"Daily limit reached."}', 429)),
      retryDelays: const [],
    );
    await expectLater(
      api.createMealPlan(3),
      throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Daily limit reached.').having((e) => e.code, 'code', 'daily_limit')),
    );
    final gateway = HttpNeuroCalApi(baseUrl: 'https://api.example.com', token: () async => 't', client: MockClient((_) async => http.Response('<html>Bad gateway</html>', 502, reasonPhrase: 'Bad Gateway')), retryDelays: const []);
    await expectLater(gateway.createMealPlan(3), throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Bad Gateway')));
  });

  test('check-ins post wire flag names', () async {
    late Map<String, dynamic> body;
    final api = HttpNeuroCalApi(
      baseUrl: 'https://api.example.com',
      token: () async => 't',
      client: MockClient((req) async {
        body = jsonDecode(req.body) as Map<String, dynamic>;
        return http.Response(jsonEncode({'id': 'c1', 'at': body['at'], 'flags': body['flags']}), 201);
      }),
    );
    await api.checkIn([CognitiveFlag.brainFog, CognitiveFlag.calm]);
    expect(body['flags'], ['brain_fog', 'calm']);
  });

  test('a read the server turns away for a moment is tried again; a write is not', () async {
    var reads = 0;
    var writes = 0;
    final api = HttpNeuroCalApi(
      baseUrl: 'https://api.example.com',
      token: () async => 'token',
      retryDelays: const [Duration.zero, Duration.zero],
      client: MockClient((req) async {
        if (req.method == 'GET') {
          reads++;
          return reads < 3 ? http.Response('Service Unavailable', 503) : http.Response('[]', 200);
        }
        writes++;
        return http.Response('Service Unavailable', 503);
      }),
    );
    expect(await api.meals(DateTime(2026, 10, 14)), isEmpty);
    expect(reads, 3);
    await expectLater(api.deleteMeal('m1'), throwsA(isA<ApiException>()));
    expect(writes, 1);
  });

  test('today is one call, with the date only for a past day; missing extras stay null', () async {
    final urls = <String>[];
    final api = HttpNeuroCalApi(
      baseUrl: 'https://api.example.com',
      token: () async => 'token',
      client: MockClient((req) async {
        urls.add(req.url.toString());
        const macros = {'proteinG': 0, 'carbsG': 0, 'fatG': 0};
        return http.Response(
          jsonEncode({
            'focus': {
              'date': '2026-10-14',
              'score': 82,
              'components': {'sleep': 0.8, 'timing': null, 'glycemic': null, 'stress': null},
              'explanation': 'Good sleep.',
            },
            'bio': {'calorieTarget': 2200, 'caloriesEaten': 0, 'macrosEaten': macros, 'macroTargets': macros},
            'meals': <Object>[],
            'brain': {'checks': <Object>[], 'baselineScore': 70},
          }),
          200,
        );
      }),
    );
    final today = await api.today();
    expect(today.focus.score, 82);
    expect(today.brain?.baselineScore, 70);
    expect(today.recipes, isNull);
    expect(today.stack, isNull);
    await api.today(DateTime(2026, 10, 12));
    expect(urls, ['https://api.example.com/today', 'https://api.example.com/today?date=2026-10-12']);
  });
}
