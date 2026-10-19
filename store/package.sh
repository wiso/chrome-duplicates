#!/bin/sh
# Build the zip to upload to the Chrome Web Store, with only the files the
# extension needs at runtime. Run from anywhere: ./store/package.sh
set -e
cd "$(dirname "$0")/.."
version=$(node -p 'require("./manifest.json").version')
out="store/bookmark-cleaner-$version.zip"
rm -f "$out"
zip -q -X "$out" manifest.json background.js duplicates.js folders.js links.js \
    main.html main.js tab-duplicates.js tab-folders.js tab-links.js style.css \
    icon16.png icon48.png icon128.png
echo "$out"
