import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import 'models.dart';

/// The NeuroCal API, as defined by `packages/contracts` (`endpoints`).
abstract interface class NeuroCalApi {
  /// The profile, or null when this account has not been through onboarding.
  Future<Profile?> me();

  /// `PUT /me/profile` with the fields of `UpdateProfileRequest`.
  Future<Profile> saveProfile(Map<String, dynamic> fields);
  Future<FocusScore> focusScore(DateTime day);
  Future<BioState> bioState(DateTime day);

  /// Recipes for the next meal, best first. Empty when nothing fits.
  Future<List<Recipe>> recommendations();
  Future<List<Meal>> meals(DateTime day);
  Future<AnalyzeMealResult> analyzeMeal(Uint8List photo, String filename);

  /// Logs a weigh-in for today (or [date]); a second the same day replaces it.
  Future<void> logWeight(double kg, {String? date});
  Future<WeightHistory> weights({int days = 90});
  Future<void> deleteWeight(String date);
  Future<FastingStatus> fasting();

  /// The supplements someone takes, today's ticks and the checks across them.
  Future<SupplementStack> stack();
  Future<StackItem> addToStack({
    required String name,
    String? servingSize,
    required List<SupplementIngredient> ingredients,
    required int servingsPerDay,
    required StackTiming timing,
    int? servingsPerContainer,
  });

  /// [servingsPerContainer] 0 clears it; [newBottle] restarts the running-low count today.
  Future<StackItem> updateStackItem(String id, {int? servingsPerDay, StackTiming? timing, int? servingsPerContainer, bool newBottle = false});
  Future<void> removeFromStack(String id);
  Future<void> setTaken(String id, bool taken);

  /// The food catalog, sorted by name. Fetched once and kept for the session.
  Future<List<CatalogFood>> foods();

  /// Reads 1–4 photos of one supplement bottle as a single label. Nothing is saved.
  Future<SupplementLabel> analyzeSupplement(List<Uint8List> photos, {List<String> names = const []});
  Future<Meal> createMeal(NewMeal meal);
  Future<void> deleteMeal(String id);

  /// Deletes the account and everything in it, including the sign-in. It cannot be undone.
  Future<void> deleteAccount();
  Future<void> checkIn(List<CognitiveFlag> flags, {String? note});

  /// The last [days] days, oldest first, ending today.
  Future<List<HistoryDay>> history(int days);

  /// Weak points of the week with the routines and products matched to them.
  Future<Help> help();
  Future<void> logSleep(DateTime start, DateTime end);

  /// Minutes on screens inside a window; logging the same window again replaces the earlier entry.
  Future<void> logScreenTime(DateTime windowStart, DateTime windowEnd, int minutes);
}

class ApiException implements Exception {
  ApiException(this.status, this.message);

  final int status;
  final String message;

  bool get unauthorized => status == 401;

  @override
  String toString() => 'ApiException($status): $message';
}

/// Talks to the deployed backend. Every call carries the Cognito ID token, like the web app.
class HttpNeuroCalApi implements NeuroCalApi {
  HttpNeuroCalApi({required this.baseUrl, required this.token, http.Client? client})
    : _client = client ?? http.Client();

  final String baseUrl;
  final Future<String?> Function() token;
  final http.Client _client;

  Future<Map<String, String>> _headers({bool json = false}) async {
    final t = await token();
    return {if (t != null) 'authorization': 'Bearer $t', if (json) 'content-type': 'application/json'};
  }

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse(baseUrl.replaceAll(RegExp(r'/+$'), '') + path).replace(queryParameters: query);

