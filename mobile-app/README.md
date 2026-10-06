# NeuroCal mobile app (Flutter)

iOS and Android app with the same design as the web app: Plus Jakarta Sans, the NeuroCal tokens
(`lib/theme/tokens.dart` mirrors `web-poc/src/styles/tokens.css`), dark and light with a
**Match device / Light / Dark** switch (sign-in screen and Settings, saved on the device).

Screens: sign in / create account / confirm email, the 11-step bio-profile onboarding (for an
account without a profile), then four tabs: Today (Focus Score with its four signals, calories and
macros, how you feel, what to eat next, meals), This week (day picker, three charts, what could
help), Sleep and evenings (nights on one clock, what we noticed) and Settings. Log a meal, Check in,
Log sleep and Log screen time open as sheets.

## Build it on a Mac

One-time setup:

1. **Flutter** (3.47 or newer): `brew install --cask flutter`, or download from
   https://docs.flutter.dev/get-started/install/macos. Check with `flutter --version`.
2. **iOS:** install Xcode from the App Store, then
   `sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer && sudo xcodebuild -runFirstLaunch`
   and `brew install cocoapods`.
3. **Android:** install Android Studio, open it once so it installs the SDK, then
   `flutter doctor --android-licenses`.
4. `flutter doctor` should show ✓ for Flutter, Xcode and/or Android toolchain.

Then, from the repo root:

```sh
cd mobile-app
flutter pub get
open -a Simulator            # or start an emulator from Android Studio
flutter run                  # sample data and local sign-in (any email, code 123456)
flutter run --dart-define=MOCK_NEW_USER=true   # the same, starting without a profile, to see the onboarding
```

### Against the deployed backend

Copy the example settings and fill in the stack outputs (`ApiUrl`, `UserPoolId`, `UserPoolClientId`;
the same values as `web-poc/.env.local`):

```sh
cp env/dev.example.json env/dev.json   # env/*.json is gitignored
flutter run --dart-define-from-file=env/dev.json
```

Without `API_URL` the app uses the in-memory mock API (`lib/api/mock_api.dart`); without the two
Cognito values it uses the local mock sign-in (`lib/auth/auth.dart`), like the web app.

### Install on your own phone

- **iPhone:** `open ios/Runner.xcworkspace`, select the Runner target → Signing & Capabilities → pick
  your Apple ID team and change the bundle identifier if Xcode asks. Plug in the phone, then
  `flutter run --release --dart-define-from-file=env/dev.json`.
- **Android:** turn on USB debugging, plug in, `flutter run --release --dart-define-from-file=env/dev.json`,
  or build an APK with `flutter build apk --dart-define-from-file=env/dev.json`
  (`build/app/outputs/flutter-apk/app-release.apk`).

## Develop

```sh
flutter analyze
flutter test
dart format lib test tool
```

- `lib/main.dart` is the composition root: it picks the real or mock API and sign-in.
- `lib/api/models.dart` mirrors `packages/contracts`; change the contract first, then these.
- App icons: `flutter test tool/icon_test.dart --update-goldens && dart run flutter_launcher_icons`.
- Fonts: Plus Jakarta Sans, SIL Open Font License (`assets/fonts/OFL.txt`).
