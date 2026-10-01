import 'package:flutter/widgets.dart';

import 'api/api.dart';
import 'auth/auth.dart';
import 'theme/theme_controller.dart';

/// The app's services, wired once in main.dart (the composition root) and read by screens.
class AppScope extends InheritedWidget {
  const AppScope({super.key, required this.api, required this.auth, required this.theme, required super.child});

  final NeuroCalApi api;
  final AuthClient auth;
  final ThemeController theme;

  static AppScope of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!;

  @override
  bool updateShouldNotify(AppScope oldWidget) =>
      api != oldWidget.api || auth != oldWidget.auth || theme != oldWidget.theme;
}