  dynamic _decode(http.Response res) {
    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode, res.body.isEmpty ? res.reasonPhrase ?? 'Request failed' : res.body);
    }
    return res.body.isEmpty ? null : jsonDecode(res.body);
  }

  Future<dynamic> _get(String path, [Map<String, String>? query]) async =>
      _decode(await _client.get(_uri(path, query), headers: await _headers()));

  @override
  Future<Profile?> me() async {
    final res = await _client.get(_uri('/me'), headers: await _headers());
    if (res.statusCode == 404) return null;
    return Profile.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<Profile> saveProfile(Map<String, dynamic> fields) async {
    final res = await _client.put(_uri('/me/profile'), headers: await _headers(json: true), body: jsonEncode(fields));
    return Profile.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<FocusScore> focusScore(DateTime day) async =>
      FocusScore.fromJson(await _get('/focus-score', {'date': isoDate(day)}) as Map<String, dynamic>);

  @override
  Future<BioState> bioState(DateTime day) async =>
      BioState.fromJson(await _get('/bio-state', {'date': isoDate(day)}) as Map<String, dynamic>);

  @override
  Future<List<Recipe>> recommendations() async => [
    for (final r in (await _get('/recommendations/next') as Map<String, dynamic>)['recipes'] as List)
      Recipe.fromJson(r as Map<String, dynamic>),
  ];

  @override
  Future<List<Meal>> meals(DateTime day) async => [
    for (final m in await _get('/meals', {'date': isoDate(day)}) as List) Meal.fromJson(m as Map<String, dynamic>),
  ];

  @override
  Future<AnalyzeMealResult> analyzeMeal(Uint8List photo, String filename) async {
    final req = http.MultipartRequest('POST', _uri('/meals/analyze'))
      ..headers.addAll(await _headers())
      ..files.add(http.MultipartFile.fromBytes('photo', photo, filename: filename));
    final res = await http.Response.fromStream(await _client.send(req));
    return AnalyzeMealResult.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<void> logWeight(double kg, {String? date}) => _post('/weights', {'kg': kg, 'date': ?date});

  @override
  Future<WeightHistory> weights({int days = 90}) async =>
      WeightHistory.fromJson(await _get('/weights', {'days': '$days'}) as Map<String, dynamic>);

  @override
  Future<void> deleteWeight(String date) async {
    _decode(await _client.delete(_uri('/weights/$date'), headers: await _headers()));
  }

  @override
  Future<FastingStatus> fasting() async => FastingStatus.fromJson(await _get('/fasting') as Map<String, dynamic>);

  @override
  Future<SupplementStack> stack() async => SupplementStack.fromJson(await _get('/stack') as Map<String, dynamic>);

  @override
  Future<StackItem> addToStack({
    required String name,
    String? servingSize,
    required List<SupplementIngredient> ingredients,
    required int servingsPerDay,
    required StackTiming timing,
    int? servingsPerContainer,
  }) async {
    final res = await _client.post(
      _uri('/stack'),
      headers: await _headers(json: true),
      body: jsonEncode({
        'name': name,
        'servingSize': ?servingSize,
        'ingredients': [for (final i in ingredients) ingredientJson(i)],
        'servingsPerDay': servingsPerDay,
        'timing': timing.wire,
        'servingsPerContainer': ?servingsPerContainer,
      }),
    );
    return StackItem.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<StackItem> updateStackItem(String id, {int? servingsPerDay, StackTiming? timing, int? servingsPerContainer, bool newBottle = false}) async {
    final res = await _client.put(
      _uri('/stack/$id'),
      headers: await _headers(json: true),
      body: jsonEncode({
        'servingsPerDay': ?servingsPerDay,
        'timing': ?timing?.wire,
        if (servingsPerContainer != null) 'servingsPerContainer': servingsPerContainer == 0 ? null : servingsPerContainer,
        if (newBottle) 'newBottle': true,
      }),
    );
    return StackItem.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<void> removeFromStack(String id) async {
    _decode(await _client.delete(_uri('/stack/$id'), headers: await _headers()));
  }

  @override
  Future<void> setTaken(String id, bool taken) async {
    _decode(await _client.put(_uri('/stack/$id/taken'), headers: await _headers(json: true), body: jsonEncode({'taken': taken})));
  }

  Future<List<CatalogFood>>? _foods;

  @override
  Future<List<CatalogFood>> foods() => _foods ??= () async {
    try {
      final body = await _get('/foods') as Map<String, dynamic>;
      return [for (final f in body['foods'] as List) CatalogFood.fromJson(f as Map<String, dynamic>)];
    } catch (_) {
      _foods = null; // Try again next time.
      rethrow;
    }
  }();

  @override
  Future<SupplementLabel> analyzeSupplement(List<Uint8List> photos, {List<String> names = const []}) async {
    final req = http.MultipartRequest('POST', _uri('/supplements/analyze'))
      ..headers.addAll(await _headers())
      ..files.addAll([
        for (final (i, photo) in photos.indexed)
          http.MultipartFile.fromBytes('photo', photo, filename: i < names.length ? names[i] : 'side-${i + 1}.jpg'),
      ]);
    final res = await http.Response.fromStream(await _client.send(req));
    return SupplementLabel.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<Meal> createMeal(NewMeal meal) async {
    final res = await _client.post(
      _uri('/meals'),
      headers: await _headers(json: true),
      body: jsonEncode(meal.toJson()),
    );
    return Meal.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<void> deleteAccount() async {
    _decode(await _client.delete(_uri('/me'), headers: await _headers()));
  }

  @override
  Future<void> deleteMeal(String id) async {
    _decode(await _client.delete(_uri('/meals/$id'), headers: await _headers()));
  }

  @override
  Future<void> checkIn(List<CognitiveFlag> flags, {String? note}) async {
    final body = {
      'at': isoWithOffset(DateTime.now()),
      'flags': [for (final f in flags) f.wire],
      if (note != null && note.isNotEmpty) 'note': note,
    };
    _decode(await _client.post(_uri('/check-ins'), headers: await _headers(json: true), body: jsonEncode(body)));
  }

  @override
  Future<List<HistoryDay>> history(int days) async => [
    for (final d in (await _get('/history', {'days': '$days'}) as Map<String, dynamic>)['days'] as List)
      HistoryDay.fromJson(d as Map<String, dynamic>),
  ];

  @override
  Future<Help> help() async => Help.fromJson(await _get('/recommendations/protocols') as Map<String, dynamic>);

  Future<void> _post(String path, Map<String, dynamic> body) async {
    _decode(await _client.post(_uri(path), headers: await _headers(json: true), body: jsonEncode(body)));
  }

  @override
  Future<void> logSleep(DateTime start, DateTime end) => _post('/telemetry/sleep', {
    'sessions': [
      {'start': start.toUtc().toIso8601String(), 'end': end.toUtc().toIso8601String(), 'source': 'manual'},
    ],
  });

  @override
  Future<void> logScreenTime(DateTime windowStart, DateTime windowEnd, int minutes) => _post('/telemetry/screen-time', {
    'samples': [
      {
        'windowStart': windowStart.toUtc().toIso8601String(),
        'windowEnd': windowEnd.toUtc().toIso8601String(),
        'minutes': minutes,
        'source': 'manual',
      },
    ],
  });
}
