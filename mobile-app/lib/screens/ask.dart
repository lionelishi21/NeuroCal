import 'package:flutter/material.dart';

import '../api/api.dart' show ApiException;
import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../weight_units.dart';

/// Opens Ask NeuroCal. With [question], asks it straight away (e.g. "Why did my weight go up?" from the
/// weight card).
Future<void> openAsk(BuildContext context, {String? question}) =>
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => AskScreen(question: question)));

const _suggestions = [
  'Why did my weight go up?',
  'Am I on track for my goal?',
  'What should I eat tonight?',
  'How has my sleep been?',
];

/// A conversation about the person's own numbers. Each answer is worked out on the server from their
/// recent weigh-ins, meals, sleep and sessions; the conversation lives only while the screen is open.
class AskScreen extends StatefulWidget {
  const AskScreen({super.key, this.question});

  final String? question;

  @override
  State<AskScreen> createState() => _AskScreenState();
}

class _AskScreenState extends State<AskScreen> {
  final _text = TextEditingController();
  final _scroll = ScrollController();
  final _messages = <ChatMessage>[];
  WeightUnit? _unit;
  var _waiting = false;

  /// Why the last question went unanswered; null when it was.
  String? _problem;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_unit == null) {
      WeightUnit.load(Localizations.localeOf(context)).then((u) {
        if (!mounted) return;
        setState(() => _unit = u);
        if (widget.question case final q? when _messages.isEmpty) _send(q);
      });
    }
  }

  @override
  void dispose() {
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _toEnd() => WidgetsBinding.instance.addPostFrameCallback((_) {
    if (!_scroll.hasClients) return;
    final end = _scroll.position.maxScrollExtent;
    if (MediaQuery.disableAnimationsOf(context)) {
      _scroll.jumpTo(end);
    } else {
      _scroll.animateTo(end, duration: Motion.step, curve: Motion.settle);
    }
  });

  Future<void> _send(String text) async {
    final question = text.trim();
    if (question.isEmpty || _waiting) return;
    _text.clear();
    setState(() => _messages.add((fromMe: true, text: question)));
    await _answer();
  }

  /// Asks for an answer to the conversation as it stands (its last message is the question).
  Future<void> _answer() async {
    setState(() {
      _waiting = true;
      _problem = null;
    });
    _toEnd();
    try {
      final reply = await AppScope.of(context).api.ask(List.of(_messages), unit: (_unit ?? WeightUnit.kg).label);
      if (!mounted) return;
      setState(() => _messages.add((fromMe: false, text: reply)));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(
        () => _problem = switch (e.status) {
          402 => 'Ask NeuroCal is part of your subscription.',
          429 || 502 || 503 => e.message,
          _ => "Couldn't get an answer right now. Try again in a moment.",
        },
      );
    } catch (_) {
      if (mounted) setState(() => _problem = "Couldn't get an answer. Check your connection and try again.");
    } finally {
      if (mounted) setState(() => _waiting = false);
      _toEnd();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      appBar: AppBar(title: const Text('Ask NeuroCal'), backgroundColor: c.mist, surfaceTintColor: Colors.transparent),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Expanded(
              child: ListView(
                controller: _scroll,
                padding: const EdgeInsets.fromLTRB(Space.s4, Space.s2, Space.s4, Space.s4),
                children: [
                  if (_messages.isEmpty) _Intro(onPick: _send),
                  for (final m in _messages) _Bubble(m),
                  if (_waiting) const _Bubble((fromMe: false, text: 'Looking at your numbers…'), pending: true),
                  if (_problem case final p?)
                    Semantics(
                      liveRegion: true,
                      child: Padding(
                        padding: const EdgeInsets.only(top: Space.s2),
                        child: Row(
                          spacing: Space.s2,
                          children: [
                            Icon(Icons.error_outline_rounded, size: 18, color: c.glucoseInk),
                            Expanded(
                              child: Text(
                                p,
                                style: TextStyle(fontSize: TextSize.sm, color: c.glucoseInk),
                              ),
                            ),
                            TextButton(onPressed: _answer, child: const Text('Try again')),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
            _Composer(controller: _text, busy: _waiting, onSend: () => _send(_text.text)),
          ],
        ),
      ),
    );
  }
}

/// What to ask, before the first question: a line on what the answers use, and a few starters.
class _Intro extends StatelessWidget {
  const _Intro({required this.onPick});

  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(top: Space.s3, bottom: Space.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: Space.s3,
        children: [
          const Text(
            'Ask about your weight, food, fasting or sleep.',
            style: TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w800, height: 1.25),
          ),
          Text(
            'Answers use what you’ve logged in the last few weeks.',
            style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft, height: 1.4),
          ),
          Wrap(
            spacing: Space.s2,
            runSpacing: Space.s2,
            children: [for (final s in _suggestions) ActionChip(label: Text(s), onPressed: () => onPick(s))],
          ),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble(this.message, {this.pending = false});

  final ChatMessage message;
  final bool pending;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final mine = message.fromMe;
    return Semantics(
      liveRegion: !mine,
      label: mine ? 'You asked' : 'NeuroCal',
      child: Align(
        alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.82),
          margin: const EdgeInsets.only(top: Space.s2),
          padding: const EdgeInsets.symmetric(horizontal: Space.s3, vertical: Space.s2),
          decoration: BoxDecoration(
            color: mine ? c.synapse : c.paper,
            border: mine ? null : Border.all(color: c.rule),
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(Radii.option),
              topRight: const Radius.circular(Radii.option),
              bottomLeft: Radius.circular(mine ? Radii.option : 4),
              bottomRight: Radius.circular(mine ? 4 : Radii.option),
            ),
          ),
          child: SelectableText(
            message.text,
            style: TextStyle(
              fontSize: TextSize.sm,
              height: 1.45,
              color: mine ? c.onAccent : (pending ? c.inkSoft : null),
              fontStyle: pending ? FontStyle.italic : null,
            ),
          ),
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({required this.controller, required this.busy, required this.onSend});

  final TextEditingController controller;
  final bool busy;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.fromLTRB(Space.s4, Space.s2, Space.s2, Space.s2),
      decoration: BoxDecoration(
        color: c.mist,
        border: Border(top: BorderSide(color: c.rule)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            spacing: Space.s1,
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  minLines: 1,
                  maxLines: 4,
                  maxLength: 1000,
                  textCapitalization: TextCapitalization.sentences,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => onSend(),
                  decoration: const InputDecoration(hintText: 'Ask a question', counterText: ''),
                ),
              ),
              IconButton.filled(
                tooltip: 'Send',
                onPressed: busy ? null : onSend,
                icon: const Icon(Icons.arrow_upward_rounded),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(top: Space.s1, right: Space.s2),
            child: Text(
              'Not medical advice. For anything that worries you, talk to your doctor.',
              style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft),
            ),
          ),
        ],
      ),
    );
  }
}
