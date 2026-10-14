import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../scan/label_camera.dart';
import '../scan/scan_session.dart';
import '../theme/tokens.dart';

/// Keeps the scan's photos under what the API takes in one request.
const _maxScanBytes = 4 * 1024 * 1024;

/// What a live scan found: a product barcode (when asked to look for one), or label photos.
typedef LiveScanResult = ({String? barcode, List<Uint8List> photos});

/// Opens the camera full screen and keeps a sharp photo each time a new part of the label comes into
/// view, while the person turns the package. With [findBarcode], a product barcode in view ends the
/// scan at once. Null if they closed it.
Future<LiveScanResult?> showLiveScan(BuildContext context, LabelCamera camera, {bool findBarcode = false}) =>
    Navigator.of(context).push<LiveScanResult>(
      MaterialPageRoute(fullscreenDialog: true, builder: (_) => LiveScanPage(camera: camera, findBarcode: findBarcode)),
    );

class LiveScanPage extends StatefulWidget {
  const LiveScanPage({super.key, required this.camera, this.findBarcode = false, this.interval = const Duration(milliseconds: 700)});

  final LabelCamera camera;

  /// Food packages: a readable barcode finishes the scan, before any label photos are needed.
  final bool findBarcode;

  /// The pause between frames, so the preview stays smooth.
  final Duration interval;

  @override
  State<LiveScanPage> createState() => _LiveScanPageState();
}

enum _Stage { starting, scanning, denied, failed }

class _LiveScanPageState extends State<LiveScanPage> {
  final _session = ScanSession();
  final _photos = <Uint8List>[];
  var _stage = _Stage.starting;
  late var _status = widget.findBarcode
      ? 'Point the camera at the barcode, or at the nutrition label.'
      : 'Point the camera at the Supplement Facts panel.';
  var _torch = false;
  var _capturing = false;
  var _closed = false;

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void dispose() {
    _closed = true;
    widget.camera.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    try {
      await widget.camera.start();
    } on LabelCameraDenied {
      if (mounted) setState(() => _stage = _Stage.denied);
      return;
    } catch (_) {
      if (mounted) setState(() => _stage = _Stage.failed);
      return;
    }
    if (!mounted) return;
    setState(() => _stage = _Stage.scanning);
    unawaited(_loop());
  }

  Future<void> _loop() async {
    while (!_closed && !_session.full) {
      await Future<void>.delayed(widget.interval);
      if (_closed) return;
      await _frame(manual: false);
    }
  }

  Future<void> _frame({required bool manual}) async {
    if (_capturing || _closed) return;
    _capturing = true;
    try {
      final frame = await widget.camera.capture();
      if (_closed) return;
      if (widget.findBarcode && frame.barcodes.isNotEmpty) {
        unawaited(HapticFeedback.mediumImpact());
        _closed = true;
        if (mounted) Navigator.of(context).pop<LiveScanResult>((barcode: frame.barcodes.first, photos: const []));
        return;
      }
      final words = labelWords(frame.text);
      final verdict = manual ? FrameVerdict.keep : _session.consider(words);
      if (manual) _session.keepAnyway(words);
      setState(() {
        switch (verdict) {
          case FrameVerdict.tooLittleText:
            _status = 'Move closer until the label text fills the frame.';
          case FrameVerdict.alreadySeen:
            _status = 'Turn the bottle slowly to show the rest of the label.';
          case FrameVerdict.keep:
            _photos.add(frame.bytes);
            _status = _session.full ? "That's the whole label." : 'Side ${_photos.length} captured. Keep turning the bottle.';
        }
      });
      if (verdict == FrameVerdict.keep) {
        unawaited(HapticFeedback.mediumImpact());
        final total = _photos.fold<int>(0, (sum, p) => sum + p.length);
        if (_session.full || total >= _maxScanBytes) _finish();
      }
    } catch (_) {
      // A dropped frame is fine; the next one tries again.
    } finally {
      _capturing = false;
    }
  }

  void _finish() {
    if (_closed || _photos.isEmpty) return;
    _closed = true;
    Navigator.of(context).pop<LiveScanResult>((barcode: null, photos: List<Uint8List>.of(_photos)));
  }

