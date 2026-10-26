import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../api/models.dart' show StackItem, StackTiming;
import '../device_time_zone.dart';

/// The day's check-in windows, set from when the person wakes up (onboarding's chronotype question).
/// While a window is open and they haven't checked in, the phone nudges: at the start, an hour later,
/// and a last call half an hour before it closes. Checking in silences the rest of that window.
enum ReminderSlot {
  morning('Morning', 0.5, 3.0, 'Your Focus Score is ready', 'Check in to see it, and your one thing for today.'),
  afternoon(
    'Afternoon',
    6.5,
    9.0,
    'Afternoon check-in',
    'How’s your focus? Ten seconds shows what lunch did to your afternoon.',
  ),
  evening('Evening', 12.5, 15.0, 'Evening check-in', 'How was today? Then dim the screens for a better night.');

  const ReminderSlot(this.label, this.startAfterWake, this.endAfterWake, this.title, this.body);

  final String label;

  /// Hours after waking that the window opens and closes.
  final double startAfterWake;
  final double endAfterWake;
  final String title;
  final String body;

  /// The window on [day] for someone who wakes at [wakeHour] (7.5 is 07:30).
  ({DateTime start, DateTime end}) on(DateTime day, double wakeHour) {
    DateTime at(double hours) => DateTime(day.year, day.month, day.day).add(Duration(minutes: (hours * 60).round()));
    return (start: at(wakeHour + startAfterWake), end: at(wakeHour + endAfterWake));
  }

  /// "07:30–10:00".
  String range(double wakeHour) {
    final w = on(DateTime(2026), wakeHour);
    return '${clock(w.start)}–${clock(w.end)}';
  }
}

