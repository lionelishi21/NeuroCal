import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/progress_photos.dart';
import 'package:neurocal/screens/progress_photos_view.dart';
import 'package:neurocal/theme/theme.dart';

/// A 1 × 1 PNG, so Image.memory has something real to decode.
final _png = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
);

Future<void> pump(WidgetTester tester, ProgressPhotoStore store) async {
  tester.view.physicalSize = const Size(360, 740);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      theme: buildTheme(Brightness.light),
      home: Scaffold(
        body: SingleChildScrollView(
          child: ProgressPhotosSection(store: store, weightOn: (day) => day.month == 9 ? '92.4 kg' : '88.6 kg'),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  test('the file store keeps photos by time, oldest first, and deletes them', () async {
    final dir = await Directory.systemTemp.createTemp('photos');
    addTearDown(() => dir.delete(recursive: true));
    final store = FileProgressPhotoStore(dir);
    final later = await store.add(_png, takenAt: DateTime(2026, 10, 18));
    final first = await store.add(_png, takenAt: DateTime(2026, 9, 3));
    final same = await store.add(_png, takenAt: DateTime(2026, 9, 3));
    expect([for (final p in await store.list()) p.id], [first.id, same.id, later.id]);
    expect(await store.read(first.id), _png);
    await store.delete(first.id);
    expect(await store.read(first.id), isNull);
    expect(await store.list(), hasLength(2));
  });

  testWidgets('no photos: says they stay on the phone, with both ways to add one', (tester) async {
    await pump(tester, MemoryProgressPhotoStore());
    expect(find.text('No photos yet'), findsOneWidget);
    expect(find.textContaining('never uploaded'), findsOneWidget);
    expect(find.text('Take a photo'), findsOneWidget);
    expect(find.text('Choose from photos'), findsOneWidget);
  });

  testWidgets('first and latest side by side with the weight then; delete takes two taps', (tester) async {
    final store = MemoryProgressPhotoStore();
    await store.add(_png, takenAt: DateTime(2026, 9, 3));
    await store.add(_png, takenAt: DateTime(2026, 10, 18));
    await tester.runAsync(() => pump(tester, store));
    await tester.pumpAndSettle();
    expect(find.text('First · 3 Sep · 92.4 kg'), findsOneWidget);
    expect(find.text('Latest · 18 Oct · 88.6 kg'), findsOneWidget);

    await tester.tap(find.text('First · 3 Sep · 92.4 kg'));
    await tester.pumpAndSettle();
    expect(find.text('3 Sep · 92.4 kg'), findsOneWidget);
    await tester.tap(find.text('Delete'));
    await tester.pumpAndSettle();
    expect(await store.list(), hasLength(2));
    await tester.tap(find.text('Tap again to delete'));
    await tester.pumpAndSettle();
    expect(await store.list(), hasLength(1));
    expect(find.textContaining('First ·'), findsNothing);
  });
}
