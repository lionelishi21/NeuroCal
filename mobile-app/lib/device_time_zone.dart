import 'package:flutter_timezone/flutter_timezone.dart';

/// The device's IANA time zone (e.g. "America/Chicago"), which defines the person's day on the API.
/// Null when the platform can't say in time; the API then keeps its default.
Future<String?> deviceTimeZone() async {
  try {
    return (await FlutterTimezone.getLocalTimezone().timeout(const Duration(seconds: 2))).identifier;
  } catch (_) {
    return null;
  }
}
