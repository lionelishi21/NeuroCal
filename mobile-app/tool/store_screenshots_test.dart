// Run as a test, like tool/icon_test.dart: sample preferences are set the way tests set them.
// ignore_for_file: invalid_use_of_visible_for_testing_member

import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/main.dart';
import 'package:neurocal/screens/food_scan_sheet.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../test/supplement_test.dart' show FakeLabelCamera, back, front, side;

// Regenerate: flutter test tool/store_screenshots_test.dart --update-goldens
// The store screenshots: the app on its sample data at iPhone size, in a phone on the night backdrop
// with one line of the hook each. Written to store/ios (1290 × 2796, App Store 6.7") and store/play
// (1080 × 1920, Google Play).

/// The phone the app is drawn on: an iPhone 15 Pro in points, with its status bar.
const _phone = Size(393, 852);
const _statusBar = 54.0;
const _night = Color(0xFF0C1324);

/// Store canvases in points, drawn at 3×.
const _canvases = {'ios': Size(430, 932), 'play': Size(360, 640)};

Future<void> _font(String family, List<String> files) async {
  final loader = FontLoader(family);
  for (final f in files) {
    loader.addFont(Future.value(ByteData.sublistView(File(f).readAsBytesSync())));
  }
  await loader.load();
}

/// A screenshot of whatever is on the phone now.
Future<ui.Image> _capture(WidgetTester tester, GlobalKey key) async {
  final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
  return (await tester.runAsync(() => boundary.toImage(pixelRatio: 3)))!;
}

/// The phone at its size, with room at the top for the status bar the frame draws.
void _usePhone(WidgetTester tester) {
  tester.view.physicalSize = _phone * 3;
  tester.view.devicePixelRatio = 3;
  tester.view.padding = const FakeViewPadding(top: _statusBar * 3, bottom: 34 * 3);
}

