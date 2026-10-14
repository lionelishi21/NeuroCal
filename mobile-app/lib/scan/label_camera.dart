import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:flutter/widgets.dart';
import 'package:google_mlkit_barcode_scanning/google_mlkit_barcode_scanning.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

/// A photo taken during live scan, with the text and product barcodes found in it.
typedef ScanFrame = ({Uint8List bytes, String text, List<String> barcodes});

/// The camera and on-device text recognition behind live scan. Behind an interface so widget tests
/// can run without a camera.
abstract class LabelCamera {
  /// Throws [LabelCameraDenied] when the person refused camera access.
  Future<void> start();

  /// The live preview, once [start] has finished.
  Widget preview();

  Future<ScanFrame> capture();

  Future<void> setTorch(bool on);

  Future<void> dispose();
}

class LabelCameraDenied implements Exception {
  const LabelCameraDenied();
}

/// The back camera at 1080p, with Google ML Kit reading text on the device. Nothing leaves the phone
/// until the person's scan is sent for reading.
class DeviceLabelCamera implements LabelCamera {
  CameraController? _controller;
  final _recognizer = TextRecognizer(script: TextRecognitionScript.latin);
  final _barcodes = BarcodeScanner(formats: [BarcodeFormat.ean13, BarcodeFormat.ean8, BarcodeFormat.upca, BarcodeFormat.upce]);

  @override
  Future<void> start() async {
    final cameras = await availableCameras();
    final back = cameras.firstWhere((c) => c.lensDirection == CameraLensDirection.back, orElse: () => cameras.first);
    final controller = CameraController(back, ResolutionPreset.veryHigh, enableAudio: false, imageFormatGroup: ImageFormatGroup.jpeg);
    try {
      await controller.initialize();
      await controller.setFocusMode(FocusMode.auto);
      await controller.setFlashMode(FlashMode.off);
    } on CameraException catch (e) {
      await controller.dispose();
      if (e.code.contains('AccessDenied') || e.code.contains('Restricted')) throw const LabelCameraDenied();
      rethrow;
    }
    _controller = controller;
  }

  @override
  Widget preview() => CameraPreview(_controller!);

  @override
  Future<ScanFrame> capture() async {
    final file = await _controller!.takePicture();
    final image = InputImage.fromFilePath(file.path);
    final (recognized, codes) = await (_recognizer.processImage(image), _barcodes.processImage(image)).wait;
    return (
      bytes: await file.readAsBytes(),
      text: recognized.text,
      barcodes: [for (final b in codes) ?b.rawValue],
    );
  }

  @override
  Future<void> setTorch(bool on) async => _controller?.setFlashMode(on ? FlashMode.torch : FlashMode.off);

  @override
  Future<void> dispose() async {
    await _controller?.dispose();
    _controller = null;
    await _recognizer.close();
    await _barcodes.close();
  }
}
