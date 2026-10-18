import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api/api.dart';
import 'api/mock_api.dart';
import 'app_scope.dart';
import 'auth/auth.dart';
import 'auth/cognito_auth.dart';
import 'billing/billing.dart';
import 'config.dart';
import 'health/sleep_sync.dart';
import 'reminders/reminders.dart';
import 'device_time_zone.dart';
import 'api/models.dart';
import 'screens/account.dart';
import 'screens/onboarding.dart';
import 'screens/home.dart';
import 'screens/paywall.dart';
import 'theme/theme.dart';
import 'theme/theme_controller.dart';
import 'theme/tokens.dart';
import 'widgets/toast.dart';

/// Composition root: picks the real or mock API and sign-in from the build settings (config.dart).
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Portrait only, like the native settings (AndroidManifest.xml, Info.plist): scanning and the
  // Brain speed check are built for an upright phone.
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  final prefs = await SharedPreferences.getInstance();
  final theme = ThemeController(prefs);
  final AuthClient auth = AppConfig.usesMockAuth
      ? MockAuthClient()
      : CognitoAuthClient(userPoolId: AppConfig.userPoolId, clientId: AppConfig.clientId);
  await auth.restore();
  final NeuroCalApi api = AppConfig.usesMockApi
      ? MockNeuroCalApi(newUser: AppConfig.mockNewUser)
      : HttpNeuroCalApi(baseUrl: AppConfig.apiUrl, token: auth.idToken);
  final revenueCatKey = Platform.isIOS ? AppConfig.revenueCatIosKey : AppConfig.revenueCatAndroidKey;
  // Test mode starts locked, so the paywall shows; its "purchase" is free and instant.
  final Billing billing = revenueCatKey.isEmpty ? MockBilling() : RevenueCatBilling(revenueCatKey);
  final device = DeviceReminders();
  final reminders = ReminderSettings(prefs, device);
  // Ready before the first frame, so a tapped reminder that started the app opens the check-in.
  await device.start().catchError((Object _) {});
  // Again at every launch: the phone may have changed time zone, or the app was updated.
  reminders.restore().catchError((Object _) {});
  final sleepSync = SleepSync(prefs, HealthSleepSource());
  sleepSync.start();
  runApp(NeuroCalApp(api: api, auth: auth, theme: theme, billing: billing, reminders: reminders, sleepSync: sleepSync));
}

/// Tests and previews: already subscribed, so the paywall stays out of the way.
final _unlocked = MockBilling(active: true);

/// In the person's browser, not inside the app: product pages are other companies' sites.
Future<void> _shareOutside(Uint8List png, String text) => SharePlus.instance.share(
  ShareParams(files: [XFile.fromData(png, mimeType: 'image/png')], fileNameOverrides: ['neurocal-focus-score.png'], text: text),
);

Future<bool> _openOutside(Uri link) => launchUrl(link, mode: LaunchMode.externalApplication);

/// The app's navigator, so pages opened on top (Me, a sheet) close when the session ends.
final _navigator = GlobalKey<NavigatorState>();

class NeuroCalApp extends StatelessWidget {
  const NeuroCalApp({
    super.key,
    required this.api,
    required this.auth,
    required this.theme,
    this.timeZone = deviceTimeZone,
    this.openLink = _openOutside,
    this.shareImage = _shareOutside,
    this.billing,
    this.reminders,
    this.sleepSync,
  });

  final NeuroCalApi api;
  final AuthClient auth;
  final ThemeController theme;
  final Future<String?> Function() timeZone;
  final Future<bool> Function(Uri link) openLink;
  final Future<void> Function(Uint8List png, String text) shareImage;

  /// Subscriptions; unlocked test billing when left out.
  final Billing? billing;

  /// Check-in reminders; none when left out.
  final ReminderSettings? reminders;

  /// Sleep from the phone's health store; none when left out.
  final SleepSync? sleepSync;

