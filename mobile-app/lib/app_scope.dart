import 'package:flutter/widgets.dart';

import 'api/api.dart';
import 'auth/auth.dart';
import 'billing/billing.dart';
import 'reminders/reminders.dart';
import 'theme/theme_controller.dart';

/// The app's services, wired once in main.dart (the composition root) and read by screens.
class AppScope extends InheritedWidget {
  const AppScope({
    super.key,
    required this.api,
    required this.auth,
    required this.theme,
    required this.timeZone,
    required this.openLink,
    required this.billing,
    this.reminders,
    required super.child,
  });

  final NeuroCalApi api;
  final AuthClient auth;
  final ThemeController theme;

  /// The device's IANA time zone, or null when it can't be read.
  final Future<String?> Function() timeZone;

  /// Opens a web link outside the app; false when nothing could open it.
  final Future<bool> Function(Uri link) openLink;
  final Billing billing;

  /// Check-in reminders; null where notifications aren't set up (tests, previews).
  final ReminderSettings? reminders;

  static AppScope of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!;

  @override
  bool updateShouldNotify(AppScope oldWidget) =>
      api != oldWidget.api ||
      auth != oldWidget.auth ||
      theme != oldWidget.theme ||
      timeZone != oldWidget.timeZone ||
      openLink != oldWidget.openLink ||
      billing != oldWidget.billing ||
      reminders != oldWidget.reminders;
}
