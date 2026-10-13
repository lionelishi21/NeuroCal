import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/scan/scan_session.dart';

const front = 'Supplement Facts Serving Size 2 capsules Amount per serving Magnesium glycinate 200 mg Zinc 15 mg';
const back = 'Other ingredients rice flour vegetable cellulose capsule Distributed by Calm Labs lot MG2405 expires 2027';
const side = 'Directions take two capsules daily with food Warning keep out of reach of children consult physician pregnant';

void main() {
  test('words are lowercase, three letters or more, without punctuation', () {
    expect(labelWords('Zinc 15 mg, (as Zinc citrate)'), {'zinc', 'citrate'});
  });

  test('keeps the first readable frame, then only frames that show new text', () {
    final session = ScanSession();
    expect(session.consider(labelWords('Supplement Facts')), FrameVerdict.tooLittleText);
    expect(session.consider(labelWords(front)), FrameVerdict.keep);
    expect(session.consider(labelWords(front)), FrameVerdict.alreadySeen);
    // Mostly the same panel with a word or two more is not a new side.
    expect(session.consider(labelWords('$front calcium')), FrameVerdict.alreadySeen);
    expect(session.consider(labelWords(back)), FrameVerdict.keep);
    expect(session.full, isFalse);
    expect(session.consider(labelWords(side)), FrameVerdict.keep);
    expect(session.full, isTrue);
    expect(session.kept, 3);
  });

  test('a photo taken by hand always counts, and its text counts as seen', () {
    final session = ScanSession();
    session.keepAnyway(labelWords(front));
    expect(session.kept, 1);
    expect(session.consider(labelWords(front)), FrameVerdict.alreadySeen);
  });
}
