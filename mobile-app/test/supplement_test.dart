import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/scan/label_camera.dart';
import 'package:neurocal/screens/supplement_sheet.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Hands back a fixed "photo" instead of opening the camera.
class FakePicker extends ImagePicker {
  FakePicker(this.name);

  final String name;

  @override
  Future<XFile?> pickImage({
    required ImageSource source,
    double? maxWidth,
    double? maxHeight,
    int? imageQuality,
    CameraDevice preferredCameraDevice = CameraDevice.rear,
    bool requestFullMetadata = true,
  }) async => XFile.fromData(Uint8List.fromList([0xff, 0xd8, 0xff]), name: name, path: name, mimeType: 'image/jpeg');
}

/// A camera that "sees" each text in turn, one per frame, then repeats the last.
class FakeLabelCamera implements LabelCamera {
  FakeLabelCamera(this.texts, {this.denied = false, this.barcodes = const []});

  final List<String> texts;
  final bool denied;

  /// Barcodes "seen" in every frame.
  final List<String> barcodes;
  var frames = 0;
  var disposed = false;

  @override
  Future<void> start() async {
    if (denied) throw const LabelCameraDenied();
  }

  @override
  Widget preview() => const ColoredBox(color: Colors.black);

  @override
  Future<ScanFrame> capture() async {
    final text = texts[frames < texts.length ? frames : texts.length - 1];
    frames++;
    return (bytes: onePixelPng, text: text, barcodes: barcodes);
  }

  @override
  Future<void> setTorch(bool on) async {}

  @override
  Future<void> dispose() async => disposed = true;
}

/// A real image, so the thumbnails decode.
final onePixelPng = Uint8List.fromList(const [
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  0x00,
  0x00,
  0x00,
  0x0d,
  0x49,
  0x48,
  0x44,
  0x52,
  0x00,
  0x00,
  0x00,
  0x01,
  0x00,
  0x00,
  0x00,
  0x01,
  0x08,
  0x06,
  0x00,
  0x00,
  0x00,
  0x1f,
  0x15,
  0xc4,
  0x89,
  0x00,
  0x00,
  0x00,
  0x0d,
  0x49,
  0x44,
  0x41,
  0x54,
  0x78,
  0x9c,
  0x63,
  0x00,
  0x01,
  0x00,
  0x00,
  0x05,
  0x00,
  0x01,
  0x0d,
  0x0a,
  0x2d,
  0xb4,
  0x00,
  0x00,
  0x00,
  0x00,
  0x49,
  0x45,
  0x4e,
  0x44,
  0xae,
  0x42,
  0x60,
  0x82,
]);

const front = 'Supplement Facts Serving Size 2 capsules Amount per serving Magnesium glycinate 200 mg Zinc 15 mg';
const back =
    'Other ingredients rice flour vegetable cellulose capsule Distributed by Calm Labs lot MG2405 expires 2027';
const side =
    'Directions take two capsules daily with food Warning keep out of reach of children consult physician pregnant';

Future<void> pumpSheet(WidgetTester tester, String photoName, {LabelCamera? camera}) async {
  await pumpSheetWithApi(tester, photoName, camera: camera);
}

