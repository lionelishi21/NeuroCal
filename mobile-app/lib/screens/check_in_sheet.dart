import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/sheet.dart';

/// "How do you feel right now?" Pick one or more feelings, with an optional note. Returns true when saved.
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
        Wrap(
          spacing: Space.s2,
          runSpacing: Space.s2,
          children: [
            for (final flag in CognitiveFlag.values)
              ChoicePill(
                label: flag.label,
                selected: _picked.contains(flag),
                onTap: () => setState(() => _picked.contains(flag) ? _picked.remove(flag) : _picked.add(flag)),
              ),
          ],
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