  @override
  Widget build(BuildContext context) {
    return AppScope(
      api: api,
      auth: auth,
      theme: theme,
      timeZone: timeZone,
      openLink: openLink,
      shareImage: shareImage,
      billing: billing ?? _unlocked,
      reminders: reminders,
      sleepSync: sleepSync,
      child: ValueListenableBuilder(
        valueListenable: theme,
        builder: (context, mode, _) => MaterialApp(
          navigatorKey: _navigator,
          title: 'NeuroCal',
          debugShowCheckedModeBanner: false,
          theme: buildTheme(Brightness.light),
          darkTheme: buildTheme(Brightness.dark),
          themeMode: mode,
          builder: (context, child) => ToastHost(child: child!),
          // Signed out → account screens; signed in → onboarding or the tabs. Rebuilds when the session changes.
          home: ListenableBuilder(
            listenable: auth,
            builder: (context, _) {
              if (!auth.signedIn) WidgetsBinding.instance.addPostFrameCallback((_) => _navigator.currentState?.popUntil((r) => r.isFirst));
              return auth.signedIn ? _SignedIn(key: ValueKey(auth.email)) : const AccountScreen();
            },
          ),
        ),
      ),
    );
  }
}

/// Signed in: the onboarding for an account without a profile, otherwise the main screens.
class _SignedIn extends StatefulWidget {
  const _SignedIn({super.key});

  @override
  State<_SignedIn> createState() => _SignedInState();
}

class _SignedInState extends State<_SignedIn> {
  Future<Profile?>? _profile;
  Billing? _billing;
  ReminderSettings? _reminders;

  /// Whether the subscription or trial gives access, per profile loaded.
  final _access = <Profile, Future<bool>>{};

  /// Set when onboarding finishes, so Home opens "How NeuroCal works" once.
  var _justOnboarded = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _profile ??= AppScope.of(context).api.me();
    _billing = AppScope.of(context).billing;
    _reminders = AppScope.of(context).reminders;
  }

  @override
  void dispose() {
    // Signed out: purchases on this device stop following that account.
    _billing?.signOut().catchError((Object _) {});
    // And no reminders for an account that isn't here.
    _reminders?.clear().catchError((Object _) {});
    super.dispose();
  }

  /// Ties purchases to the account, then checks for access. If the store can't be reached the app stays
  /// open: the API still refuses its paid features to anyone without a subscription.
  Future<bool> _hasAccess(Profile profile) async {
    final billing = _billing!;
    try {
      if (profile.id != null) await billing.signIn(profile.id!);
      return await billing.isActive();
    } catch (_) {
      return true;
    }
  }

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    return FutureBuilder(
      future: _profile,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        if (snapshot.hasError) {
          return Scaffold(
            body: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(Space.s5),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text("Your profile didn't load.", style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: Space.s2),
                    const Text('Check your connection and try again.'),
                    const SizedBox(height: Space.s5),
                    FilledButton(
                      onPressed: () => setState(() {
                        _profile = scope.api.me();
                      }),
                      child: const Text('Try again'),
                    ),
                    TextButton(onPressed: scope.auth.signOut, child: const Text('Sign out')),
                  ],
                ),
              ),
            ),
          );
        }
        if (snapshot.data == null) {
          return OnboardingScreen(
            onDone: (profile) => setState(() {
              _profile = Future.value(profile);
              _justOnboarded = true;
            }),
          );
        }
        final profile = snapshot.data!;
        return FutureBuilder(
          future: _access[profile] ??= _hasAccess(profile),
          builder: (context, access) {
            if (!access.hasData) return const Scaffold(body: Center(child: CircularProgressIndicator()));
            if (access.data!) return HomeScreen(profile: profile, showGuide: _justOnboarded);
            return PaywallScreen(
              profile: profile,
              billing: scope.billing,
              // A block, not an arrow: setState must not return the Future being stored.
              onUnlocked: () => setState(() {
                _access[profile] = Future.value(true);
              }),
            );
          },
        );
      },
    );
  }
}