Future<MockNeuroCalApi> pumpSheetWithApi(WidgetTester tester, String photoName, {LabelCamera? camera}) async {
  tester.view.physicalSize = const Size(360, 740);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({});
  final theme = ThemeController(await SharedPreferences.getInstance());
  final api = MockNeuroCalApi()..latency = Duration.zero;
  await tester.pumpWidget(
    AppScope(
      api: api,
      auth: MockAuthClient(),
      theme: theme,
      timeZone: () async => 'Europe/London',
      openLink: (_) async => true,
      billing: MockBilling(active: true),
      child: MaterialApp(
        theme: buildTheme(Brightness.light),
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => showSupplementSheet(
                context,
                picker: FakePicker(photoName),
                camera: () => camera ?? FakeLabelCamera([front]),
              ),
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Open'));
  await tester.pumpAndSettle();
  return api;
}

void main() {
  testWidgets('live scan keeps one photo per side as the bottle turns, then reads them together', (tester) async {
    final camera = FakeLabelCamera(['Supplement', front, front, back, back, side]);
    await pumpSheet(tester, 'unused.jpg', camera: camera);
    await tester.tap(find.text('Start live scan'));
    // Opening the page takes under a frame interval; then one frame every 700 ms.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Scan the label'), findsOneWidget);
    Future<void> nextFrame() => tester.pump(const Duration(milliseconds: 700));

    await nextFrame();
    expect(find.text('Move closer until the label text fills the frame.'), findsOneWidget);
    await nextFrame();
    expect(find.text('Side 1 captured. Keep turning the bottle.'), findsOneWidget);
    expect(find.text('Read the label'), findsOneWidget);
    await nextFrame();
    expect(find.text('Turn the bottle slowly to show the rest of the label.'), findsOneWidget);
    await nextFrame();
    expect(find.text('Read 2 photos'), findsOneWidget);
    await nextFrame();
    await nextFrame();
    // The third side fills the scan: it closes and reads the label on its own.
    await tester.pumpAndSettle();
    expect(find.text('Scan the label'), findsNothing);
    expect(camera.disposed, isTrue);
    expect(find.text('Calm Labs Magnesium Glycinate'), findsOneWidget);
  });

  testWidgets('without camera access it says so and the photo route stays open', (tester) async {
    await pumpSheet(tester, 'label.jpg', camera: FakeLabelCamera([front], denied: true));
    await tester.tap(find.text('Start live scan'));
    await tester.pumpAndSettle();
    expect(find.textContaining('NeuroCal needs the camera to scan a label.'), findsOneWidget);
    await tester.tap(find.text('Close'));
    await tester.pumpAndSettle();
    expect(find.text('Choose a photo'), findsOneWidget);
  });

  testWidgets('a chosen photo shows what it says, the flags and a close match from our brand', (tester) async {
    await pumpSheet(tester, 'label.jpg');
    expect(find.text('Scan a supplement'), findsOneWidget);

    await tester.tap(find.text('Choose a photo'));
    await tester.pumpAndSettle();

    expect(find.text('Calm Labs Magnesium Glycinate'), findsOneWidget);
    expect(find.textContaining('Hidden doses.'), findsOneWidget);
    expect(find.textContaining('High dose.'), findsOneWidget);
    expect(find.textContaining('Not independently tested.'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('In the blend').first, 200);
    expect(find.text('200 mg'), findsOneWidget);
    expect(find.text('In the blend'), findsNWidgets(2));
    await tester.scrollUntilVisible(find.text('MitoProof Magnesium Glycinate'), 200);
    expect(find.text('Our brand'), findsOneWidget);
    expect(find.textContaining("isn't a verdict on the product"), findsOneWidget);

    await tester.scrollUntilVisible(find.text('Scan another label'), 200);
    await tester.tap(find.text('Scan another label'));
    await tester.pumpAndSettle();
    expect(find.text('Start live scan'), findsOneWidget);
  });

  testWidgets('an unreadable photo says why and offers to take it again', (tester) async {
    await pumpSheet(tester, 'dark-label.jpg');
    await tester.tap(find.text('Choose a photo'));
    await tester.pumpAndSettle();
    expect(find.textContaining('The label is too dark to read.'), findsOneWidget);
    expect(find.text('Scan again'), findsOneWidget);
  });

  testWidgets('a scanned label goes into the stack with servings, timing and the bottle size from the label', (
    tester,
  ) async {
    final api = await pumpSheetWithApi(tester, 'label.jpg');
    await tester.tap(find.text('Choose a photo'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Add to my stack'), 200);
    await tester.tap(find.text('Add to my stack'));
    await tester.pumpAndSettle();

    expect(find.text('Servings a day (one is 2 capsules)'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'Servings in the bottle (optional)'), findsOneWidget);
    expect(find.text('60'), findsOneWidget); // from the label
    await tester.tap(find.text('2'));
    await tester.tap(find.text('Evening'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Add to my stack'));
    await tester.tap(find.widgetWithText(FilledButton, 'Add to my stack'));
    await tester.pumpAndSettle();

    final stack = (await tester.runAsync(api.stack))!;
    expect(stack.items.single.name, 'Calm Labs Magnesium Glycinate');
    expect(stack.items.single.servingsPerDay, 2);
    expect(stack.items.single.timing, StackTiming.evening);
    expect(stack.items.single.daysLeft, 30);
  });
}
