import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';

import '../api/api.dart';
import '../reminders/reminders.dart';

/// Notifications the server sends (the morning score, a level-up, bad air, …), as opposed to the
/// reminders the phone schedules itself. Settings → Notifications switches each kind.
abstract interface class PushClient {
  /// Saves this phone for the signed-in account, now and whenever its token changes.
  Future<void> register(NeuroCalApi api);

  /// Signed out: the token is deleted, so this phone stops getting that account's notifications
  /// (the server forgets a token Firebase no longer accepts).
  Future<void> unregister();
}

/// Firebase Cloud Messaging, which also reaches iPhones through Apple's push service.
///
/// Uses registration tokens (getToken), which the server sends to as `message.token`. Firebase now
/// also offers installation IDs (register/onRegistered); moving means changing the server's sender
/// (backend FcmPushSender) at the same time, so the token calls stay until then.
class FirebasePush implements PushClient {
  FirebasePush(this._device);

  final DeviceReminders _device;
  StreamSubscription<String>? _refresh;

  FirebaseMessaging get _messaging => FirebaseMessaging.instance;

  /// At launch: a tapped push opens its screen, and one that arrives with the app open still shows.
  Future<void> start() async {
    // iOS shows it itself when asked to; Android needs it shown by hand.
    await _messaging.setForegroundNotificationPresentationOptions(alert: true, sound: true);
    FirebaseMessaging.onMessage.listen((m) {
      final n = m.notification;
      if (n == null || !Platform.isAndroid) return;
      _device
          .show(title: n.title ?? '', body: n.body ?? '', payload: m.data['open'] as String?)
          .catchError((Object _) {});
    });
    FirebaseMessaging.onMessageOpenedApp.listen((m) => _device.tapped(m.data['open'] as String?));
    final initial = await _messaging.getInitialMessage();
    if (initial != null) _device.tapped(initial.data['open'] as String?);
  }

  @override
  Future<void> register(NeuroCalApi api) async {
    final platform = Platform.isIOS ? 'ios' : 'android';
    Future<void> save(String token) => api.registerDevice(token: token, platform: platform);
    await _refresh?.cancel();
    // ignore: deprecated_member_use
    _refresh = _messaging.onTokenRefresh.listen((t) => save(t).catchError((Object _) {}));
    // ignore: deprecated_member_use
    final token = await _messaging.getToken();
    if (token != null) await save(token);
  }

  @override
  Future<void> unregister() async {
    await _refresh?.cancel();
    _refresh = null;
    // ignore: deprecated_member_use
    await _messaging.deleteToken();
  }
}

/// Tests and previews: remembers what happened.
class FakePush implements PushClient {
  final registered = <NeuroCalApi>[];
  var unregistered = 0;

  @override
  Future<void> register(NeuroCalApi api) async => registered.add(api);

  @override
  Future<void> unregister() async => unregistered++;
}
