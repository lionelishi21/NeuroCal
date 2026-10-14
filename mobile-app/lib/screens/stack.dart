import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/sheet.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';
import 'supplement_sheet.dart';

const _order = [StackTiming.morning, StackTiming.withFood, StackTiming.evening, StackTiming.any];

List<StackItem> _sorted(List<StackItem> items) => [...items]..sort((a, b) => _order.indexOf(a.timing).compareTo(_order.indexOf(b.timing)));

String _dose(StackItem i) {
  final serving = i.servingSize == null ? '${i.servingsPerDay} a day' : '${i.servingsPerDay} × ${i.servingSize}';
  return '$serving · ${i.timing.label}';
}

/// Stack-wide checks: red when a daily total passes an upper limit, amber otherwise.
List<Widget> _flagNotes(List<StackFlag> flags) => [
  for (final f in flags)
    SheetNote(
      lead: switch (f.kind) {
        'above_upper_limit' => 'Too much in total.',
        'late_caffeine' => 'Caffeine late in the day.',
        _ => 'In more than one.',
      },
      detail: f.message,
      watch: f.kind != 'above_upper_limit',
    ),
];

/// Today's supplements as a checklist, with stack-wide warnings and bottles running low.
class StackCard extends StatefulWidget {
  const StackCard(this.stack, {super.key, required this.onManage});

  final SupplementStack stack;
  final VoidCallback onManage;

  @override
  State<StackCard> createState() => _StackCardState();
}

class _StackCardState extends State<StackCard> {
  late List<StackItem> _items = _sorted(widget.stack.items);

  @override
  void didUpdateWidget(StackCard old) {
    super.didUpdateWidget(old);
    if (old.stack != widget.stack) _items = _sorted(widget.stack.items);
  }

  Future<void> _toggle(StackItem item) async {
    final next = !item.takenToday;
    // Ticks feel instant; undo if the save fails.
    setState(() => _items = [for (final i in _items) i.id == item.id ? i.copyWith(takenToday: next) : i]);
    try {
      await AppScope.of(context).api.setTaken(item.id, next);
    } catch (_) {
      if (!mounted) return;
      setState(() => _items = [for (final i in _items) i.id == item.id ? i.copyWith(takenToday: !next) : i]);
      showToast(context, "Couldn't save that. Try again.", ToastTone.problem);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final taken = _items.where((i) => i.takenToday).length;
    return AppCard(
      padding: const EdgeInsets.fromLTRB(Space.s4, Space.s4, Space.s3, Space.s2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s2,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('Supplements today', style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800)),
              ),
              Text(
                '$taken of ${_items.length} taken',
                style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: taken == _items.length ? c.chlorophyll : c.inkSoft),
              ),
            ],
          ),
          for (final item in _items)
            Semantics(
              checked: item.takenToday,
              label: '${item.name}, ${_dose(item)}${item.runningLow ? ', ${item.daysLeft} days left' : ''}',
              excludeSemantics: true,
              onTap: () => _toggle(item),
              child: InkWell(
                onTap: () => _toggle(item),
                borderRadius: BorderRadius.circular(Radii.option),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: Space.s2),
                  child: Row(
                    spacing: Space.s3,
                    children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: item.takenToday ? c.chlorophyll : null,
                          border: Border.all(color: item.takenToday ? c.chlorophyll : c.ruleStrong, width: 2),
                        ),
                        child: item.takenToday ? Icon(Icons.check_rounded, size: 16, color: c.onAccent) : null,
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.name,
                              style: TextStyle(
                                fontSize: TextSize.sm,
                                fontWeight: FontWeight.w700,
                                color: item.takenToday ? c.inkSoft : c.ink,
                                decoration: item.takenToday ? TextDecoration.lineThrough : null,
                              ),
                            ),
                            Text(_dose(item), style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft)),
                          ],
                        ),
                      ),
                      if (item.runningLow)
                        Tag(item.daysLeft == 0 ? 'Out' : '${item.daysLeft} days left', fill: c.glucoseSoft, ink: c.glucoseInk),
                    ],
                  ),
                ),
              ),
            ),
          ..._flagNotes(widget.stack.flags),
          Align(alignment: Alignment.centerLeft, child: TextButton(onPressed: widget.onManage, child: const Text('Manage stack'))),
        ],
      ),
    );
  }
}

/// The whole stack: change servings, timing or bottle size, start a new bottle, remove, or add one.
class StackScreen extends StatefulWidget {
  const StackScreen({super.key});

  @override
  State<StackScreen> createState() => _StackScreenState();
}

