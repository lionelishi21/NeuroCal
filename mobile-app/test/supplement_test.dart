import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
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

Future<void> pumpSheet(WidgetTester tester, String photoName) async {
  tester.view.physicalSize = const Size(360, 740);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({});
  final theme = ThemeController(await SharedPreferences.getInstance());
  await tester.pumpWidget(
    AppScope(
      api: MockNeuroCalApi()..latency = Duration.zero,
      auth: MockAuthClient(),
      theme: theme,
      timeZone: () async => 'Europe/London',
      openLink: (_) async => true,
      child: MaterialApp(
        theme: buildTheme(Brightness.light),
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => showSupplementSheet(context, picker: FakePicker(photoName)),
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Open'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('a label photo shows what it says, the flags and a close match from our brand', (tester) async {
    await pumpSheet(tester, 'label.jpg');
    expect(find.text('Scan a supplement'), findsOneWidget);

    await tester.tap(find.text('Take a photo'));
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
    expect(find.text('Take a photo'), findsOneWidget);
  });

  testWidgets('an unreadable photo says why and offers to take it again', (tester) async {
    await pumpSheet(tester, 'dark-label.jpg');
    await tester.tap(find.text('Take a photo'));
    await tester.pumpAndSettle();
    expect(find.textContaining('The label is too dark to read.'), findsOneWidget);
    expect(find.text('Take it again'), findsOneWidget);
  });
}
