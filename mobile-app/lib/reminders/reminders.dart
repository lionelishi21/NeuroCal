import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../device_time_zone.dart';

/// The daily check-in reminders someone can switch on in Me. Each repeats at its time every day.
enum ReminderSlot {
  morning(8, 30, 'Morning', 'How did you sleep?', 'Log last night and check in: it sets today’s Focus Score.'),
  afternoon(14, 0, 'Afternoon', 'How’s your focus?', 'A 10-second check-in shows what lunch did to your afternoon.'),
  evening(20, 30, 'Evening', 'Wind-down check-in', 'How was today? Dim the screens soon for a better night.');

  const ReminderSlot(this.hour, this.minute, this.label, this.title, this.body);

  final int hour;
  final int minute;
  final String label;
  final String title;
  final String body;

  /// "08:30".
  String get time => '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';
}

/// Schedules the reminders on the phone. Tapping one opens the check-in ([opened]).
abstract interface class Reminders {
  /// Asks to show notifications; false when the person said no.
  Future<bool> requestPermission();

  /// Replaces whatever was scheduled with [slots].
  Future<void> schedule(Set<ReminderSlot> slots);

  /// Bumped when a reminder is tapped, so the app opens the check-in.
  ValueListenable<int> get opened;
}

/// Which reminders are on, kept on the phone.
class ReminderSettings extends ChangeNotifier {
  ReminderSettings(this._prefs, this._reminders);

  static const _key = 'neurocal.reminders';

  final SharedPreferences _prefs;
  final Reminders _reminders;

  Set<ReminderSlot> get slots => {
    for (final name in _prefs.getStringList(_key) ?? const <String>[])
      for (final slot in ReminderSlot.values)
        if (slot.name == name) slot,
  };

  /// Switches one reminder on or off. Turning the first one on asks for permission; false when refused.
  Future<bool> set(ReminderSlot slot, bool on) async {
    if (on && !await _reminders.requestPermission()) return false;
    final next = {...slots};
    on ? next.add(slot) : next.remove(slot);
    await _prefs.setStringList(_key, [for (final s in next) s.name]);
    await _reminders.schedule(next);
    notifyListeners();
    return true;
  }

  /// Bumped when a reminder is tapped.
  ValueListenable<int> get opened => _reminders.opened;

  /// Taps already acted on, so a later sign-in doesn't open the check-in again.
  int handled = 0;

  /// Schedules again what was chosen: after an update, or a change of time zone.
  Future<void> restore() => _reminders.schedule(slots);

  /// Signed out: no reminders for an account that isn't here.
  Future<void> clear() async {
    await _prefs.remove(_key);
    await _reminders.schedule(const {});
    notifyListeners();
  }
}

/// Notifications scheduled with the phone's own alarm service, so they arrive with the app closed.
class DeviceReminders implements Reminders {
  final _plugin = FlutterLocalNotificationsPlugin();
  final _opened = ValueNotifier(0);
  Future<void>? _ready;

  static const _payload = 'check_in';
  static const _details = NotificationDetails(
    android: AndroidNotificationDetails(
      'check_in_reminders',
      'Check-in reminders',
      channelDescription: 'Daily reminders to check in and log your sleep.',
      importance: Importance.defaultImportance,
    ),
    iOS: DarwinNotificationDetails(),
  );

  @override
  ValueListenable<int> get opened => _opened;

  Future<void> _init() => _ready ??= () async {
    tzdata.initializeTimeZones();
    final zone = await deviceTimeZone();
    if (zone != null) tz.setLocalLocation(tz.getLocation(zone));
    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        // Asked for when the first reminder is switched on, not at launch.
        iOS: DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
      ),
      onDidReceiveNotificationResponse: (r) {
        if (r.payload == _payload) _opened.value++;
      },
    );
    // The app was started by tapping a reminder.
    final launch = await _plugin.getNotificationAppLaunchDetails();
    if (launch?.didNotificationLaunchApp == true && launch?.notificationResponse?.payload == _payload) _opened.value++;
  }();

  /// Sets up the plugin at launch, so a tapped reminder is noticed.
  Future<void> start() => _init();

  @override
  Future<bool> requestPermission() async {
    await _init();
    final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    if (android != null) return await android.requestNotificationsPermission() ?? false;
    final ios = _plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();
    if (ios != null) return await ios.requestPermissions(alert: true, sound: true) ?? false;
    return false;
  }

  @override
  Future<void> schedule(Set<ReminderSlot> slots) async {
    await _init();
    await _plugin.cancelAll();
    final now = tz.TZDateTime.now(tz.local);
    for (final slot in slots) {
      var at = tz.TZDateTime(tz.local, now.year, now.month, now.day, slot.hour, slot.minute);
      if (!at.isAfter(now)) at = at.add(const Duration(days: 1));
      await _plugin.zonedSchedule(
        id: slot.index,
        scheduledDate: at,
        notificationDetails: _details,
        // Within a few minutes is fine for a nudge, and needs no exact-alarm permission.
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        title: slot.title,
        body: slot.body,
        payload: _payload,
        matchDateTimeComponents: DateTimeComponents.time,
      );
    }
  }
}

/// Tests and previews: remembers what would be scheduled.
class FakeReminders implements Reminders {
  FakeReminders({this.allowed = true});

  bool allowed;
  Set<ReminderSlot> scheduled = {};
  final _opened = ValueNotifier(0);

  @override
  ValueListenable<int> get opened => _opened;

  /// As if a reminder was tapped.
  void tap() => _opened.value++;

  @override
  Future<bool> requestPermission() async => allowed;

  @override
  Future<void> schedule(Set<ReminderSlot> slots) async => scheduled = {...slots};
}
