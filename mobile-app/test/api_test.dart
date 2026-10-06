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
}
