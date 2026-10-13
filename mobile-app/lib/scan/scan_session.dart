/// What live scan does with a frame, decided from the text found in it.
enum FrameVerdict {
  /// Not enough readable text: too far, blurry, or not a label.
  tooLittleText,

  /// Readable, but it shows what an earlier frame already shows.
  alreadySeen,

  /// Readable and shows part of the label no kept frame shows: keep it.
  keep,
}

/// The words in a frame that are worth comparing: lowercase, letters and digits, three or more long.
Set<String> labelWords(String text) => {
  for (final word in text.toLowerCase().split(RegExp(r'[^a-z0-9%]+')))
    if (word.length >= 3) word,
};

/// Decides which frames of a turning bottle to keep, so the kept frames cover the label with little
/// overlap. Pure logic: the camera and text recognition feed it words.
class ScanSession {
  ScanSession({this.maxFrames = 3, this.minWords = 8});

  /// Frames to keep before the scan finishes on its own (the API reads at most four).
  final int maxFrames;

  /// Words a frame needs before it counts as readable.
  final int minWords;

  final _seen = <String>{};
  var _kept = 0;

  int get kept => _kept;
  bool get full => _kept >= maxFrames;

  FrameVerdict consider(Set<String> words) {
    if (words.length < minWords) return FrameVerdict.tooLittleText;
    final fresh = words.difference(_seen).length;
    // The first readable frame always counts; after that, a frame must add a fair share of new text.
    final enough = _kept == 0 || fresh >= 6 && fresh >= words.length * 0.3;
    if (!enough || full) return FrameVerdict.alreadySeen;
    _seen.addAll(words);
    _kept++;
    return FrameVerdict.keep;
  }

  /// Counts a photo the person took themselves: always kept, and its words count as seen.
  void keepAnyway(Set<String> words) {
    _seen.addAll(words);
    _kept++;
  }
}
