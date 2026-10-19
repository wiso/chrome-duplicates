# Chrome Web Store listing

Material for the [Chrome Web Store listing](https://chromewebstore.google.com/detail/bookmark-cleaner/apmbebpbnhlmonbpggbaljkinnfgpmki).

## Package

```
./store/package.sh
```

creates `store/bookmark-cleaner-<version>.zip` with only the files the
extension needs; upload it in the developer dashboard (*Package → Upload new
package*).

## Name

The name and the summary come from `manifest.json`. Another extension called
"Bookmark Cleaner" exists in the store; adding the main keyword to the name
helps people searching for it, for example:

    Bookmark Cleaner – Remove Duplicate Bookmarks

## Summary (from `manifest.json`, max 132 characters)

    Find and remove duplicate bookmarks. Smart URL matching, always keeps one copy, one-click undo. Private: no tracking.

## Category

Workflow & Planning (or Tools).

## Description

```
Years of bookmarks, zero duplicates — in one click.

You saved that article in "Read later", then again in "Work", then once more from your phone. Chrome has no built-in way to find duplicate bookmarks: Bookmark Cleaner finds them in a second, across every folder, including the ones synced from your other devices, and lets you remove them safely.

FEATURES
• Finds every duplicate bookmark and shows where each copy lives and when you saved it
• Smart matching (optional): links that differ only in http/https, "www.", trailing slash, #fragment or tracking parameters such as utm_source are treated as duplicates
• Sensible defaults: the oldest copy is kept, the others are pre-selected; each copy is clearly marked Keep or Delete
• "Keep only this" to choose the copy to keep with one click
• Filter by title, URL or folder to go through large collections
• You can't lose a bookmark: at least one copy of each link is always kept
• Confirmation before deleting and one-click Undo: deleted bookmarks go back to their original folder and position
• Always up to date: the list refreshes when your bookmarks change
• Light and dark mode

HOW TO USE
1. Click the Bookmark Cleaner icon in the toolbar.
2. Review the duplicates, grouped by link.
3. Press Delete, confirm, done. Press Undo if you change your mind.

PRIVATE BY DESIGN
No network access, no analytics, no tracking. Bookmark Cleaner only reads your bookmarks and the site icons already cached by the browser; everything stays on your computer.

FREE AND OPEN SOURCE
MIT license. Source code, issues and ideas: https://github.com/wiso/chrome-duplicates
```

## What's new in 0.2.0

```
New design: one card per link with site icons, Keep/Delete labels, dates, filter and dark mode. Smart URL matching. Always keeps at least one copy, asks for confirmation and offers Undo.
```

## Images

| File | Use |
| --- | --- |
| `screenshot-1-duplicates.png` | Screenshot (1280×800) |
| `screenshot-2-confirm.png` | Screenshot (1280×800) |
| `screenshot-3-undo.png` | Screenshot (1280×800) |
| `screenshot-4-dark.png` | Screenshot (1280×800) |
| `promo-small-440x280.png` | Small promo tile |
| `promo-marquee-1400x560.png` | Marquee promo tile |

## Privacy practices

- Single purpose: find and remove duplicate bookmarks.
- `bookmarks` permission: needed to read the bookmarks, find the duplicates and remove the ones the user selects.
- `favicon` permission: shows the icon of each site, from the browser's local cache.
- No remote code; no user data is collected or transmitted.

## Links

- Website: https://wiso.github.io/chrome-duplicates/
- Support: https://github.com/wiso/chrome-duplicates/issues
