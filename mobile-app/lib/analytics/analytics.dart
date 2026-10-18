import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Product events for the growth funnel (docs/EXECUTION_PLAN.md, Phase 5 B): what people do, never
/// what they logged. No scores, weights, meals or health values go in an event, only that it happened
/// and which step or screen.
abstract interface class Analytics {
  void track(String event, [Map<String, Object> properties = const {}]);

  /// Ties this phone's earlier events to the signed-in account.
  void identify(String userId);
}

/// Nothing is sent: no key set, tests, previews.
class NoAnalytics implements Analytics {
  const NoAnalytics();

  @override
  void track(String event, [Map<String, Object> properties = const {}]) {}

  @override
  void identify(String userId) {}
}

/// PostHog through its capture API (https://posthog.com/docs/api/capture), batched every few seconds.
/// Plain HTTP, so no native SDK. A failed send is dropped: analytics never gets in the way.
class PostHogAnalytics implements Analytics {
  PostHogAnalytics(this._prefs, {required this.apiKey, this.host = 'https://us.i.posthog.com', http.Client? client})
    : _client = client ?? http.Client();

  static const _anonKey = 'neurocal.analytics.id';

  final SharedPreferences _prefs;
  final String apiKey;
  final String host;
  final http.Client _client;
  final _queue = <Map<String, Object?>>[];
  Timer? _timer;
  String? _userId;

  /// A random id kept on the phone until sign-in.
  String get _anonId {
    final id = _prefs.getString(_anonKey);
    if (id != null) return id;
    final rng = Random.secure();
    final fresh = List.generate(16, (_) => rng.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
    _prefs.setString(_anonKey, fresh);
    return fresh;
  }

  @override
  void track(String event, [Map<String, Object> properties = const {}]) {
    _queue.add({
      'event': event,
      'distinct_id': _userId ?? _anonId,
      'timestamp': DateTime.now().toUtc().toIso8601String(),
      'properties': {...properties, r'$lib': 'neurocal-flutter', 'platform': defaultTargetPlatform.name},
    });
    _timer ??= Timer(const Duration(seconds: 5), flush);
  }

  @override
  void identify(String userId) {
    if (_userId == userId) return;
    final anon = _anonId;
    _userId = userId;
    track(r'$identify', {r'$anon_distinct_id': anon});
  }

  Future<void> flush() async {
    _timer = null;
    if (_queue.isEmpty) return;
    final batch = [..._queue];
    _queue.clear();
    try {
      await _client.post(
        Uri.parse('$host/batch/'),
        headers: {'content-type': 'application/json'},
        body: jsonEncode({'api_key': apiKey, 'batch': batch}),
      );
    } catch (_) {
      // Dropped: next events still go.
    }
  }
}

/// For tests: what would have been sent.
class FakeAnalytics implements Analytics {
  final events = <(String, Map<String, Object>)>[];
  String? userId;

  Iterable<String> get names => events.map((e) => e.$1);

  @override
  void track(String event, [Map<String, Object> properties = const {}]) => events.add((event, properties));

  @override
  void identify(String userId) => this.userId = userId;
}
