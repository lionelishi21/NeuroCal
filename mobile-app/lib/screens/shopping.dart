import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/product_card.dart';
import '../widgets/sheet.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';
import 'log_meal_sheet.dart' show maxPhotoBytes;

/// The shopping list, kept on the server: add items (typed, from a meal plan or from a photo of a list
/// or receipt), see them by aisle, tick them off while shopping, and move what's bought into the pantry.
/// "Check my list" grades each item and suggests cleaner swaps.
class ShoppingScreen extends StatefulWidget {
  const ShoppingScreen({super.key, this.picker});

  final ImagePicker? picker;

  @override
  State<ShoppingScreen> createState() => _ShoppingScreenState();
}

typedef _Graded = ({String name, FoodProcessing processing, ShoppingVerdict verdict, String reason, String? swapFor});

class _ShoppingScreenState extends State<ShoppingScreen> {
  final _text = TextEditingController();
  late final _picker = widget.picker ?? ImagePicker();
  ShoppingListData? _list;
  String? _problem;
  var _busy = false;

  /// The last "Check my list", by item name (lower case).
  Map<String, _Graded> _grades = {};
  List<({SuggestedProduct product, List<String> because})> _devices = const [];
  var _checking = false;

  NeuroCalApi get _api => AppScope.of(context).api;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_list == null && _problem == null) _load();
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await _api.shoppingList();
      if (mounted) setState(() => _list = list);
    } catch (_) {
      if (mounted) setState(() => _problem = 'Check your connection and try again.');
    }
  }

  /// Runs a change and shows the list it returns; on failure, says so and keeps what was there.
  Future<void> _change(Future<ShoppingListData> Function() action, {String? done}) async {
    setState(() => _busy = true);
    try {
      final list = await action();
      if (!mounted) return;
      setState(() => _list = list);
      if (done != null) showToast(context, done);
    } catch (_) {
      if (mounted) showToast(context, "Couldn't update your list. Try again.", ToastTone.problem);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Several items at once: "spinach, eggs" or one per line.
  void _add() {
    final names = _text.text.split(RegExp(r'[,\n]')).map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
    if (names.isEmpty) return;
    _text.clear();
    _change(() => _api.addToShoppingList([for (final n in names) (name: n, quantity: null)]));
  }

  /// Ticks at once, then saves; put back if saving fails.
  Future<void> _tick(ShoppingListItem item, bool checked) async {
    final before = _list!;
    setState(() {
      _list = ShoppingListData(
        items: [
          for (final i in before.items)
            i.id == item.id
                ? (id: i.id, name: i.name, quantity: i.quantity, aisle: i.aisle, checked: checked, fromPlan: i.fromPlan)
                : i,
        ],
        text: before.text,
      );
    });
    try {
      final list = await _api.updateShoppingItem(item.id, checked: checked);
      if (mounted) setState(() => _list = list);
    } catch (_) {
      if (!mounted) return;
      setState(() => _list = before);
      showToast(context, "Couldn't save that tick. Try again.", ToastTone.problem);
    }
  }

  Future<void> _share() async {
    final text = _list?.text ?? '';
    if (text.isEmpty) return;
    final share = AppScope.of(context).shareText;
    if (share != null) {
      await share('Shopping list\n\n$text');
    } else {
      await Clipboard.setData(ClipboardData(text: text));
      if (mounted) showToast(context, 'List copied');
    }
  }

  Future<void> _check() async {
    final open = [
      for (final i in _list!.items)
        if (!i.checked) i.name,
    ];
    if (open.isEmpty) return;
    setState(() => _checking = true);
    try {
      final r = await _api.reviewShoppingList(text: open.join('\n'));
      if (!mounted) return;
      setState(() {
        _grades = {for (final g in r.items) g.name.toLowerCase(): g};
        _devices = r.devices;
      });
    } on ApiException catch (e) {
      if (mounted) {
        showToast(
          context,
          e.status == 402 ? 'Checking your list is part of your subscription.' : "Couldn't check your list right now.",
          ToastTone.problem,
        );
      }
    } catch (_) {
      if (mounted) showToast(context, "Couldn't check your list. Check your connection.", ToastTone.problem);
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  /// A photo of a written list, a receipt or a shopping app: its items go on the list, graded.
  Future<void> _fromPhoto(ImageSource source) async {
    final file = await _picker.pickImage(source: source, maxWidth: 2000, imageQuality: 85);
    if (file == null || !mounted) return;
    final bytes = await file.readAsBytes();
    if (!mounted) return;
    if (bytes.length > maxPhotoBytes) {
      showToast(context, 'That photo is over 8 MB. Choose a smaller one.', ToastTone.problem);
      return;
    }
    setState(() => _checking = true);
    try {
      final r = await _api.reviewShoppingList(photo: Uint8List.fromList(bytes));
      if (!mounted) return;
      if (r.problem != null || r.items.isEmpty) {
        showToast(context, 'That doesn’t look like a list. Try a clearer photo.', ToastTone.problem);
        return;
      }
      setState(() {
        _grades = {..._grades, for (final g in r.items) g.name.toLowerCase(): g};
        _devices = r.devices;
      });
      await _change(
        () => _api.addToShoppingList([for (final g in r.items) (name: g.name, quantity: null)]),
        done: '${r.items.length} items added',
      );
    } catch (_) {
      if (mounted) showToast(context, "Couldn't read that photo. Try again.", ToastTone.problem);
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  Future<void> _finish() async {
    final bought = _list!.checked;
    final toPantry = await showAppSheet<bool>(
      context,
      title: 'Done shopping?',
      builder: (context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s3,
        children: [
          Text(
            'Move the $bought ${bought == 1 ? 'item' : 'items'} you ticked into your pantry? Your next meal plan and recipes will use ${bought == 1 ? 'it' : 'them'} first.',
            style: const TextStyle(fontSize: TextSize.sm, height: 1.4),
          ),
          SheetAction(label: 'Move to my pantry', onPressed: () => Navigator.of(context).pop(true)),
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Just clear them')),
        ],
      ),
    );
    if (toPantry == null || !mounted) return;
    await _change(
      () => _api.finishShopping(toPantry: toPantry),
      done: toPantry ? '$bought ${bought == 1 ? 'item' : 'items'} moved to your pantry' : 'Ticked items cleared',
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final list = _list;
    final hasOpen = list?.items.any((i) => !i.checked) ?? false;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Shopping list'),
        backgroundColor: c.mist,
        surfaceTintColor: Colors.transparent,
        actions: [
          if (hasOpen)
            IconButton(tooltip: 'Share the list', onPressed: _share, icon: const Icon(Icons.ios_share_rounded)),
        ],
      ),
      body: _problem != null
          ? Padding(
              padding: const EdgeInsets.all(Space.s4),
              child: ScreenFailed(
                title: "Couldn't load your list",
                detail: _problem!,
                onRetry: () {
                  setState(() => _problem = null);
                  _load();
                },
              ),
            )
          : list == null
          ? const Padding(
              padding: EdgeInsets.all(Space.s4),
              child: ScreenLoading(label: 'Loading your list', heights: [56, 160]),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(Space.s4, 0, Space.s4, Space.s6),
              children: [
                Row(
                  spacing: Space.s2,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _text,
                        textCapitalization: TextCapitalization.sentences,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _add(),
                        decoration: const InputDecoration(
                          labelText: 'Add an item',
                          hintText: 'Spinach, eggs, 2 lemons',
                        ),
                      ),
                    ),
                    FilledButton(
                      style: FilledButton.styleFrom(minimumSize: const Size(64, 52)),
                      onPressed: _busy ? null : _add,
                      child: const Text('Add'),
                    ),
                  ],
                ),
                const SizedBox(height: Space.s2),
                Row(
                  spacing: Space.s2,
                  children: [
                    Expanded(
                      child: _Secondary(
                        icon: Icons.photo_camera_outlined,
                        label: 'From a photo',
                        onPressed: _checking ? null : () => _fromPhoto(ImageSource.camera),
                      ),
                    ),
                    Expanded(
                      child: _Secondary(
                        icon: Icons.fact_check_outlined,
                        label: _checking ? 'Checking…' : 'Check my list',
                        onPressed: _checking || !hasOpen ? null : _check,
                      ),
                    ),
                  ],
                ),
                if (list.items.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: Space.s4),
                    child: EmptyCard(
                      title: 'Your list is empty',
                      detail: 'Add items above, snap a written list or a receipt, or add a meal plan’s ingredients from Kitchen › Meal plan.',
                    ),
                  )
                else
                  for (final aisle in Aisle.values)
                    if (list.items.where((i) => i.aisle == aisle).toList() case final inAisle
                        when inAisle.isNotEmpty) ...[
                      GroupLabel(aisle.label, top: Space.s4),
                      AppCard(
                        padding: EdgeInsets.zero,
                        child: Column(
                          children: [
                            for (final (n, item) in inAisle.indexed)
                              _Row(
                                item,
                                divider: n > 0,
                                grade: _grades[item.name.toLowerCase()],
                                onTick: (v) => _tick(item, v),
                                onRemove: () => _change(() => _api.deleteShoppingItem(item.id)),
                              ),
                          ],
                        ),
                      ),
                    ],
                if (_devices.isNotEmpty) ...[
                  const BlockTitle('Gadgets that make the swaps easy'),
                  for (final d in _devices)
                    Padding(
                      padding: const EdgeInsets.only(bottom: Space.s3),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        spacing: Space.s1,
                        children: [
                          Text(
                            'For ${d.because.join(', ')}',
                            style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: c.inkSoft),
                          ),
                          ProductCard(d.product),
                        ],
                      ),
                    ),
                ],
                if (list.checked > 0) ...[
                  const SizedBox(height: Space.s4),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                    onPressed: _busy ? null : _finish,
                    icon: const Icon(Icons.done_all_rounded, size: 20),
                    label: Text('Done shopping (${list.checked} bought)'),
                  ),
                ],
                if (_grades.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: Space.s3),
                    child: Text(
                      'Grades are judged from the item names; brands vary, so check the label when it matters.',
                      style: TextStyle(fontSize: TextSize.xxs, height: 1.4, color: c.inkFaint),
                    ),
                  ),
              ],
            ),
    );
  }
}

