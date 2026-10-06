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

  static bool get usesMockApi => apiUrl.isEmpty;
  static bool get usesMockAuth => userPoolId.isEmpty || clientId.isEmpty;
}
