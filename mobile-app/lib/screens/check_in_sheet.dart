import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';

/// "How do you feel?" Pick one or more flags. Returns true when saved.
Future<bool?> showCheckInSheet(BuildContext context) =>
    showModalBottomSheet<bool>(context: context, isScrollControlled: true, builder: (_) => const _CheckInSheet());

class _CheckInSheet extends StatefulWidget {
  const _CheckInSheet();

  @override
  State<_CheckInSheet> createState() => _CheckInSheetState();
}

class _CheckInSheetState extends State<_CheckInSheet> {
  final _picked = <CognitiveFlag>{};
  var _busy = false;
  String? _error;

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.of(context).api.checkIn(_picked.toList());
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      setState(() {
        _busy = false;
        _error = "Couldn't save your check-in. Try again.";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Space.s4, 0, Space.s4, Space.s4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('How do you feel?', style: text.headlineSmall),
            const SizedBox(height: Space.s1),
            Text(
              'Pick any that fit. They feed the stress part of your Focus Score.',
              style: text.bodyMedium?.copyWith(color: c.inkSoft),
            ),
            const SizedBox(height: Space.s4),
            Wrap(
              spacing: Space.s2,
              runSpacing: Space.s2,
              children: [
                for (final flag in CognitiveFlag.values)
                  FilterChip(
                    label: Text(flag.label),
                    selected: _picked.contains(flag),
                    labelStyle: TextStyle(
                      color: _picked.contains(flag) ? c.onAccent : c.ink,
                      fontWeight: FontWeight.w600,
                    ),
                    onSelected: (on) => setState(() => on ? _picked.add(flag) : _picked.remove(flag)),
                  ),
              ],
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: Space.s3),
                child: Text(_error!, style: TextStyle(color: c.beet)),
              ),
            const SizedBox(height: Space.s5),
            FilledButton(
              onPressed: _busy || _picked.isEmpty ? null : _save,
              child: Text(_busy ? 'Saving…' : 'Save check-in'),
            ),
          ],
        ),
      ),
    );
  }
}
