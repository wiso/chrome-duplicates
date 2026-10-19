// groups currently shown, see groupDuplicates in duplicates.js
var groups = [];
// ids of the selected bookmarks, and of all the bookmarks already shown:
// a refresh keeps the selection made by the user, and only the new
// bookmarks get the default selection
var selected = new Set();
var shown = new Set();
// rows of the page by bookmark id, to update them without rendering again
var rows = new Map();
// bookmarks removed by the last deletion, to undo it
var lastRemoved = [];
// true while a deletion or an undo is running
var busy = false;
var loaded = false;

var NORMALIZE_KEY = "normalizeUrls";

function loadOption() {
    try {
        return localStorage.getItem(NORMALIZE_KEY) == "true";
    } catch (e) {
        return false;
    }
}

function saveOption(value) {
    try {
        localStorage.setItem(NORMALIZE_KEY, value);
    } catch (e) {
        // the option is just not remembered
    }
}

function element(tag, properties, children) {
    var el = document.createElement(tag);
    Object.assign(el, properties || {});
    (children || []).forEach(function(child) {
        if (child !== null) el.append(child);
    });
    return el;
}

function plural(n, word, words) {
    return n + " " + (n == 1 ? word : words || word + "s");
}

// icon of the site, from the browser cache (needs the "favicon" permission)
function faviconUrl(url) {
    return chrome.runtime.getURL("/_favicon/") + "?pageUrl=" + encodeURIComponent(url) + "&size=32";
}

function formatDate(time) {
    if (!time) return "";
    return new Date(time).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// message at the bottom of the page, with an Undo button while there is
// something to undo
var toastTimer = null;
function showToast(message) {
    document.getElementById("toast-message").textContent = message;
    document.getElementById("toast-undo").hidden = !lastRemoved.length;
    document.getElementById("toast").hidden = false;
    clearTimeout(toastTimer);
    // keep it while it offers Undo
    if (!lastRemoved.length) toastTimer = setTimeout(hideToast, 6000);
}

function hideToast() {
    document.getElementById("toast").hidden = true;
}

// modal dialog, resolves to true if the user confirms
function confirmDialog(title, text, button) {
    var dialog = document.getElementById("confirm");
    document.getElementById("confirm-title").textContent = title;
    document.getElementById("confirm-text").textContent = text;
    document.getElementById("confirm-ok").textContent = button;
    dialog.returnValue = "";
    dialog.showModal();
    return new Promise(function(resolve) {
        dialog.addEventListener("close", function() {
            resolve(dialog.returnValue == "ok");
        }, { once: true });
    });
}

function keyFunction() {
    return document.getElementById("normalize").checked ? normalizeUrl : undefined;
}

function refresh() {
    chrome.bookmarks.getTree().then(function(tree) {
        groups = groupDuplicates(flattenTree(tree), keyFunction());
        loaded = true;
        render();
    });
}

// refresh at most once for a burst of bookmark events (e.g. an import)
var refreshTimer = null;
function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 300);
}

function matchesFilter(group, filter) {
    if (!filter) return true;
    return group.bookmarks.some(function(b) {
        return (b.title + " " + b.url + " " + b.path.join(" ")).toLowerCase().includes(filter);
    });
}

function renderGroup(group) {
    var first = group.bookmarks[0];
    var list = element("ul", { className: "copies" });
    group.bookmarks.forEach(function(bookmark) {
        var checkbox = element("input", {
            type: "checkbox",
            id: "bookmark-" + bookmark.id,
            onchange: function() { toggle(group, bookmark, checkbox); }
        });
        var path = bookmark.path.length ? element("span", { className: "path", textContent: bookmark.path.join(" › ") }) : null;
        var label = element("label", { htmlFor: checkbox.id, className: "copy-text" }, [
            path,
            element("span", { className: "copy-title", textContent: bookmark.title || bookmark.url, title: bookmark.title }),
            bookmark.url != first.url ? element("span", { className: "variant", textContent: bookmark.url, title: bookmark.url }) : null
        ]);
        var row = element("li", { className: "copy" }, [
            checkbox,
            label,
            element("span", { className: "date", textContent: formatDate(bookmark.dateAdded), title: "Date added" }),
            element("span", { className: "tag" }),
            element("button", {
                className: "button small keep-only",
                textContent: "Keep only this",
                title: "Keep this copy and select the others for deletion",
                onclick: function() { keepOnlyThis(group, bookmark); }
            })
        ]);
        rows.set(bookmark.id, { row: row, checkbox: checkbox });
        list.append(row);
    });
    return element("section", { className: "group" }, [
        element("header", { className: "group-header" }, [
            element("img", { className: "favicon", src: faviconUrl(first.url), alt: "", width: 20, height: 20 }),
            element("div", { className: "group-heading" }, [
                element("div", { className: "group-title", textContent: first.title || first.url }),
                element("a", { className: "group-url", href: first.url, target: "_blank", rel: "noopener", textContent: first.url, title: "Open in a new tab" })
            ]),
            element("span", { className: "badge", textContent: group.bookmarks.length + " copies" })
        ]),
        list
    ]);
}

