# Ritma release build rules.
#
# Hilt, Compose, and AndroidX artifacts ship their own consumer ProGuard
# rules; only project-specific keep rules belong here.

# Keep source file names and line numbers for readable release stack traces.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