/// "07:30".
String clock(DateTime t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

/// Onboarding's "When do you naturally wake up?" answers, as clock hours.
const wakeHours = {'before_6': 5.5, '6_to_8': 7.0, 'after_8': 8.5};
const defaultWakeHour = 7.0;

/// One notification to show. [id] encodes the day, window and nudge, so it can be replaced.
typedef Nudge = ({int id, DateTime at, String title, String body, ReminderSlot slot});

/// One-off nudges use ids from here up, so rescheduling the check-in nudges leaves them alone.
const oneOffIds = 900000;
const streakNudgeId = oneOffIds + 1;
const weeklyNudgeId = oneOffIds + 2;

/// Tapping it opens the week (Progress) instead of the check-in.
const weeklyPayload = 'week';

/// Supplement nudges use ids from here: one per time of day per day ahead.
const supplementNudgeIds = oneOffIds + 100;

/// Tapping a supplement nudge opens the Stack.
const stackPayload = 'stack';

/// When each time of day nudges, in hours after waking: morning, lunch and evening. "Any time"
/// supplements come with the morning ones.
const _supplementHours = {StackTiming.morning: 0.75, StackTiming.withFood: 5.5, StackTiming.evening: 13.5};
const _supplementTitles = {
  StackTiming.morning: 'Morning supplements',
  StackTiming.withFood: 'Supplements with lunch',
  StackTiming.evening: 'Evening supplements',
};

/// One supplement nudge: [id] encodes the time of day and the day ahead, so it can be replaced.
typedef SupplementNudge = ({int id, DateTime at, String title, String body});

/// The supplement nudges from [now] for the next [days] days: one per time of day that has a
/// supplement to remind about, naming them. Today's are left out once everything at that time is
/// ticked, and times already past are left out.
List<SupplementNudge> supplementNudgesFor({
  required List<({String name, StackTiming timing, bool takenToday})> items,
  required double wakeHour,
  required DateTime now,
  int days = 3,
}) {
  final out = <SupplementNudge>[];
  for (final MapEntry(key: timing, value: hours) in _supplementHours.entries) {
    final due = items.where((i) => (i.timing == StackTiming.any ? StackTiming.morning : i.timing) == timing).toList();
    if (due.isEmpty) continue;
    final names = due.map((i) => i.name).toList();
    final listed = names.length == 1
        ? names.first
        : '${names.sublist(0, names.length - 1).join(', ')} and ${names.last}';
    for (var d = 0; d < days; d++) {
      final at = DateTime(now.year, now.month, now.day + d).add(Duration(minutes: ((wakeHour + hours) * 60).round()));
      if (!at.isAfter(now) || (d == 0 && due.every((i) => i.takenToday))) continue;
      out.add((
        id: supplementNudgeIds + timing.index * 10 + d,
        at: at,
        title: _supplementTitles[timing]!,
        body: '$listed. Tick ${names.length == 1 ? 'it' : 'them'} off in your Stack.',
      ));
    }
  }
  return out;
}

/// Every nudge from [now] for the next [days] days, for the windows switched on. Windows already
/// checked in today ([doneToday]) get no more nudges today; times already past are left out.
List<Nudge> nudgesFor({
  required Set<ReminderSlot> slots,
  required double wakeHour,
  required DateTime now,
  Set<ReminderSlot> doneToday = const {},
  // iOS keeps at most 64 pending notifications: 3 windows × 3 nudges × 4 days stays well under.
  int days = 4,
}) {
  final out = <Nudge>[];
  for (var d = 0; d < days; d++) {
    final day = DateTime(now.year, now.month, now.day + d);
    for (final slot in ReminderSlot.values) {
      if (!slots.contains(slot) || (d == 0 && doneToday.contains(slot))) continue;
      final w = slot.on(day, wakeHour);
      final times = [
        (w.start, slot.title, slot.body),
        (
          w.start.add(const Duration(hours: 1)),
          'Still time to check in',
          'Your ${slot.label.toLowerCase()} window is open until ${clock(w.end)}.',
        ),
        (w.end.subtract(const Duration(minutes: 30)), 'Last call', '${slot.label} check-in closes at ${clock(w.end)}.'),
      ];
      for (final (i, (at, title, body)) in times.indexed) {
        if (!at.isAfter(now)) continue;
        out.add((id: d * 100 + slot.index * 10 + i, at: at, title: title, body: body, slot: slot));
      }
    }
  }
  return out;
}

/// Shows the nudges on the phone. Tapping one opens the check-in ([opened]).
abstract interface class Reminders {
  /// Asks to show notifications; false when the person said no.
  Future<bool> requestPermission();

  /// Replaces the check-in nudges with [nudges]. One-off nudges stay.
  Future<void> schedule(List<Nudge> nudges);

  /// A single nudge under its own [id] at [at], replacing any earlier one with that id; null [at] cancels it.
  /// [payload] says what a tap opens.
  Future<void> oneOff(int id, DateTime? at, {String title = '', String body = '', String? payload});

  /// Bumped when the weekly nudge is tapped, so the app opens the week.
  ValueListenable<int> get openedWeek;

  /// Bumped when a supplement nudge is tapped, so the app opens the Stack.
  ValueListenable<int> get openedStack;

  /// Bumped when a reminder is tapped, so the app opens the check-in.
  ValueListenable<int> get opened;
}

/// Which windows nudge, when the person wakes, and which windows they've checked in today; kept on the phone.
class ReminderSettings extends ChangeNotifier {
  ReminderSettings(this._prefs, this._reminders, {DateTime Function()? now}) : _now = now ?? DateTime.now;

  static const _key = 'neurocal.reminders';
  static const _wakeKey = 'neurocal.wakeHour';
  static const _doneKey = 'neurocal.checkins.done';

  final SharedPreferences _prefs;
  final Reminders _reminders;
  final DateTime Function() _now;

  Set<ReminderSlot> get slots => {
    for (final name in _prefs.getStringList(_key) ?? const <String>[])
      for (final slot in ReminderSlot.values)
        if (slot.name == name) slot,
  };

  double get wakeHour => _prefs.getDouble(_wakeKey) ?? defaultWakeHour;

  static String _day(DateTime t) => '${t.year}-${t.month}-${t.day}';

  /// The windows checked in on [now]'s day.
  Set<ReminderSlot> doneOn(DateTime now) {
    final parts = (_prefs.getString(_doneKey) ?? '').split('|');
    if (parts.length != 2 || parts[0] != _day(now)) return {};
    final names = parts[1].split(',');
    return {
      for (final slot in ReminderSlot.values)
        if (names.contains(slot.name)) slot,
    };
  }

  /// The window open at [now], whether or not it nudges; null between windows.
  ReminderSlot? openAt(DateTime now) {
    for (final slot in ReminderSlot.values) {
      final w = slot.on(now, wakeHour);
      if (!now.isBefore(w.start) && now.isBefore(w.end)) return slot;
    }
    return null;
  }

  /// Switches one window's nudges on or off. Turning the first one on asks for permission; false when refused.
  Future<bool> set(ReminderSlot slot, bool on) async {
    if (on && !await _reminders.requestPermission()) return false;
    final next = {...slots};
    on ? next.add(slot) : next.remove(slot);
    await _prefs.setStringList(_key, [for (final s in next) s.name]);
    await restore();
    notifyListeners();
    return true;
  }

  /// The windows follow the profile's wake time ("before_6", "6_to_8", "after_8").
  Future<void> useWake(Object? answer) async {
    final hour = wakeHours[answer] ?? defaultWakeHour;
    if (hour == wakeHour) return;
    await _prefs.setDouble(_wakeKey, hour);
    await restore();
    notifyListeners();
  }

  /// A check-in at [at] completes the window it falls in: no more nudges for it today.
  Future<void> checkedIn(DateTime at) async {
    final slot = openAt(at);
    if (slot == null) return;
    final done = {...doneOn(at), slot};
    await _prefs.setString(_doneKey, '${_day(at)}|${[for (final s in done) s.name].join(',')}');
    await restore();
    notifyListeners();
  }

  /// Bumped when a reminder is tapped.
  ValueListenable<int> get opened => _reminders.opened;

  /// Taps already acted on, so a later sign-in doesn't open the check-in again.
  int handled = 0;

  /// Schedules the next few days again: at launch, after a check-in, or a change of time zone.
  Future<void> restore() {
    final now = _now();
    return _reminders.schedule(nudgesFor(slots: slots, wakeHour: wakeHour, now: now, doneToday: doneOn(now)));
  }

  /// The evening nudge that keeps a streak: at 20:00 on a day with a streak going and nothing logged
  /// yet; cancelled once something is logged, or when there's no streak to keep.
  Future<void> streak({required int days, required bool todayDone}) {
    final now = _now();
    final at = DateTime(now.year, now.month, now.day, 20);
    final due = days > 0 && !todayDone && now.isBefore(at);
    return _reminders.oneOff(
      streakNudgeId,
      due ? at : null,
      title: 'Keep your $days-day streak',
      body: 'Log a meal or last night’s sleep before bed.',
    );
  }

  /// The week in review, every Sunday at 18:00: the next one from [now], scheduled again at each open.
  Future<void> weekly() {
    final now = _now();
    var at = DateTime(now.year, now.month, now.day + (DateTime.sunday - now.weekday) % 7, 18);
    if (!at.isAfter(now)) at = DateTime(at.year, at.month, at.day + 7, 18);
    return _reminders.oneOff(
      weeklyNudgeId,
      at,
      title: 'Your week in NeuroCal',
      body: 'Your average Focus Score, your best day and what made it. Tap to see your week.',
      payload: weeklyPayload,
    );
  }

  /// Bumped when the weekly nudge is tapped.
  ValueListenable<int> get openedWeek => _reminders.openedWeek;

  /// Bumped when a supplement nudge is tapped.
  ValueListenable<int> get openedStack => _reminders.openedStack;

  static const _mutedKey = 'neurocal.supplements.muted';
  static const _askedKey = 'neurocal.supplements.asked';

  /// The stack last scheduled for, so switching one supplement's reminder can reschedule the rest.
  List<StackItem> _stackItems = const [];

  /// Whether a supplement's daily reminder is on; on unless switched off.
  bool remindsAbout(String itemId) => !(_prefs.getStringList(_mutedKey) ?? const []).contains(itemId);

  /// Switches one supplement's daily reminder on or off.
  Future<void> setSupplementReminder(String itemId, bool on) async {
    final muted = {...?_prefs.getStringList(_mutedKey)};
    on ? muted.remove(itemId) : muted.add(itemId);
    await _prefs.setStringList(_mutedKey, muted.toList());
    await supplements(_stackItems);
    notifyListeners();
  }

  /// Daily nudges to take the supplements in [items] that remind (all, unless switched off): asks for
  /// permission once, the first time there's one to remind about, and replaces the earlier nudges.
  Future<void> supplements(List<StackItem> items) async {
    _stackItems = items;
    final reminded = [
      for (final i in items)
        if (remindsAbout(i.id)) (name: i.name, timing: i.timing, takenToday: i.takenToday),
    ];
    if (reminded.isNotEmpty && _prefs.getBool(_askedKey) != true) {
      await _prefs.setBool(_askedKey, true);
      if (!await _reminders.requestPermission()) return;
    }
    final nudges = supplementNudgesFor(items: reminded, wakeHour: wakeHour, now: _now());
    for (final timing in _supplementHours.keys) {
      for (var d = 0; d < 3; d++) {
        final id = supplementNudgeIds + timing.index * 10 + d;
        final n = nudges.where((x) => x.id == id).firstOrNull;
        await _reminders.oneOff(id, n?.at, title: n?.title ?? '', body: n?.body ?? '', payload: stackPayload);
      }
    }
  }

  /// Signed out: no reminders for an account that isn't here.
  Future<void> clear() async {
    await _prefs.remove(_key);
    await _prefs.remove(_doneKey);
    await _reminders.schedule(const []);
    await _reminders.oneOff(streakNudgeId, null);
    await _reminders.oneOff(weeklyNudgeId, null);
    for (final timing in _supplementHours.keys) {
      for (var d = 0; d < 3; d++) {
        await _reminders.oneOff(supplementNudgeIds + timing.index * 10 + d, null);
      }
    }
    _stackItems = const [];
    notifyListeners();
  }
}

/// Notifications scheduled with the phone's own alarm service, so they arrive with the app closed.
class DeviceReminders implements Reminders {
  final _plugin = FlutterLocalNotificationsPlugin();
  final _opened = ValueNotifier(0);
  final _openedWeek = ValueNotifier(0);
  final _openedStack = ValueNotifier(0);
  Future<void>? _ready;

  static const _payload = 'check_in';
  static const _details = NotificationDetails(
    android: AndroidNotificationDetails(
      'check_in_reminders',
      'Check-in reminders',
      channelDescription: 'Nudges while a check-in window is open, until you check in.',
      importance: Importance.defaultImportance,
    ),
    iOS: DarwinNotificationDetails(),
  );

  @override
  ValueListenable<int> get opened => _opened;

  @override
  ValueListenable<int> get openedWeek => _openedWeek;

  @override
  ValueListenable<int> get openedStack => _openedStack;

  void _tapped(String? payload) {
    if (payload == _payload) _opened.value++;
    if (payload == weeklyPayload) _openedWeek.value++;
    if (payload == stackPayload) _openedStack.value++;
  }

  Future<void> _init() => _ready ??= () async {
    tzdata.initializeTimeZones();
    final zone = await deviceTimeZone();
    if (zone != null) tz.setLocalLocation(tz.getLocation(zone));
    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        // Asked for when the first window is switched on, not at launch.
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
      onDidReceiveNotificationResponse: (r) => _tapped(r.payload),
    );
    // The app was started by tapping a reminder.
    final launch = await _plugin.getNotificationAppLaunchDetails();
    if (launch?.didNotificationLaunchApp == true) _tapped(launch?.notificationResponse?.payload);
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
  Future<void> oneOff(int id, DateTime? at, {String title = '', String body = '', String? payload}) async {
    await _init();
    await _plugin.cancel(id: id);
    if (at == null) return;
    await _plugin.zonedSchedule(
      id: id,
      scheduledDate: tz.TZDateTime.from(at, tz.local),
      notificationDetails: _details,
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      title: title,
      body: body,
      payload: payload,
    );
  }

  @override
  Future<void> schedule(List<Nudge> nudges) async {
    await _init();
    for (final p in await _plugin.pendingNotificationRequests()) {
      if (p.id < oneOffIds) await _plugin.cancel(id: p.id);
    }
    for (final n in nudges) {
      await _plugin.zonedSchedule(
        id: n.id,
        scheduledDate: tz.TZDateTime.from(n.at, tz.local),
        notificationDetails: _details,
        // Within a few minutes is fine for a nudge, and needs no exact-alarm permission.
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        title: n.title,
        body: n.body,
        payload: _payload,
      );
    }
  }
}

/// Tests and previews: remembers what would be scheduled.
class FakeReminders implements Reminders {
  FakeReminders({this.allowed = true});

  bool allowed;
  List<Nudge> scheduled = [];
  final _opened = ValueNotifier(0);
  final _openedWeek = ValueNotifier(0);

  @override
  ValueListenable<int> get openedWeek => _openedWeek;

  /// As if the weekly nudge was tapped.
  void tapWeek() => _openedWeek.value++;

  final _openedStack = ValueNotifier(0);

  @override
  ValueListenable<int> get openedStack => _openedStack;

  /// As if a supplement nudge was tapped.
  void tapStack() => _openedStack.value++;

  /// The windows with at least one nudge scheduled.
  Set<ReminderSlot> get windows => {for (final n in scheduled) n.slot};

  @override
  ValueListenable<int> get opened => _opened;

  /// As if a reminder was tapped.
  void tap() => _opened.value++;

  @override
  Future<bool> requestPermission() async => allowed;

  @override
  Future<void> schedule(List<Nudge> nudges) async => scheduled = [...nudges];

  /// One-off nudges by id.
  final oneOffs = <int, ({DateTime at, String title, String body, String? payload})>{};

  @override
  Future<void> oneOff(int id, DateTime? at, {String title = '', String body = '', String? payload}) async {
    at == null ? oneOffs.remove(id) : oneOffs[id] = (at: at, title: title, body: body, payload: payload);
  }
}
