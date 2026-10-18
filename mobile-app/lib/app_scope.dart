import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import 'analytics/analytics.dart';
import 'api/api.dart';
import 'auth/auth.dart';
import 'billing/billing.dart';
import 'health/sleep_sync.dart';
import 'home_widget/focus_widget.dart';
import 'reminders/reminders.dart';
import 'review/review_prompt.dart';
import 'theme/theme_controller.dart';

Future<void> _noShare(Uint8List png, String text) async {}

/// The app's services, wired once in main.dart (the composition root) and read by screens.
class AppScope extends InheritedWidget {
  const AppScope({
    super.key,
    required this.api,
    required this.auth,
    required this.theme,
    required this.timeZone,
    required this.openLink,
    this.shareImage = _noShare,
    this.analytics = const NoAnalytics(),
    required this.billing,
    this.reminders,
    this.sleepSync,
    this.reviewPrompt,
    this.homeWidget,
    required super.child,
  });

  final NeuroCalApi api;
  final AuthClient auth;
  final ThemeController theme;

  /// The device's IANA time zone, or null when it can't be read.
  final Future<String?> Function() timeZone;

  /// Opens a web link outside the app; false when nothing could open it.
  final Future<bool> Function(Uri link) openLink;

  /// Product events for the funnel; nothing is sent without a key.
  final Analytics analytics;

  /// Hands a PNG and a caption to the phone's share sheet.
  final Future<void> Function(Uint8List png, String text) shareImage;
  final Billing billing;

  /// Check-in reminders; null where notifications aren't set up (tests, previews).
  final ReminderSettings? reminders;

  /// Sleep from Health Connect or Apple Health; null where there is no health store (tests, previews).
  final SleepSync? sleepSync;

  /// The store's rating dialog at good moments; null in tests and previews.
  final ReviewPrompt? reviewPrompt;

  /// The home-screen widget; null in tests and previews.
  final FocusWidgetSink? homeWidget;

  static AppScope of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!;

  @override
  bool updateShouldNotify(AppScope oldWidget) =>
      api != oldWidget.api ||
      auth != oldWidget.auth ||
      theme != oldWidget.theme ||
      timeZone != oldWidget.timeZone ||
      openLink != oldWidget.openLink ||
      shareImage != oldWidget.shareImage ||
      analytics != oldWidget.analytics ||
      billing != oldWidget.billing ||
      reminders != oldWidget.reminders ||
      sleepSync != oldWidget.sleepSync ||
      reviewPrompt != oldWidget.reviewPrompt ||
      homeWidget != oldWidget.homeWidget;
}
