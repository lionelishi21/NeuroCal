import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../progress_photos.dart';
import '../theme/tokens.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
String _when(DateTime d) => '${d.day} ${_months[d.month - 1]}';

/// Progress photos on Progress → Body, under the weight trend: the first and the latest side by side,
/// every photo in a strip, and buttons to take or pick one. They stay on the phone.
class ProgressPhotosSection extends StatefulWidget {
  const ProgressPhotosSection({super.key, required this.store, this.weightOn, this.picker});

  final ProgressPhotoStore store;

  /// The weight on a day, formatted ("88.6 kg"), when one was logged near it.
  final String? Function(DateTime day)? weightOn;

  /// Tests pass a fake.
  final ImagePicker? picker;

  @override
  State<ProgressPhotosSection> createState() => _ProgressPhotosSectionState();
}

class _ProgressPhotosSectionState extends State<ProgressPhotosSection> {
  late Future<List<ProgressPhoto>> _photos = widget.store.list();
  late final _picker = widget.picker ?? ImagePicker();

  void _reload() => setState(() {
    _photos = widget.store.list();
  });

  Future<void> _add(ImageSource source) async {
    try {
      final file = await _picker.pickImage(source: source, maxWidth: 1600, imageQuality: 80);
      if (file == null) return;
      await widget.store.add(await file.readAsBytes());
      if (!mounted) return;
      _reload();
      showToast(context, 'Photo saved on this phone');
    } catch (_) {
      if (mounted) showToast(context, "Couldn't save that photo. Try again.", ToastTone.problem);
    }
  }

  Future<void> _open(List<ProgressPhoto> photos, int index) async {
    final deleted = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) =>
            _PhotoPage(store: widget.store, photo: photos[index], weight: widget.weightOn?.call(photos[index].takenAt)),
      ),
    );
    if (deleted == true && mounted) {
      _reload();
      showToast(context, 'Photo deleted');
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final actions = Wrap(
      spacing: Space.s2,
      runSpacing: Space.s2,
      children: [
        SoftButton(label: 'Take a photo', onPressed: () => _add(ImageSource.camera)),
        TextButton(onPressed: () => _add(ImageSource.gallery), child: const Text('Choose from photos')),
      ],
    );
    return FutureBuilder(
      future: _photos,
      builder: (context, snapshot) {
        final photos = snapshot.data ?? const <ProgressPhoto>[];
        if (snapshot.connectionState != ConnectionState.done) return const SizedBox(height: 120);
        if (photos.isEmpty) {
          return EmptyCard(
            title: 'No photos yet',
            detail: 'A photo every couple of weeks shows changes the scale misses. They stay on this phone and are never uploaded.',
            action: actions,
          );
        }
        return AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: Space.s3,
            children: [
              if (photos.length > 1)
                Row(
                  spacing: Space.s2,
                  children: [
                    for (final (label, i) in [('First', 0), ('Latest', photos.length - 1)])
                      Expanded(
                        child: _Tile(
                          store: widget.store,
                          photo: photos[i],
                          caption: '$label · ${_when(photos[i].takenAt)}',
                          weight: widget.weightOn?.call(photos[i].takenAt),
                          aspect: 3 / 4,
                          onTap: () => _open(photos, i),
                        ),
                      ),
                  ],
                ),
              SizedBox(
                height: 104,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  reverse: true,
                  itemCount: photos.length,
                  separatorBuilder: (_, _) => const SizedBox(width: Space.s2),
                  itemBuilder: (context, k) {
                    final i = photos.length - 1 - k;
                    return SizedBox(
                      width: 60,
                      child: _Tile(
                        store: widget.store,
                        photo: photos[i],
                        caption: _when(photos[i].takenAt),
                        aspect: 3 / 4,
                        onTap: () => _open(photos, i),
                      ),
                    );
                  },
                ),
              ),
              actions,
              Text(
                'Only on this phone: not uploaded, not backed up by NeuroCal, and deleted with the app.',
                style: TextStyle(fontSize: TextSize.xxs, height: 1.35, color: c.inkFaint),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.store,
    required this.photo,
    required this.caption,
    required this.aspect,
    required this.onTap,
    this.weight,
  });

  final ProgressPhotoStore store;
  final ProgressPhoto photo;
  final String caption;
  final String? weight;
  final double aspect;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      button: true,
      label: 'Progress photo, $caption${weight == null ? '' : ', $weight'}',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          spacing: 4,
          children: [
            AspectRatio(
              aspectRatio: aspect,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(Radii.control),
                child: ColoredBox(
                  color: c.mist,
                  child: FutureBuilder(
                    future: store.read(photo.id),
                    builder: (context, s) => s.data == null
                        ? const SizedBox.expand()
                        : Image.memory(s.data!, fit: BoxFit.cover, gaplessPlayback: true),
                  ),
                ),
              ),
            ),
            Text(
              weight == null ? caption : '$caption · $weight',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w600, color: c.inkSoft),
            ),
          ],
        ),
      ),
    );
  }
}

/// One photo, full screen, with its date and a two-tap delete (there's no copy anywhere else).
class _PhotoPage extends StatefulWidget {
  const _PhotoPage({required this.store, required this.photo, this.weight});

  final ProgressPhotoStore store;
  final ProgressPhoto photo;
  final String? weight;

  @override
  State<_PhotoPage> createState() => _PhotoPageState();
}

class _PhotoPageState extends State<_PhotoPage> {
  var _confirming = false;

  Future<void> _delete() async {
    if (!_confirming) {
      setState(() => _confirming = true);
      return;
    }
    await widget.store.delete(widget.photo.id);
    if (mounted) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.weight == null ? _when(widget.photo.takenAt) : '${_when(widget.photo.takenAt)} · ${widget.weight}',
        ),
        actions: [
          TextButton(
            onPressed: _delete,
            child: Text(_confirming ? 'Tap again to delete' : 'Delete', style: TextStyle(color: c.beet)),
          ),
        ],
      ),
      body: FutureBuilder(
        future: widget.store.read(widget.photo.id),
        builder: (context, s) => s.data == null
            ? const SizedBox.expand()
            : InteractiveViewer(
                child: Center(child: Image.memory(s.data!, fit: BoxFit.contain)),
              ),
      ),
    );
  }
}