function emptyState(title, text) {
    return element("div", { className: "empty" }, [
        element("img", { src: "icon128.png", alt: "", width: 96, height: 96 }),
        element("h2", { textContent: title }),
        element("p", { textContent: text })
    ]);
}

function render() {
    var stillShown = new Set();
    groups.forEach(function(group) {
        group.bookmarks.forEach(function(bookmark, j) {
            if (!shown.has(bookmark.id) && j != 0) selected.add(bookmark.id);
            stillShown.add(bookmark.id);
        });
        // groups can change (e.g. normalization turned off): never show
        // every copy as selected
        if (group.bookmarks.every(function(b) { return selected.has(b.id); })) {
            selected.delete(group.bookmarks[0].id);
        }
    });
    // forget the bookmarks that are not duplicated anymore
    shown = stillShown;
    selected.forEach(function(id) {
        if (!shown.has(id)) selected.delete(id);
    });

    var filter = document.getElementById("filter").value.trim().toLowerCase();
    var visible = groups.filter(function(group) { return matchesFilter(group, filter); });
    var container = document.getElementById("bookmarks");
    rows = new Map();
    if (!groups.length) {
        container.replaceChildren(emptyState("Your bookmarks are tidy!",
            document.getElementById("normalize").checked
                ? "No duplicated bookmarks found."
                : "No duplicated bookmarks found. Turn on smart matching to also find links that differ only slightly."));
    }
    else if (!visible.length) {
        container.replaceChildren(emptyState("Nothing matches the filter",
            "No duplicated bookmark contains “" + filter + "”."));
    }
    else {
        container.replaceChildren.apply(container, visible.map(renderGroup));
    }

    var copies = groups.reduce(function(n, g) { return n + g.bookmarks.length; }, 0);
    document.getElementById("summary").textContent = groups.length
        ? plural(groups.length, "link") + " saved more than once · "
          + plural(copies - groups.length, "extra copy", "extra copies")
        : "No duplicates";
    document.getElementById("actionbar").hidden = !groups.length;
    updateSelection();
}

// update the rows and the buttons after a change of the selection
function updateSelection() {
    rows.forEach(function(item, id) {
        var deleting = selected.has(id);
        item.checkbox.checked = deleting;
        item.checkbox.setAttribute("aria-label", deleting ? "Selected for deletion" : "Kept");
        item.row.classList.toggle("deleting", deleting);
        item.row.querySelector(".tag").textContent = deleting ? "Delete" : "Keep";
    });
    var ids = idsToRemove(groups, selected);
    var n = ids.length;
    var hidden = ids.filter(function(id) { return !rows.has(id); }).length;
    var text = n ? plural(n, "bookmark") + " selected for deletion" : "Nothing selected";
    if (hidden) text += " (" + hidden + " hidden by the filter)";
    document.getElementById("selection").textContent = text;
    var button = document.getElementById("delete");
    button.disabled = n == 0 || busy;
    button.textContent = n ? "Delete " + plural(n, "bookmark") : "Delete";
}