class _Secondary extends StatelessWidget {
  const _Secondary({required this.icon, required this.label, required this.onPressed});

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return OutlinedButton.icon(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(48),
        foregroundColor: c.synapseInk,
        side: BorderSide(color: c.ruleStrong, width: 1.5),
      ),
      onPressed: onPressed,
      icon: Icon(icon, size: 18),
      label: Text(label),
    );
  }
}

/// One item: tick it, see its grade and a cleaner swap once the list's been checked, or remove it.
class _Row extends StatelessWidget {
  const _Row(this.item, {required this.divider, required this.grade, required this.onTick, required this.onRemove});

  final ShoppingListItem item;
  final bool divider;
  final _Graded? grade;
  final ValueChanged<bool> onTick;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final g = grade;
    final (fill, ink) = switch (g?.processing) {
      FoodProcessing.whole => (c.chlorophyllSoft, c.chlorophyll),
      FoodProcessing.processed => (c.glucoseSoft, c.glucoseInk),
      FoodProcessing.ultraProcessed => (c.beetSoft, c.beet),
      null => (c.mist, c.inkSoft),
    };
    return Container(
      decoration: BoxDecoration(
        border: divider ? Border(top: BorderSide(color: c.rule)) : null,
      ),
      padding: const EdgeInsets.fromLTRB(Space.s1, Space.s1, Space.s1, Space.s1),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Checkbox(value: item.checked, semanticLabel: 'Bought ${item.name}', onChanged: (v) => onTick(v ?? false)),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 2,
                children: [
                  Wrap(
                    spacing: Space.s2,
                    runSpacing: Space.s1,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        item.name,
                        style: TextStyle(
                          fontSize: TextSize.md,
                          fontWeight: FontWeight.w700,
                          decoration: item.checked ? TextDecoration.lineThrough : null,
                          color: item.checked ? c.inkSoft : c.ink,
                        ),
                      ),
                      if (g != null && !item.checked) Tag(g.processing.label, fill: fill, ink: ink),
                    ],
                  ),
                  if (item.quantity != null || item.fromPlan)
                    Text(
                      [item.quantity, if (item.fromPlan) 'for your meal plan'].whereType<String>().join(' · '),
                      style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                    ),
                  if (g?.swapFor case final swap? when !item.checked)
                    Row(
                      spacing: 6,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.swap_horiz_rounded, size: 18, color: c.chlorophyll),
                        Expanded(
                          child: Text(
                            swap,
                            style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: c.chlorophyll),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ),
          IconButton(
            tooltip: 'Remove ${item.name}',
            onPressed: onRemove,
            icon: Icon(Icons.close_rounded, size: 18, color: c.inkSoft),
          ),
        ],
      ),
    );
  }
}
