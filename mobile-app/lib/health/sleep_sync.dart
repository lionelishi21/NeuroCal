import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:health/health.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api.dart';

/// A stretch of sleep from the phone's health store. [deep] marks deep-sleep stages.
typedef SleepSegment = ({DateTime start, DateTime end, bool deep});

/// One night, as the API takes it.
typedef Night = ({DateTime start, DateTime end, int deepMinutes});

/// A heart reading from the health store: resting_hr, hrv, bp_systolic or bp_diastolic.
typedef MarkerSample = ({String marker, double value, DateTime at});

/// Samples → one reading per marker per finished day (before [today]), dated at local noon so a day
/// never changes once sent: resting heart rate and HRV averaged, blood pressure the day's last.
List<({String marker, double value, DateTime day})> dailyMarkers(List<MarkerSample> samples, DateTime today) {
  final start = DateTime(today.year, today.month, today.day);
  final byKey = <String, List<MarkerSample>>{};
  for (final s in samples) {
    final local = s.at.toLocal();
    final day = DateTime(local.year, local.month, local.day);
    if (!day.isBefore(start)) continue;
    (byKey['${s.marker}|${day.toIso8601String()}'] ??= []).add(s);
  }
  return [
    for (final entry in byKey.entries)
      () {
        final list = entry.value..sort((a, b) => a.at.compareTo(b.at));
        final local = list.first.at.toLocal();
        final latest = list.last.marker.startsWith('bp_');
        final value = latest ? list.last.value : list.fold(0.0, (s, x) => s + x.value) / list.length;
        return (marker: list.first.marker, value: (value * 10).round() / 10, day: DateTime(local.year, local.month, local.day, 12));
      }(),
  ];
}

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

  /// Heart readings; each kind the person didn't allow is left out rather than failing the rest.
  Future<List<MarkerSample>> readMarkers(DateTime from, DateTime to);
}

/// Health Connect on Android, Apple Health on iOS, through the `health` plugin. Read only.
class HealthSleepSource implements SleepSource {
  final _health = Health();
  var _configured = false;

  static final _types = Platform.isAndroid
      ? [HealthDataType.SLEEP_SESSION, HealthDataType.SLEEP_DEEP]
      : [HealthDataType.SLEEP_ASLEEP, HealthDataType.SLEEP_LIGHT, HealthDataType.SLEEP_DEEP, HealthDataType.SLEEP_REM];

  static final _markerTypes = <HealthDataType, String>{
    HealthDataType.RESTING_HEART_RATE: 'resting_hr',
    if (Platform.isAndroid) HealthDataType.HEART_RATE_VARIABILITY_RMSSD: 'hrv' else HealthDataType.HEART_RATE_VARIABILITY_SDNN: 'hrv',
    HealthDataType.BLOOD_PRESSURE_SYSTOLIC: 'bp_systolic',
    HealthDataType.BLOOD_PRESSURE_DIASTOLIC: 'bp_diastolic',
  };

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
    // Sleep and heart data in one request; the person can allow any of them.
    final types = [..._types, ..._markerTypes.keys];
    return _health.requestAuthorization(types, permissions: [for (final _ in types) HealthDataAccess.READ]);
  }

  @override
  Future<List<MarkerSample>> readMarkers(DateTime from, DateTime to) async {
    await _configure();
    final out = <MarkerSample>[];
    for (final MapEntry(key: type, value: marker) in _markerTypes.entries) {
      try {
        for (final p in await _health.getHealthDataFromTypes(types: [type], startTime: from, endTime: to)) {
          if (p.value case NumericHealthValue(:final numericValue)) out.add((marker: marker, value: numericValue.toDouble(), at: p.dateFrom));
        }
      } catch (_) {
        // Not allowed, or not on this phone: the other kinds still come in.
      }
    }
    return out;
  }

  @override
  Future<List<SleepSegment>> read(DateTime from, DateTime to) async {
    await _configure();
    final points = await _health.getHealthDataFromTypes(types: _types, startTime: from, endTime: to);
    return [for (final p in points) (start: p.dateFrom, end: p.dateTo, deep: p.type == HealthDataType.SLEEP_DEEP)];
  }
}

/// Sleep and heart data that log themselves: once connected, the last nights are read from the health store and sent to
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

  /// The last day and a half of sleep and the last week of heart readings; returns how many nights and
  /// new readings were sent. Never throws: a failed read is retried next time the app opens.
  Future<int> sync(NeuroCalApi api, {DateTime? now}) async {
    await start();
    if (access != SleepAccess.connected) return 0;
    final to = now ?? DateTime.now();
    var sent = 0;
    try {
      final nights = nightsFrom(await source.read(to.subtract(const Duration(hours: 36)), to));
      if (nights.isNotEmpty) {
        await api.importSleep(nights, source.wire);
        sent += nights.length;
      }
    } catch (e) {
      debugPrint('Sleep sync failed: $e');
    }
    try {
      final days = dailyMarkers(await source.readMarkers(to.subtract(const Duration(days: 8)), to), to);
      if (days.isNotEmpty) {
        sent += await api.recordMarkers([for (final d in days) (marker: d.marker, value: d.value, measuredAt: d.day, source: source.wire)]);
      }
    } catch (e) {
      debugPrint('Heart data sync failed: $e');
    }
    return sent;
  }
}

/// For tests and previews: whatever segments it is given, and access as set.
class FakeSleepSource implements SleepSource {
  FakeSleepSource({this.installed = true, this.grants = true, this.segments = const [], this.markers = const []});

  final bool installed;
  bool grants;
  List<SleepSegment> segments;
  List<MarkerSample> markers;

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

  @override
  Future<List<MarkerSample>> readMarkers(DateTime from, DateTime to) async => markers;
}