function toggle(group, bookmark, checkbox) {
    if (checkbox.checked) {
        var all = group.bookmarks.every(function(b) { return b.id == bookmark.id || selected.has(b.id); });
        if (all) {
            // never delete every copy of a bookmark
            checkbox.checked = false;
            showToast("At least one copy of each bookmark is kept.");
            return;
        }
        selected.add(bookmark.id);
    }
    else {
        selected.delete(bookmark.id);
    }
    updateSelection();
}

function keepOnlyThis(group, bookmark) {
    group.bookmarks.forEach(function(b) {
        if (b.id == bookmark.id) selected.delete(b.id);
        else selected.add(b.id);
    });
    updateSelection();
}

function selectSuggested() {
    selected = new Set();
    groups.forEach(function(group) {
        group.bookmarks.slice(1).forEach(function(b) { selected.add(b.id); });
    });
    updateSelection();
}

function deselectAll() {
    selected = new Set();
    updateSelection();
}

async function deleteSelected() {
    var requested = idsToRemove(groups, selected);
    if (!requested.length || busy) return;
    var ok = await confirmDialog("Delete " + plural(requested.length, "bookmark") + "?",
        "At least one copy of each link is kept, and you can undo right after.",
        "Delete");
    if (!ok || busy) return;
    busy = true;
    updateSelection();
    // bookmarks may have changed (e.g. by sync) since the list was shown:
    // apply the keep-one rule again on the current tree
    var fresh = groupDuplicates(flattenTree(await chrome.bookmarks.getTree()), keyFunction());
    var ids = idsToRemove(fresh, new Set(requested));
    var byId = new Map();
    fresh.forEach(function(group) {
        group.bookmarks.forEach(function(b) { byId.set(b.id, b); });
    });
    var removed = [];
    var failed = 0;
    await Promise.all(ids.map(function(id) {
        return chrome.bookmarks.remove(id).then(function() {
            removed.push(byId.get(id));
        }, function(e) {
            console.error("cannot remove " + id + ": " + e.message);
            failed++;
        });
    }));
    busy = false;
    // if nothing was deleted, the previous deletion can still be undone
    if (removed.length) lastRemoved = removed;
    var message = "Deleted " + plural(removed.length, "bookmark") + ".";
    if (failed) message += " " + failed + " could not be deleted.";
    var skipped = requested.length - ids.length;
    if (skipped) message += " " + skipped + " kept because the other copies were removed in the meantime.";
    showToast(message);
    refresh();
}

// recreate the bookmarks removed by the last deletion, at their position
async function undo() {
    if (busy) return;
    busy = true;
    updateSelection();
    var toRestore = restoreOrder(lastRemoved);
    lastRemoved = [];
    var failed = 0;
    for (var b of toRestore) {
        try {
            await chrome.bookmarks.create({ parentId: b.parentId, index: b.index, title: b.title, url: b.url });
        } catch (e) {
            // e.g. the folder was deleted in the meantime: use the default folder
            try {
                await chrome.bookmarks.create({ title: b.title, url: b.url });
            } catch (e2) {
                console.error("cannot restore " + b.url + ": " + e2.message);
                failed++;
            }
        }
    }
    busy = false;
    showToast("Restored " + plural(toRestore.length - failed, "bookmark") + "."
              + (failed ? " " + failed + " could not be restored." : ""));
    refresh();
}

document.addEventListener("DOMContentLoaded", function() {
    var normalize = document.getElementById("normalize");
    normalize.checked = loadOption();
    normalize.addEventListener("change", function() {
        saveOption(normalize.checked);
        refresh();
    });
    document.getElementById("filter").addEventListener("input", function() {
        if (loaded) render();
    });
    document.getElementById("suggested").addEventListener("click", selectSuggested);
    document.getElementById("clear").addEventListener("click", deselectAll);
    document.getElementById("delete").addEventListener("click", deleteSelected);
    document.getElementById("toast-undo").addEventListener("click", undo);
    document.getElementById("toast-close").addEventListener("click", hideToast);

    // keep the list up to date when bookmarks are changed elsewhere
    [chrome.bookmarks.onCreated, chrome.bookmarks.onRemoved, chrome.bookmarks.onChanged,
     chrome.bookmarks.onMoved, chrome.bookmarks.onImportEnded].forEach(function(event) {
        event.addListener(scheduleRefresh);
    });

    refresh();
});
