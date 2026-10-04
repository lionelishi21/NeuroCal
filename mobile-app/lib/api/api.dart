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
  Future<List<Meal>> meals(DateTime day);
  Future<AnalyzeMealResult> analyzeMeal(Uint8List photo, String filename);
  Future<Meal> createMeal(NewMeal meal);
  Future<void> deleteMeal(String id);
  Future<void> checkIn(List<CognitiveFlag> flags, {String? note});
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
  Future<Meal> createMeal(NewMeal meal) async {
    final res = await _client.post(
      _uri('/meals'),
      headers: await _headers(json: true),
      body: jsonEncode(meal.toJson()),
    );
    return Meal.fromJson(_decode(res) as Map<String, dynamic>);
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
}