  Future<void> _toggleTorch() async {
    final on = !_torch;
    setState(() => _torch = on);
    await widget.camera.setTorch(on).catchError((Object _) {});
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (_stage == _Stage.scanning) FittedBox(fit: BoxFit.cover, clipBehavior: Clip.hardEdge, child: SizedBox(width: 1080, height: 1920, child: widget.camera.preview())),
          if (_stage == _Stage.scanning)
            IgnorePointer(
              child: Center(
                child: FractionallySizedBox(
                  widthFactor: 0.82,
                  heightFactor: 0.5,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.white.withValues(alpha: 0.85), width: 2),
                      borderRadius: BorderRadius.circular(Radii.hero),
                    ),
                  ),
                ),
              ),
            ),
          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(Space.s2, Space.s2, Space.s2, 0),
                  child: Row(
                    children: [
                      IconButton(
                        tooltip: 'Close',
                        color: Colors.white,
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                      const Expanded(
                        child: Text(
                          'Scan the label',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.white, fontSize: TextSize.lg, fontWeight: FontWeight.w800),
                        ),
                      ),
                      IconButton(
                        tooltip: _torch ? 'Turn the light off' : 'Turn the light on',
                        color: Colors.white,
                        icon: Icon(_torch ? Icons.flashlight_on_rounded : Icons.flashlight_off_rounded),
                        onPressed: _stage == _Stage.scanning ? _toggleTorch : null,
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                Container(
                  margin: const EdgeInsets.all(Space.s3),
                  padding: const EdgeInsets.all(Space.s4),
                  decoration: BoxDecoration(color: c.paper, borderRadius: BorderRadius.circular(Radii.hero)),
                  child: switch (_stage) {
                    _Stage.starting => const _Panel(status: 'Starting the camera…'),
                    _Stage.denied => _Panel(
                      status: 'NeuroCal needs the camera to scan a label. Allow it in your phone\'s settings, or choose a photo instead.',
                      action: TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Close')),
                    ),
                    _Stage.failed => _Panel(
                      status: "The camera didn't start. Close this and choose a photo instead.",
                      action: TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Close')),
                    ),
                    _Stage.scanning => Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      spacing: Space.s3,
                      children: [
                        Semantics(
                          liveRegion: true,
                          child: Text(_status, style: const TextStyle(fontSize: TextSize.base, fontWeight: FontWeight.w700, height: 1.35)),
                        ),
                        Row(
                          spacing: Space.s2,
                          children: [
                            for (var i = 0; i < _session.maxFrames; i++)
                              Expanded(
                                child: Semantics(
                                  label: i < _photos.length ? 'Side ${i + 1} captured' : 'Side ${i + 1} not yet captured',
                                  child: AspectRatio(
                                    aspectRatio: 3 / 4,
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(Radii.option),
                                      child: i < _photos.length
                                          ? Image.memory(_photos[i], fit: BoxFit.cover, gaplessPlayback: true)
                                          : DecoratedBox(
                                              decoration: BoxDecoration(color: c.mist, border: Border.all(color: c.rule)),
                                              child: Center(
                                                child: Text('${i + 1}', style: TextStyle(color: c.inkFaint, fontWeight: FontWeight.w700)),
                                              ),
                                            ),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                        Row(
                          spacing: 10,
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                style: OutlinedButton.styleFrom(
                                  minimumSize: const Size.fromHeight(52),
                                  foregroundColor: c.synapseInk,
                                  side: BorderSide(color: c.ruleStrong, width: 1.5),
                                ),
                                onPressed: _session.full ? null : () => _frame(manual: true),
                                child: const Text('Take one now'),
                              ),
                            ),
                            Expanded(
                              child: FilledButton(
                                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                                onPressed: _photos.isEmpty ? null : _finish,
                                child: Text(_photos.length > 1 ? 'Read ${_photos.length} photos' : 'Read the label'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.status, this.action});

  final String status;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    spacing: Space.s2,
    children: [
      Semantics(
        liveRegion: true,
        child: Text(status, style: const TextStyle(fontSize: TextSize.base, fontWeight: FontWeight.w700, height: 1.35)),
      ),
      ?action,
    ],
  );
}