/// One store screenshot: the line of the hook, what it means, and the phone.
Widget _frame({required String title, required String detail, required ui.Image screen}) => Directionality(
  textDirection: TextDirection.ltr,
  child: LayoutBuilder(
    builder: (context, box) {
      final small = box.maxWidth < 400;
      return Container(
        decoration: const BoxDecoration(
          color: _night,
          gradient: RadialGradient(
            center: Alignment(0.3, 0.55),
            radius: 0.9,
            colors: [Color(0x332EC4B6), Color(0x225B7CFA), _night],
            stops: [0, 0.45, 1],
          ),
        ),
        padding: EdgeInsets.fromLTRB(small ? 24 : 30, small ? 28 : 56, small ? 24 : 30, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                fontFamily: 'PlusJakartaSans',
                fontSize: small ? 27 : 34,
                height: 1.1,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.6,
                color: Colors.white,
              ),
            ),
            SizedBox(height: small ? 8 : 12),
            Text(
              detail,
              style: TextStyle(fontFamily: 'PlusJakartaSans', fontSize: small ? 13.5 : 16.5, height: 1.4, fontWeight: FontWeight.w500, color: const Color(0xFFB9C1DA)),
            ),
            SizedBox(height: small ? 20 : 32),
            Expanded(
              child: LayoutBuilder(
                builder: (context, room) {
                  // The phone runs off the bottom edge, as store screenshots usually do.
                  final width = (room.maxWidth * (small ? 0.78 : 0.86)).clamp(0.0, 360.0);
                  final scale = width / _phone.width;
                  return Stack(
                    clipBehavior: Clip.hardEdge,
                    children: [
                      Positioned(
                        top: 0,
                        left: (room.maxWidth - width) / 2,
                        width: width,
                        height: _phone.height * scale,
                        child: _PhoneShell(screen: screen, scale: scale),
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      );
    },
  ),
);

class _PhoneShell extends StatelessWidget {
  const _PhoneShell({required this.screen, required this.scale});

  final ui.Image screen;
  final double scale;

  @override
  Widget build(BuildContext context) {
    const ink = Color(0xFF151A2D);
    return Container(
      padding: EdgeInsets.all(7 * scale),
      decoration: BoxDecoration(
        color: const Color(0xFF05080F),
        borderRadius: BorderRadius.circular(54 * scale),
        border: Border.all(color: const Color(0xFF2A3150), width: 2 * scale),
        boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 40, offset: Offset(0, 18))],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(47 * scale),
        child: Stack(
          fit: StackFit.expand,
          children: [
            RawImage(image: screen, fit: BoxFit.cover, alignment: Alignment.topCenter),
            // The status bar, drawn over the room the app left for it.
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: _statusBar * scale,
              child: Padding(
                padding: EdgeInsets.fromLTRB(34 * scale, 14 * scale, 28 * scale, 0),
                child: Row(
                  children: [
                    Text('9:41', style: TextStyle(fontFamily: 'PlusJakartaSans', fontSize: 16 * scale, fontWeight: FontWeight.w700, color: ink)),
                    const Spacer(),
                    Icon(Icons.signal_cellular_alt_rounded, size: 17 * scale, color: ink),
                    SizedBox(width: 5 * scale),
                    Icon(Icons.wifi_rounded, size: 17 * scale, color: ink),
                    SizedBox(width: 5 * scale),
                    Icon(Icons.battery_full_rounded, size: 19 * scale, color: ink),
                  ],
                ),
              ),
            ),
            // The Dynamic Island.
            Positioned(
              top: 11 * scale,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  width: 120 * scale,
                  height: 35 * scale,
                  decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(20 * scale)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Writes [screen] framed with its line, for each store.
Future<void> _write(WidgetTester tester, String name, String title, String detail, ui.Image screen) async {
  for (final MapEntry(key: store, value: canvas) in _canvases.entries) {
    // Golden files are written at 1x, so the frame is laid out in points and scaled up to store pixels.
    tester.view.physicalSize = canvas * 3;
    tester.view.devicePixelRatio = 1;
    tester.view.resetPadding();
    await tester.pumpWidget(
      RepaintBoundary(
        child: FittedBox(
          fit: BoxFit.fill,
          child: SizedBox.fromSize(size: canvas, child: _frame(title: title, detail: detail, screen: screen)),
        ),
      ),
    );
    await tester.pump();
    await expectLater(find.byType(RepaintBoundary).first, matchesGoldenFile('../store/$store/$name.png'));
  }
}

/// The sample account, with the answers and weight goal that fill Your plan.
Future<MockNeuroCalApi> _sampleApi(WidgetTester tester) async {
  final api = MockNeuroCalApi()..latency = Duration.zero;
  final started = DateTime.now().subtract(const Duration(days: 21));
  await tester.runAsync(() async {
    await api.saveProfile({
      // Late screens and a phone by the bed: a believable starting point with room to grow.
      'bioProfile': {'eveningScreens': '3_plus', 'phoneAtNight': 'next_to_head', 'movement': 'none', 'fasting': '16_8', 'friction': 'afternoon_crash', 'wake': '6_to_8'},
      'weightGoal': {'startKg': 95, 'targetKg': 85, 'startedOn': isoDate(started), 'pacePctPerWeek': 0.75, 'fastingCaution': false},
    });
    // Three weeks of weigh-ins, down about 0.12 kg a day with the usual water swings.
    for (var i = 21; i >= 1; i--) {
      final swing = const [0.3, -0.2, 0.1, -0.3, 0.2, 0.0, -0.1][i % 7];
      await api.logWeight(95 - (21 - i) * 0.12 + swing, date: isoDate(DateTime.now().subtract(Duration(days: i))));
    }
  });
  return api;
}

/// The app, signed in on Today.
Future<GlobalKey> _openApp(WidgetTester tester, MockNeuroCalApi api) async {
  _usePhone(tester);
  // The 3-week challenge, started at "Hold to commit" eight days ago.
  SharedPreferences.setMockInitialValues({'weightUnit': 'kg', 'challenge.start.u1': isoDate(DateTime.now().subtract(const Duration(days: 8)))});
  final key = GlobalKey();
  await tester.pumpWidget(
    RepaintBoundary(
      key: key,
      child: NeuroCalApp(api: api, auth: MockAuthClient(), theme: ThemeController(await SharedPreferences.getInstance()), openLink: (_) async => true),
    ),
  );
  await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'sam@example.com');
  await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'correct-horse');
  await tester.ensureVisible(find.widgetWithText(FilledButton, 'Sign in'));
  await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
  await tester.pumpAndSettle();
  return key;
}

Future<void> _show(WidgetTester tester, Finder finder, {double alignment = 0.1}) async {
  await tester.scrollUntilVisible(finder, 300);
  await Scrollable.ensureVisible(tester.element(finder), alignment: alignment);
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() async {
    await _font('PlusJakartaSans', [for (final w in [400, 500, 600, 700, 800]) 'assets/fonts/PlusJakartaSans-$w.ttf']);
    final fonts = '${Platform.environment['FLUTTER_ROOT']}/bin/cache/artifacts/material_fonts';
    await _font('MaterialIcons', ['$fonts/MaterialIcons-Regular.otf']);
    // Buttons take Material's own face.
    await _font('Roboto', ['$fonts/Roboto-Regular.ttf', '$fonts/Roboto-Medium.ttf', '$fonts/Roboto-Bold.ttf']);
  });

  testWidgets('1 Today', (tester) async {
    final key = await _openApp(tester, await _sampleApi(tester));
    final screen = await _capture(tester, key);
    await _write(tester, '1_today', 'Lose weight and think clearer', 'One Focus Score each morning, from your sleep, food, stress and movement.', screen);
  });

  testWidgets('2 Your plan', (tester) async {
    final key = await _openApp(tester, await _sampleApi(tester));
    await _show(tester, find.text('Your plan'), alignment: 0.02);
    final screen = await _capture(tester, key);
    await _write(tester, '2_plan', 'Watch both goals move', 'Your Focus Score heading for its target, and your weight heading for yours.', screen);
  });

  testWidgets('3 Fasting', (tester) async {
    final key = await _openApp(tester, await _sampleApi(tester));
    await _show(tester, find.text('Fasting today? Plan a fast'));
    await tester.tap(find.text('Fasting today? Plan a fast'));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('Until noon tomorrow'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Start fasting'));
    await tester.pumpAndSettle();
    // Past the toast.
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Focus Score'), -300);
    await _show(tester, find.text('Planned fast'), alignment: 0.2);
    final screen = await _capture(tester, key);
    await _write(tester, '3_fasting', 'Fast your way', 'Plan a fast until noon tomorrow. Water and black coffee don’t break it.', screen);
  });

  testWidgets('4 Check in', (tester) async {
    final key = await _openApp(tester, await _sampleApi(tester));
    await tester.tap(find.bySemanticsLabel('Add'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Check in'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Calm'));
    await tester.tap(find.text('Sharp'));
    await tester.pumpAndSettle();
    final screen = await _capture(tester, key);
    await _write(tester, '4_check_in', 'Check in in ten seconds', 'Tap how you feel. NeuroCal links it to your sleep and food.', screen);
  });

  testWidgets('5 Food scan', (tester) async {
    // The fake camera's frames aren't pictures; their previews fail to decode and aren't in the shot.
    final reportError = FlutterError.onError;
    FlutterError.onError = (details) {
      if (details.library != 'image resource service') reportError?.call(details);
    };
    _usePhone(tester);
    SharedPreferences.setMockInitialValues({});
    final key = GlobalKey();
    // One camera for both scans: an unknown barcode first, then three sides of the label.
    final camera = FakeLabelCamera([front, front, back, side], barcodes: ['99999999']);
    await tester.pumpWidget(
      RepaintBoundary(
        key: key,
        child: AppScope(
          api: MockNeuroCalApi()..latency = Duration.zero,
          auth: MockAuthClient(),
          theme: ThemeController(await SharedPreferences.getInstance()),
          timeZone: () async => 'Europe/London',
          openLink: (_) async => true,
          billing: MockBilling(active: true),
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: buildTheme(Brightness.light),
            home: Builder(
              builder: (context) => Scaffold(
                body: Center(child: TextButton(onPressed: () => showFoodScanSheet(context, camera: () => camera), child: const Text('Open'))),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    for (final button in ['Start scanning', 'Scan the label']) {
      await tester.tap(find.text(button));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      for (var i = 0; i < 3; i++) {
        await tester.pump(const Duration(milliseconds: 700));
      }
      await tester.pumpAndSettle();
    }
    await _show(tester, find.text('Find a better choice'), alignment: 0.6);
    await tester.tap(find.text('Find a better choice'));
    await tester.pumpAndSettle();
    await _show(tester, find.text('A better choice'), alignment: 0.05);
    final screen = await _capture(tester, key);
    await _write(tester, '5_food_scan', 'See what’s really in your food', 'Scan a package for additives and sugar, and get a cleaner swap you can make.', screen);
    FlutterError.onError = reportError;
  });

  testWidgets('6 Move', (tester) async {
    final key = await _openApp(tester, await _sampleApi(tester));
    await tester.tap(find.bySemanticsLabel('Add'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Log exercise'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Walk'));
    await tester.pump(const Duration(milliseconds: 300));
    final screen = await _capture(tester, key);
    await _write(tester, '6_move', 'Move, with a guide', 'Log a walk in two taps, or follow a five-minute routine at your desk.', screen);
    await tester.pumpAndSettle();
  });
}
