import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import 'toast.dart';
import 'ui.dart';

/// "Read and listen": books and audiobooks for what this person is working on, each saying why it's
/// there. Loads on its own and hides itself if it can't, so the rest of the screen still shows.
class LearnShelfSection extends StatefulWidget {
  const LearnShelfSection({super.key});

  @override
  State<LearnShelfSection> createState() => _LearnShelfSectionState();
}

class _LearnShelfSectionState extends State<LearnShelfSection> {
  Future<LearnShelf>? _shelf;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _shelf ??= AppScope.of(context).api.learn();
  }

  Future<void> _open(String url) async {
    final link = Uri.tryParse(url);
    final opened = link != null && await AppScope.of(context).openLink(link).catchError((Object _) => false);
    if (!opened && mounted) showToast(context, "Couldn't open that link.", ToastTone.problem);
  }

  @override
  Widget build(BuildContext context) => FutureBuilder(
    future: _shelf,
    builder: (context, snapshot) {
      final shelf = snapshot.data;
      if (shelf == null || shelf.books.isEmpty) return const SizedBox.shrink();
      final c = context.colors;
      Widget link(String label, IconData icon, String url) => OutlinedButton.icon(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 48),
          foregroundColor: c.synapseInk,
          side: BorderSide(color: c.ruleStrong, width: 1.5),
        ),
        onPressed: () => _open(url),
        icon: Icon(icon, size: 18),
        label: Text(label),
      );
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: Space.s3,
        children: [
          BlockTitle('Read and listen', note: shelf.affiliate ? 'Affiliate links' : null),
          for (final b in shelf.books)
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: Space.s1,
                children: [
                  Text(
                    b.because,
                    style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: c.synapseInk),
                  ),
                  Text(
                    b.title,
                    style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
                  ),
                  Text(
                    b.author,
                    style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                  ),
                  Text(
                    b.summary,
                    style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
                  ),
                  const SizedBox(height: Space.s1),
                  Wrap(
                    spacing: Space.s2,
                    runSpacing: Space.s2,
                    children: [
                      link('Book', Icons.menu_book_rounded, b.bookUrl),
                      link('Audiobook', Icons.headphones_rounded, b.audioUrl),
                    ],
                  ),
                ],
              ),
            ),
        ],
      );
    },
  );
}
