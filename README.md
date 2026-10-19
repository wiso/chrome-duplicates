# Bookmark Cleaner

A Chrome extension to find and remove duplicated bookmarks.

![screenshot](screenshot1.png)

Click the toolbar icon to open the list of bookmarks that point to the same
URL, grouped by URL. For each group the oldest bookmark is left unselected
and the others are selected for deletion; change the selection as you like,
then press **Delete selected duplicates**.

- At least one copy of each bookmark is always kept.
- Deletion asks for confirmation and can be undone with the **Undo** button
  (the bookmarks are recreated in their original folder and position).
- Optionally, URLs that differ only in http/https, `www.`, trailing slash,
  `#fragment` or tracking parameters (`utm_*`, `fbclid`, `gclid`, ...) are
  considered duplicates too.
- The list is updated automatically when bookmarks change, keeping your
  selection.

## Install from source

1. Open `chrome://extensions` and enable *Developer mode*.
2. Click *Load unpacked* and select this directory.

Chrome 90 or later is required.

## Development

The logic that finds the duplicates is in `duplicates.js`, independent from
the Chrome API; it is tested with node:

```
node --test
```
