import 'package:flutter/material.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/guide_text.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';
import 'program.dart';

/// Me → Guides: long reads such as The Mitoproof Protocol (docs/NCBM.md §11).
Future<void> openGuides(BuildContext context) =>
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const GuidesScreen()));

Future<void> openGuide(BuildContext context, String id) =>
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => GuideScreen(id)));

class GuidesScreen extends StatefulWidget {
  const GuidesScreen({super.key});

  @override
  State<GuidesScreen> createState() => _GuidesScreenState();
}

class _GuidesScreenState extends State<GuidesScreen> {
  Future<List<GuideSummary>>? _guides;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _guides ??= AppScope.of(context).api.guides();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      appBar: AppBar(title: const Text('Guides'), backgroundColor: c.mist, surfaceTintColor: Colors.transparent),
      body: FutureBuilder(
        future: _guides,
        builder: (context, snapshot) => ListView(
          padding: const EdgeInsets.fromLTRB(Space.s4, Space.s2, Space.s4, Space.s6),
          children: [
            if (snapshot.hasError)
              ScreenFailed(
                title: "Couldn't load the guides",
                detail: 'Check your connection and try again.',
                onRetry: () => setState(() => _guides = AppScope.of(context).api.guides()),
              )
            else if (!snapshot.hasData)
              const ScreenLoading(label: 'Loading guides', heights: [132])
            else if (snapshot.data!.isEmpty)
              const EmptyCard(title: 'No guides yet', detail: 'Guides appear here once they’re ready to read.')
            else
              for (final guide in snapshot.data!) ...[_GuideCard(guide), const SizedBox(height: Space.s3)],
          ],
        ),
      ),
    );
  }
}

class _GuideCard extends StatelessWidget {
  const _GuideCard(this.guide);

  final GuideSummary guide;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.card),
        onTap: () => openGuide(context, guide.id),
        child: AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: Space.s2,
            children: [
              _Tags(guide),
              Text(
                guide.title,
                style: const TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w800),
              ),
              if (guide.summary.isNotEmpty)
                Text(
                  guide.summary,
                  style: TextStyle(fontSize: TextSize.sm, height: 1.45, color: c.inkSoft),
                ),
              Text(
                '${guide.minutes} min read${guide.program ? ' · 30-day program' : ''}',
                style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: c.synapseInk),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Tags extends StatelessWidget {
  const _Tags(this.guide);

  final GuideSummary guide;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Wrap(
      spacing: Space.s1,
      runSpacing: Space.s1,
      children: [
        if (guide.ownBrand) Tag('Our brand', fill: c.synapseSoft, ink: c.synapseInk),
        if (guide.draft) Tag('Draft: only admins see this', fill: c.glucoseSoft, ink: c.glucoseInk),
      ],
    );
  }
}

/// One guide to read, with "Start the 30-day program" when it has one.
class GuideScreen extends StatefulWidget {
  const GuideScreen(this.id, {super.key});

  final String id;

  @override
  State<GuideScreen> createState() => _GuideScreenState();
}

class _GuideScreenState extends State<GuideScreen> {
  Future<(Guide, Program?)>? _load;
  var _starting = false;

  NeuroCalApi get _api => AppScope.of(context).api;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _load ??= _fetch();
  }

  Future<(Guide, Program?)> _fetch() async {
    final program = _api.program().catchError((Object _) => null);
    return (await _api.guide(widget.id), await program);
  }

  Future<void> _start() async {
    setState(() => _starting = true);
    try {
      await _api.startProgram(widget.id);
      if (!mounted) return;
      await openProgram(context);
      if (mounted) setState(() => _load = _fetch());
    } on Object {
      if (mounted) showToast(context, "The program didn't start. Try again.", ToastTone.problem);
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      appBar: AppBar(backgroundColor: c.mist, surfaceTintColor: Colors.transparent),
      body: FutureBuilder(
        future: _load,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Padding(
              padding: const EdgeInsets.all(Space.s4),
              child: ScreenFailed(
                title: "Couldn't load this guide",
                detail: 'Check your connection and try again.',
                onRetry: () => setState(() => _load = _fetch()),
              ),
            );
          }
          if (!snapshot.hasData) {
            return const Padding(
              padding: EdgeInsets.all(Space.s4),
              child: ScreenLoading(label: 'Loading the guide', heights: [48, 200, 200]),
            );
          }
          final (guide, program) = snapshot.data!;
          final s = guide.summary;
          final running = program != null && program.guideId == s.id && !program.finished;
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, Space.s1, 20, Space.s7),
            children: [
              _Tags(s),
              const SizedBox(height: Space.s2),
              Semantics(
                header: true,
                child: Text(
                  s.title,
                  style: const TextStyle(fontSize: TextSize.xxl, fontWeight: FontWeight.w800, height: 1.15),
                ),
              ),
              if (s.subtitle.isNotEmpty) ...[
                const SizedBox(height: Space.s1),
                Text(
                  s.subtitle,
                  style: TextStyle(fontSize: TextSize.md, color: c.inkSoft),
                ),
              ],
              if (s.program) ...[
                const SizedBox(height: Space.s4),
                FilledButton(
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                  onPressed: _starting ? null : (running ? () => openProgram(context) : _start),
                  child: Text(running ? 'Open the 30-day program · day ${program.day}' : 'Start the 30-day program'),
                ),
                const SizedBox(height: Space.s2),
                Text(
                  'NeuroCal ticks off the habits it can see in what you log, and asks you the rest.',
                  style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                ),
              ],
              const SizedBox(height: Space.s2),
              GuideText(guide.body),
            ],
          );
        },
      ),
    );
  }
}
