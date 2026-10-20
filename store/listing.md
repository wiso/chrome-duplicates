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

The name and the summary come from `manifest.json`:

    Bookmark Cleaner – Remove Duplicate Bookmarks

Another extension called "Bookmark Cleaner" exists in the store: the main
keyword in the name helps people searching for it. `short_name` keeps
"Bookmark Cleaner" where space is limited; the toolbar tooltip
(`action.default_title`) is also "Bookmark Cleaner".

## Summary (from `manifest.json`, max 132 characters)

    Find and remove duplicate bookmarks, empty folders and broken links. Smart URL matching, one-click undo. Open source, no tracking.

## Category

Workflow & Planning (or Tools).

## Description

```
Years of bookmarks, zero duplicates — in one click.

You saved that article in "Read later", then again in "Work", then once more from your phone. Chrome has no built-in way to find duplicate bookmarks: Bookmark Cleaner, free and open source, finds them in a second, across every folder, including the ones synced from your other devices, and lets you remove them safely.

FEATURES
• Finds every duplicate bookmark and shows where each copy lives and when you saved it
• Smart matching (optional): links that differ only in http/https, "www.", trailing slash, #fragment or tracking parameters such as utm_source are treated as duplicates
• Sensible defaults: the oldest copy is kept, the others are pre-selected; each copy is clearly marked Keep or Delete
• "Keep only this" to choose the copy to keep with one click
• Filter by title, URL or folder to go through large collections
• Empty folders: finds folders without bookmarks, also nested ones, and removes them
• Same-name folders: merges folders with the same name in the same place into the oldest one
• Broken links (opt-in): checks every bookmarked page and lists the ones that do not exist anymore, the unreachable sites and the server errors
• You can't lose a bookmark: at least one copy of each link is always kept
• Confirmation before deleting and one-click Undo: deleted bookmarks go back to their original folder and position
• Always up to date: the list refreshes when your bookmarks change
• Light and dark mode

HOW TO USE
1. Click the Bookmark Cleaner icon in the toolbar.
2. Review the duplicates, grouped by link.
3. Press Delete, confirm, done. Press Undo if you change your mind.
4. Use the other tabs for empty folders, same-name folders and broken links.

PRIVATE BY DESIGN
No analytics, no tracking, and your bookmarks are never sent anywhere. Bookmark Cleaner reads your bookmarks and the site icons already cached by the browser. Only if you start the broken-link check does it ask for access to the sites, and then it just contacts each bookmarked page to see if it still exists; you can revoke the access at any time.

FREE AND OPEN SOURCE
MIT license. Source code, issues and ideas: https://github.com/wiso/chrome-duplicates
```

## What's new in 0.3.0

```
New tabs: remove empty folders, merge folders with the same name, and find broken links (opt-in, asks for permission first). Every change asks for confirmation and can be undone.
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
| `screenshot-3-broken-links.png` | Screenshot (1280×800) |
| `screenshot-4-empty-folders.png` | Screenshot (1280×800) |
| `screenshot-5-dark.png` | Screenshot (1280×800) |
| `promo-small-440x280.png` | Small promo tile |
| `promo-marquee-1400x560.png` | Marquee promo tile |

## Privacy practices

Single purpose:

```
Clean up the user's bookmarks: find and remove duplicate bookmarks, empty folders, folders with the same name and bookmarks whose page does not exist anymore.
```

`bookmarks` permission:

```
The bookmarks permission is the core of the extension: it reads the user's bookmarks to find duplicates, empty folders, same-name folders and the links to check; it removes or merges only what the user selects and confirms, and restores it if the user presses Undo. Bookmarks are processed locally and never transmitted.
```

`favicon` permission:

```
The favicon permission is used only to show the icon of each website next to its bookmarks, so users can recognize the sites at a glance. Icons are read from the browser's local favicon cache through chrome-extension://<id>/_favicon/; no network request is made and no data leaves the user's computer.
```

Optional host permissions (`http://*/*`, `https://*/*`):

```
Host access is optional and requested at runtime only when the user clicks "Check links" in the Broken links tab. It is used to send a HEAD (or, if not supported, GET) request to each bookmarked URL, without cookies, to read only the HTTP status and find pages that no longer exist. No page content is read or stored, nothing is sent to any other server, and the user can revoke the access from the same tab.
```

Data usage: no user data is collected or transmitted; no remote code.

## Links

- Website: https://wiso.github.io/chrome-duplicates/
- Support: https://github.com/wiso/chrome-duplicates/issues
