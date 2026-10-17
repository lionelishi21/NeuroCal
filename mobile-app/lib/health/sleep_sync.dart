import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:health/health.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api.dart';

/// A stretch of sleep from the phone's health store. [deep] marks deep-sleep stages.
typedef SleepSegment = ({DateTime start, DateTime end, bool deep});

/// One night, as the API takes it.
typedef Night = ({DateTime start, DateTime end, int deepMinutes});

/// Sleep pieces → nights: pieces less than an hour apart are one night (waking briefly doesn't split
/// it), deep minutes are summed, and anything under three hours is a nap and left out.
List<Night> nightsFrom(List<SleepSegment> segments) {
  final sorted = [...segments]..sort((a, b) => a.start.compareTo(b.start));
  final nights = <Night>[];
  DateTime? start, end;
  var deep = 0;
  void close() {
    if ((start, end) case (final s?, final e?) when e.difference(s) >= const Duration(hours: 3)) {
      nights.add((start: s, end: e, deepMinutes: deep));
    }
  }

  for (final s in sorted) {
    if (start != null && s.start.isAfter(end!.add(const Duration(hours: 1)))) {
      close();
      start = null;
    }
    if (start == null) {
      start = s.start;
      end = s.end;
      deep = 0;
    } else if (s.end.isAfter(end!)) {
      end = s.end;
    }
    if (s.deep) deep += s.end.difference(s.start).inMinutes;
  }
  close();
  return nights;
}

enum SleepAccess {
  /// No health store here (Health Connect not installed, or a platform without one).
  unavailable,
  notConnected,
  connected,
}

/// The phone's health store, as far as sleep goes.
abstract class SleepSource {
  /// "Health Connect" or "Apple Health".
  String get name;

  /// `TelemetrySource` in the contracts.
  String get wire;

  Future<bool> available();

  /// Asks for read access to sleep; true when granted.
  Future<bool> connect();
  Future<List<SleepSegment>> read(DateTime from, DateTime to);
}

/// Health Connect on Android, Apple Health on iOS, through the `health` plugin. Read only.
class HealthSleepSource implements SleepSource {
  final _health = Health();
  var _configured = false;

  static final _types = Platform.isAndroid
      ? [HealthDataType.SLEEP_SESSION, HealthDataType.SLEEP_DEEP]
      : [HealthDataType.SLEEP_ASLEEP, HealthDataType.SLEEP_LIGHT, HealthDataType.SLEEP_DEEP, HealthDataType.SLEEP_REM];

  Future<void> _configure() async {
    if (_configured) return;
    await _health.configure();
    _configured = true;
  }

  @override
  String get name => Platform.isAndroid ? 'Health Connect' : 'Apple Health';

  @override
  String get wire => Platform.isAndroid ? 'health_connect' : 'apple_health';

  @override
  Future<bool> available() async {
    if (!Platform.isAndroid && !Platform.isIOS) return false;
    await _configure();
    return Platform.isIOS || await _health.isHealthConnectAvailable();
  }

  @override
  Future<bool> connect() async {
    await _configure();
    return _health.requestAuthorization(_types, permissions: [for (final _ in _types) HealthDataAccess.READ]);
  }

  @override
  Future<List<SleepSegment>> read(DateTime from, DateTime to) async {
    await _configure();
    final points = await _health.getHealthDataFromTypes(types: _types, startTime: from, endTime: to);
    return [for (final p in points) (start: p.dateFrom, end: p.dateTo, deep: p.type == HealthDataType.SLEEP_DEEP)];
  }
}

/// Sleep that logs itself: once connected, the last nights are read from the health store and sent to
/// the API whenever the app opens. The API keeps one copy of each night, so sending twice is harmless.
class SleepSync extends ChangeNotifier {
  SleepSync(this._prefs, this.source);

  static const _key = 'neurocal.sleepSync.on';

  final SharedPreferences _prefs;
  final SleepSource source;
  var _available = false;

  /// Checked once at start; Health Connect may not be installed.
  bool get available => _available;

  SleepAccess get access => !_available
      ? SleepAccess.unavailable
      : _prefs.getBool(_key) == true
      ? SleepAccess.connected
      : SleepAccess.notConnected;

  Future<void>? _starting;

  /// Checks for the health store once; everything else waits for it.
  Future<void> start() => _starting ??= () async {
    _available = await source.available().catchError((Object _) => false);
    notifyListeners();
  }();

  /// Asks for access and, when given, imports straight away. Returns the nights imported, or null when
  /// access was refused.
  Future<int?> connect(NeuroCalApi api) async {
    if (!await source.connect().catchError((Object _) => false)) return null;
    await _prefs.setBool(_key, true);
    notifyListeners();
    return sync(api);
  }

  Future<void> disconnect() async {
    await _prefs.setBool(_key, false);
    notifyListeners();
  }

  /// The last day and a half; returns how many nights were sent. Never throws: a failed read is retried
  /// next time the app opens.
  Future<int> sync(NeuroCalApi api, {DateTime? now}) async {
    await start();
    if (access != SleepAccess.connected) return 0;
    try {
      final to = now ?? DateTime.now();
      final nights = nightsFrom(await source.read(to.subtract(const Duration(hours: 36)), to));
      if (nights.isEmpty) return 0;
      await api.importSleep(nights, source.wire);
      return nights.length;
    } catch (e) {
      debugPrint('Sleep sync failed: $e');
      return 0;
    }
  }
}

/// For tests and previews: whatever segments it is given, and access as set.
class FakeSleepSource implements SleepSource {
  FakeSleepSource({this.installed = true, this.grants = true, this.segments = const []});

  final bool installed;
  bool grants;
  List<SleepSegment> segments;

  @override
  String get name => 'Health Connect';

  @override
  String get wire => 'health_connect';

  @override
  Future<bool> available() async => installed;

  @override
  Future<bool> connect() async => grants;

  @override
  Future<List<SleepSegment>> read(DateTime from, DateTime to) async => segments;
}