class _StackScreenState extends State<StackScreen> {
  Future<SupplementStack>? _stack;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _stack ??= AppScope.of(context).api.stack();
  }

  void _reload() => setState(() => _stack = AppScope.of(context).api.stack());

  Future<void> _add() async {
    if (await showSupplementSheet(context) == true && mounted) {
      showToast(context, 'Added to your stack');
      _reload();
    }
  }

  Future<void> _edit(StackItem item) async {
    if (await showAppSheet<bool>(context, title: item.name, builder: (_) => _EditStackItem(item)) == true && mounted) _reload();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      appBar: AppBar(title: const Text('My stack'), backgroundColor: c.mist, surfaceTintColor: Colors.transparent),
      body: FutureBuilder(
        future: _stack,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Padding(
              padding: const EdgeInsets.all(Space.s4),
              child: ScreenFailed(title: "Couldn't load your stack", detail: 'Check your connection and try again.', onRetry: _reload),
            );
          }
          if (!snapshot.hasData) {
            return const Padding(padding: EdgeInsets.all(Space.s4), child: ScreenLoading(label: 'Loading your stack', heights: [64, 64, 64]));
          }
          final stack = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.fromLTRB(Space.s4, 0, Space.s4, Space.s6),
            children: [
              if (stack.items.isEmpty)
                const EmptyCard(title: 'Nothing here yet', detail: 'Scan a supplement label and add it, to get a daily checklist and checks across everything you take.')
              else ...[
                ..._flagNotes(stack.flags).map((w) => Padding(padding: const EdgeInsets.only(bottom: Space.s2), child: w)),
                AppCard(
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      for (final (i, item) in _sorted(stack.items).indexed)
                        ListTile(
                          shape: i == 0 ? null : Border(top: BorderSide(color: c.rule)),
                          title: Text(item.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                          subtitle: Text(
                            [_dose(item), if (item.daysLeft != null) '${item.daysLeft} days left in the bottle'].join(' · '),
                          ),
                          trailing: Icon(Icons.chevron_right_rounded, color: c.inkSoft),
                          onTap: () => _edit(item),
                        ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: Space.s4),
              FilledButton.icon(
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                onPressed: _add,
                icon: const Icon(Icons.document_scanner_outlined, size: 20),
                label: const Text('Scan a supplement to add'),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _EditStackItem extends StatefulWidget {
  const _EditStackItem(this.item);

  final StackItem item;

  @override
  State<_EditStackItem> createState() => _EditStackItemState();
}

class _EditStackItemState extends State<_EditStackItem> {
  late int _perDay = widget.item.servingsPerDay;
  late StackTiming _timing = widget.item.timing;
  late final _bottle = TextEditingController(text: widget.item.servingsPerContainer?.toString() ?? '');
  var _newBottle = false;
  var _busy = false;
  String? _error;

  @override
  void dispose() {
    _bottle.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action, String done) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      if (!mounted) return;
      showToast(context, done);
      Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = 'Check your connection and try again.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final api = AppScope.of(context).api;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        const Text('Servings a day', style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700)),
        Row(
          spacing: Space.s2,
          children: [for (final n in [1, 2, 3, 4]) ChoicePill(label: '$n', selected: _perDay == n, onTap: () => setState(() => _perDay = n))],
        ),
        const Text('When', style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700)),
        Wrap(
          spacing: Space.s2,
          runSpacing: Space.s2,
          children: [for (final t in StackTiming.values) ChoicePill(label: t.label, selected: _timing == t, onTap: () => setState(() => _timing = t))],
        ),
        TextField(
          controller: _bottle,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Servings in the bottle'),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _newBottle,
          onChanged: (v) => setState(() => _newBottle = v),
          title: const Text('I started a new bottle today'),
        ),
        if (_error != null) SheetNote(lead: "Couldn't save.", detail: _error!),
        SheetAction(
          label: _busy ? 'Saving…' : 'Save',
          onPressed: _busy
              ? null
              : () => _run(
                  () => api.updateStackItem(
                    widget.item.id,
                    servingsPerDay: _perDay,
                    timing: _timing,
                    servingsPerContainer: int.tryParse(_bottle.text.trim()) ?? 0,
                    newBottle: _newBottle,
                  ),
                  'Saved',
                ),
        ),
        TextButton(
          style: TextButton.styleFrom(foregroundColor: c.beet),
          onPressed: _busy ? null : () => _run(() => api.removeFromStack(widget.item.id), 'Removed from your stack'),
          child: const Text('Remove from my stack'),
        ),
      ],
    );
  }
}
