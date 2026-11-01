import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// A guide's text (`Guide.body`): the markdown the admin screen writes. ## is a chapter, ### a
/// section, #### a smaller heading; a line starting "- " is a list item; lines starting "|" are a
/// table; **bold** and _italic_ work inside any of them. Anything else is a paragraph.
class GuideText extends StatelessWidget {
  const GuideText(this.body, {super.key});

  final String body;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [for (final block in parseGuide(body)) _Block(block)],
  );
}

enum GuideBlockKind { chapter, section, heading, paragraph, list, table }

typedef GuideBlock = ({GuideBlockKind kind, List<String> lines});

/// Splits the text into blocks at blank lines; headings and tables also end a block.
List<GuideBlock> parseGuide(String body) {
  final blocks = <GuideBlock>[];
  for (final chunk in body.replaceAll('\r\n', '\n').split(RegExp(r'\n\s*\n'))) {
    final lines = [
      for (final l in chunk.split('\n'))
        if (l.trim().isNotEmpty) l.trim(),
    ];
    if (lines.isEmpty) continue;
    final first = lines.first;
    if (first.startsWith('#')) {
      final level = RegExp(r'^#+').firstMatch(first)!.group(0)!.length;
      final kind = level <= 2
          ? GuideBlockKind.chapter
          : level == 3
          ? GuideBlockKind.section
          : GuideBlockKind.heading;
      blocks.add((kind: kind, lines: [first.replaceFirst(RegExp(r'^#+\s*'), '')]));
      // Text under a heading without a blank line between.
      if (lines.length > 1) blocks.addAll(parseGuide(lines.skip(1).join('\n')));
    } else if (lines.every((l) => l.startsWith('|'))) {
      blocks.add((kind: GuideBlockKind.table, lines: lines));
    } else if (lines.every((l) => l.startsWith('- '))) {
      blocks.add((kind: GuideBlockKind.list, lines: [for (final l in lines) l.substring(2)]));
    } else {
      blocks.add((kind: GuideBlockKind.paragraph, lines: lines));
    }
  }
  return blocks;
}

/// **bold** and _italic_ as spans.
List<InlineSpan> guideSpans(String text) {
  final spans = <InlineSpan>[];
  final pattern = RegExp(r'\*\*(.+?)\*\*|(?<![A-Za-z0-9])_(.+?)_(?![A-Za-z0-9])');
  var at = 0;
  for (final m in pattern.allMatches(text)) {
    if (m.start > at) spans.add(TextSpan(text: text.substring(at, m.start)));
    spans.add(
      m.group(1) != null
          ? TextSpan(
              text: m.group(1),
              style: const TextStyle(fontWeight: FontWeight.w700),
            )
          : TextSpan(
              text: m.group(2),
              style: const TextStyle(fontStyle: FontStyle.italic),
            ),
    );
    at = m.end;
  }
  if (at < text.length) spans.add(TextSpan(text: text.substring(at)));
  return spans;
}

class _Block extends StatelessWidget {
  const _Block(this.block);

  final GuideBlock block;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    const body = TextStyle(fontSize: TextSize.base, height: 1.55);
    Widget rich(String text, TextStyle style) => Text.rich(TextSpan(children: guideSpans(text)), style: style);
    return switch (block.kind) {
      GuideBlockKind.chapter => Padding(
        padding: const EdgeInsets.only(top: Space.s6, bottom: Space.s3),
        child: Semantics(
          header: true,
          child: Text(
            block.lines.first,
            style: const TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800, height: 1.25),
          ),
        ),
      ),
      GuideBlockKind.section => Padding(
        padding: const EdgeInsets.only(top: Space.s5, bottom: Space.s2),
        child: Semantics(
          header: true,
          child: Text(
            block.lines.first,
            style: const TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w700, height: 1.3),
          ),
        ),
      ),
      GuideBlockKind.heading => Padding(
        padding: const EdgeInsets.only(top: Space.s4, bottom: Space.s1),
        child: Semantics(
          header: true,
          child: Text(
            block.lines.first,
            style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700, height: 1.35, color: c.synapseInk),
          ),
        ),
      ),
      GuideBlockKind.paragraph => Padding(
        padding: const EdgeInsets.only(bottom: Space.s3),
        child: rich(block.lines.join('\n'), body),
      ),
      GuideBlockKind.list => Padding(
        padding: const EdgeInsets.only(bottom: Space.s3),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: Space.s1,
          children: [
            for (final item in block.lines)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(Space.s1, 10, Space.s3, 0),
                    child: Container(
                      width: 5,
                      height: 5,
                      decoration: BoxDecoration(color: c.synapse, shape: BoxShape.circle),
                    ),
                  ),
                  Expanded(child: rich(item, body)),
                ],
              ),
          ],
        ),
      ),
      GuideBlockKind.table => Padding(
        padding: const EdgeInsets.only(bottom: Space.s4),
        child: _GuideTable(block.lines),
      ),
    };
  }
}

/// A pipe table; the row of dashes under the header is dropped.
class _GuideTable extends StatelessWidget {
  const _GuideTable(this.lines);

  final List<String> lines;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    List<String> cells(String line) {
      final parts = line.split('|');
      return [for (final p in parts.sublist(1, parts.length - (line.endsWith('|') ? 1 : 0))) p.trim()];
    }

    final rows = [
      for (final l in lines)
        if (!RegExp(r'^\|[\s:|-]+\|?$').hasMatch(l)) cells(l),
    ];
    if (rows.isEmpty) return const SizedBox.shrink();
    final columns = rows.map((r) => r.length).reduce((a, b) => a > b ? a : b);
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: c.paper,
        borderRadius: BorderRadius.circular(Radii.option),
        border: Border.all(color: c.rule),
      ),
      child: Table(
        defaultVerticalAlignment: TableCellVerticalAlignment.top,
        border: TableBorder(horizontalInside: BorderSide(color: c.rule)),
        children: [
          for (final (i, row) in rows.indexed)
            TableRow(
              decoration: i == 0 ? BoxDecoration(color: c.mist) : null,
              children: [
                for (var col = 0; col < columns; col++)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: Space.s2, vertical: Space.s2),
                    child: Text.rich(
                      TextSpan(children: guideSpans(col < row.length ? row[col] : '')),
                      style: TextStyle(
                        fontSize: TextSize.xs,
                        height: 1.4,
                        fontWeight: i == 0 ? FontWeight.w700 : FontWeight.w400,
                      ),
                    ),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}
