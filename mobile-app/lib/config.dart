/// Build-time settings, passed with `--dart-define-from-file=env/dev.json` (see README).
/// Without them the app runs on the in-memory mock API and mock sign-in, like the web app.
abstract final class AppConfig {
  /// The stack's ApiUrl output, e.g. https://abc123.execute-api.us-east-1.amazonaws.com
  static const apiUrl = String.fromEnvironment('API_URL');

  /// The stack's UserPoolId and UserPoolClientId outputs.
  static const userPoolId = String.fromEnvironment('COGNITO_USER_POOL_ID');
  static const clientId = String.fromEnvironment('COGNITO_CLIENT_ID');

  /// With the mock API: start without a profile, to see the onboarding (`--dart-define=MOCK_NEW_USER=true`).
  static const mockNewUser = bool.fromEnvironment('MOCK_NEW_USER');

  /// RevenueCat's public SDK keys, one per store. Without them, test-mode billing is used.
  static const revenueCatIosKey = String.fromEnvironment('REVENUECAT_IOS_KEY');
  static const revenueCatAndroidKey = String.fromEnvironment('REVENUECAT_ANDROID_KEY');

  /// PostHog project key and host for product analytics. Without the key nothing is sent.
  static const posthogKey = String.fromEnvironment('POSTHOG_KEY');
  static const posthogHost = String.fromEnvironment('POSTHOG_HOST', defaultValue: 'https://us.i.posthog.com');

  /// Sentry DSN for crash and error reports, and the environment they're filed under. Without the DSN
  /// nothing is sent.
  static const sentryDsn = String.fromEnvironment('SENTRY_DSN');
  static const sentryEnvironment = String.fromEnvironment('SENTRY_ENVIRONMENT', defaultValue: 'dev');

  static bool get usesMockApi => apiUrl.isEmpty;
  static bool get usesMockAuth => userPoolId.isEmpty || clientId.isEmpty;
}
