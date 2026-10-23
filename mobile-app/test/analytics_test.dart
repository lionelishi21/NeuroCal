import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:neurocal/analytics/analytics.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('events are batched to PostHog, and sign-in ties the phone’s events to the account', () async {
    SharedPreferences.setMockInitialValues({});
    final sent = <Map<String, dynamic>>[];
    final client = MockClient((request) async {
      expect(request.url.toString(), 'https://eu.i.posthog.com/batch/');
      sent.add(jsonDecode(request.body) as Map<String, dynamic>);
      return http.Response('{}', 200);
    });
    final analytics = PostHogAnalytics(
      await SharedPreferences.getInstance(),
      apiKey: 'phc_test',
      host: 'https://eu.i.posthog.com',
      client: client,
    );
    analytics.track('app_opened');
    analytics.identify('user-1');
    analytics.track('logged', {'kind': 'meal'});
    await analytics.flush();

    final batch = sent.single['batch'] as List;
    expect(sent.single['api_key'], 'phc_test');
    expect([for (final e in batch) e['event']], ['app_opened', r'$identify', 'logged']);
    final anon = batch[0]['distinct_id'];
    expect(batch[1]['properties'][r'$anon_distinct_id'], anon);
    expect(batch[2]['distinct_id'], 'user-1');
    expect(batch[2]['properties']['kind'], 'meal');
  });

  test('a failed send is dropped quietly', () async {
    SharedPreferences.setMockInitialValues({});
    final analytics = PostHogAnalytics(
      await SharedPreferences.getInstance(),
      apiKey: 'k',
      client: MockClient((_) async => throw Exception('offline')),
    );
    analytics.track('app_opened');
    await analytics.flush();
  });
}
