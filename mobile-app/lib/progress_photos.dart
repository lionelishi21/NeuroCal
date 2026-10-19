import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

/// One progress photo: when it was taken and its bytes' location.
typedef ProgressPhoto = ({String id, DateTime takenAt});

/// Progress photos, kept on the phone only: never uploaded, never sent to the AI, and gone with the
/// app. Named by the time they were taken, so the list needs no index file.
abstract interface class ProgressPhotoStore {
  /// Oldest first.
  Future<List<ProgressPhoto>> list();
  Future<ProgressPhoto> add(Uint8List bytes, {DateTime? takenAt});
  Future<Uint8List?> read(String id);
  Future<void> delete(String id);
}

/// Files in the app's own documents folder (`progress_photos/<millis>.jpg`).
class FileProgressPhotoStore implements ProgressPhotoStore {
  FileProgressPhotoStore([this._root]);

  Directory? _root;

  Future<Directory> _dir() async {
    final dir = _root ??= Directory('${(await getApplicationDocumentsDirectory()).path}/progress_photos');
    if (!await dir.exists()) await dir.create(recursive: true);
    return dir;
  }

  static final _name = RegExp(r'^(\d+)\.jpg$');

  @override
  Future<List<ProgressPhoto>> list() async {
    final photos = <ProgressPhoto>[];
    await for (final f in (await _dir()).list()) {
      final m = _name.firstMatch(f.uri.pathSegments.last);
      if (m != null) photos.add((id: m[1]!, takenAt: DateTime.fromMillisecondsSinceEpoch(int.parse(m[1]!))));
    }
    return photos..sort((a, b) => a.takenAt.compareTo(b.takenAt));
  }

  @override
  Future<ProgressPhoto> add(Uint8List bytes, {DateTime? takenAt}) async {
    var at = takenAt ?? DateTime.now();
    final dir = await _dir();
    // Two photos in the same millisecond keep both.
    while (await File('${dir.path}/${at.millisecondsSinceEpoch}.jpg').exists()) {
      at = at.add(const Duration(milliseconds: 1));
    }
    await File('${dir.path}/${at.millisecondsSinceEpoch}.jpg').writeAsBytes(bytes, flush: true);
    return (id: '${at.millisecondsSinceEpoch}', takenAt: at);
  }

  @override
  Future<Uint8List?> read(String id) async {
    final f = File('${(await _dir()).path}/$id.jpg');
    return await f.exists() ? f.readAsBytes() : null;
  }

  @override
  Future<void> delete(String id) async {
    final f = File('${(await _dir()).path}/$id.jpg');
    if (await f.exists()) await f.delete();
  }
}

/// Tests and previews.
class MemoryProgressPhotoStore implements ProgressPhotoStore {
  final _photos = <String, (DateTime, Uint8List)>{};

  @override
  Future<List<ProgressPhoto>> list() async =>
      [for (final e in _photos.entries) (id: e.key, takenAt: e.value.$1)]..sort((a, b) => a.takenAt.compareTo(b.takenAt));

  @override
  Future<ProgressPhoto> add(Uint8List bytes, {DateTime? takenAt}) async {
    final at = takenAt ?? DateTime.now();
    final id = '${at.millisecondsSinceEpoch}';
    _photos[id] = (at, bytes);
    return (id: id, takenAt: at);
  }

  @override
  Future<Uint8List?> read(String id) async => _photos[id]?.$2;

  @override
  Future<void> delete(String id) async => _photos.remove(id);
}
