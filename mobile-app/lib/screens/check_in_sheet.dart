import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/feeling_face.dart';
import '../widgets/sheet.dart';

/// "How do you feel right now?" Pick one or more feelings, each a card with its face, with an optional
/// note. Returns true when saved.
Future<bool?> showCheckInSheet(BuildContext context) =>
    showAppSheet<bool>(context, title: 'Check in', builder: (_) => const _CheckIn());

class _CheckIn extends StatefulWidget {
  const _CheckIn();

  @override
  State<_CheckIn> createState() => _CheckInState();
}

class _CheckInState extends State<_CheckIn> {
  final _picked = <CognitiveFlag>{};
  final _note = TextEditingController();
  var _busy = false;
  var _failed = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _failed = false;
    });
    try {
      final note = _note.text.trim();
      await AppScope.of(context).api.checkIn(_picked.toList(), note: note.isEmpty ? null : note);
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _failed = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        Text(
          'How do you feel right now? Pick any.',
          style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
        ),
        // Four across, so seven feelings sit in two rows; the good ones come first.
        LayoutBuilder(
          builder: (context, box) => Wrap(
            spacing: Space.s2,
            runSpacing: Space.s2,
            children: [
              for (final flag in CognitiveFlag.values)
                SizedBox(
                  width: (box.maxWidth - 3 * Space.s2) / 4,
                  child: _FeelingCard(
                    flag,
                    selected: _picked.contains(flag),
                    onTap: () => setState(() => _picked.contains(flag) ? _picked.remove(flag) : _picked.add(flag)),
                  ),
                ),
            ],
          ),
        ),
        TextField(
          controller: _note,
          maxLines: 3,
          maxLength: 280,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(
            labelText: 'Note (optional)',
            hintText: 'e.g. Rough meeting, skipped lunch',
            alignLabelWithHint: true,
            counterText: '',
          ),
        ),
        if (_failed)
          const SheetNote(lead: "Couldn't save your check-in.", detail: 'Check your connection and try again.'),
        SheetAction(label: _busy ? 'Saving…' : 'Save check-in', onPressed: _busy || _picked.isEmpty ? null : _save),
      ],
    );
  }
}

/// One feeling to pick: its face over its name. Picked, it fills in and gets a tick.
class _FeelingCard extends StatelessWidget {
  const _FeelingCard(this.flag, {required this.selected, required this.onTap});

  final CognitiveFlag flag;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(Radii.option),
      side: BorderSide(color: selected ? c.synapse : c.rule, width: selected ? 2 : 1.5),
    );
    return Semantics(
      button: true,
      selected: selected,
      label: flag.label,
      excludeSemantics: true,
      child: Material(
        color: selected ? c.synapseSoft : c.paper,
        shape: shape,
        child: InkWell(
          customBorder: shape,
          onTap: onTap,
          child: Stack(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(Space.s1, Space.s3, Space.s1, Space.s2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  spacing: Space.s2,
                  children: [
                    // A small lift when picked.
                    AnimatedScale(
                      scale: selected ? 1.08 : 1,
                      duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : Motion.select,
                      curve: Motion.settle,
                      child: Center(child: FeelingFace(flag, size: 56)),
                    ),
                    // Room for two lines on every card, so the rows line up.
                    SizedBox(
                      height: 34,
                      child: Text(
                        flag.label,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        style: TextStyle(
                          fontSize: TextSize.xs,
                          height: 1.2,
                          fontWeight: FontWeight.w700,
                          color: selected ? c.synapseInk : c.ink,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (selected)
                Positioned(
                  // Top left: the faces' details sit top right.
                  top: 5,
                  left: 5,
                  child: Container(
                    width: 18,
                    height: 18,
                    decoration: BoxDecoration(color: c.synapse, shape: BoxShape.circle),
                    child: Icon(Icons.check_rounded, size: 13, color: c.onAccent),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
