# Release builds shrink the code with R8. Google ML Kit's text recognition refers to optional
# language packs (Chinese, Devanagari, Japanese, Korean) that the app doesn't bundle: it only
# reads Latin script. Tell R8 their absence is expected.
-dontwarn com.google.mlkit.vision.text.chinese.**
-dontwarn com.google.mlkit.vision.text.devanagari.**
-dontwarn com.google.mlkit.vision.text.japanese.**
-dontwarn com.google.mlkit.vision.text.korean.**
