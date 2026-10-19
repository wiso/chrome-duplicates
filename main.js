// groups currently shown, see groupDuplicates in duplicates.js
var groups = [];
// ids of the selected bookmarks, and of all the bookmarks already shown:
// a refresh keeps the selection made by the user, and only the new
// bookmarks get the default selection
var selected = new Set();
var shown = new Set();
// bookmarks removed by the last deletion, to undo it
var lastRemoved = [];

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
        el.append(child);
    });
    return el;
}

function setStatus(message, action) {
    var status = document.getElementById("status");
    status.replaceChildren(message);
    if (action) {
        status.append(" ", element("button", { textContent: action.label, onclick: action.run }));
    }
}

function refresh() {
    var normalize = document.getElementById("normalize").checked;
    chrome.bookmarks.getTree().then(function(tree) {
        groups = groupDuplicates(flattenTree(tree), normalize ? normalizeUrl : undefined);
        render();
    });
}

// refresh at most once for a burst of bookmark events (e.g. an import)
var refreshTimer = null;
function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 300);
}

function render() {
    var stillShown = new Set();
    var table = element("table");
    groups.forEach(function(group) {
        var mainUrl = group.bookmarks[0].url;
        var tbody = element("tbody");
        tbody.append(element("tr", { className: "url" }, [
            element("td", { colSpan: 2 }, [
                element("a", { href: mainUrl, target: "_blank", rel: "noopener", textContent: mainUrl })
            ])
        ]));
        group.bookmarks.forEach(function(bookmark, j) {
            if (!shown.has(bookmark.id) && j != 0) selected.add(bookmark.id);
            stillShown.add(bookmark.id);
            var checkbox = element("input", {
                type: "checkbox",
                id: "bookmark-" + bookmark.id,
                checked: selected.has(bookmark.id),
                onchange: function() { toggle(group, bookmark, checkbox); }
            });
            var label = element("label", { htmlFor: checkbox.id }, [
                bookmark.path.concat([bookmark.title]).join(" > ")
            ]);
            if (bookmark.url != mainUrl) {
                label.append(element("span", { className: "variant", textContent: bookmark.url }));
            }
            tbody.append(element("tr", {}, [element("td", {}, [checkbox]), element("td", {}, [label])]));
        });
        table.append(tbody);
    });
    // forget the bookmarks that are not duplicated anymore
    shown = stillShown;
    selected.forEach(function(id) {
        if (!shown.has(id)) selected.delete(id);
    });

    var n = groups.length;
    var container = document.getElementById("bookmarks");
    if (!n) {
        container.replaceChildren("No duplicates found");
    }
    else {
        container.replaceChildren("found " + n + " duplicated link" + (n > 1 ? "s" : ""), table);
    }
    updateButtons();
}

function toggle(group, bookmark, checkbox) {
    if (checkbox.checked) {
        var all = group.bookmarks.every(function(b) { return b.id == bookmark.id || selected.has(b.id); });
        if (all) {
            // never delete every copy of a bookmark
            checkbox.checked = false;
            setStatus("At least one copy of each bookmark is kept.");
            return;
        }
        selected.add(bookmark.id);
    }
    else {
        selected.delete(bookmark.id);
    }
    // remove the warning above, but keep the undo button
    if (!lastRemoved.length) setStatus("");
    updateButtons();
}

function updateButtons() {
    var n = idsToRemove(groups, selected).length;
    var button = document.getElementById("delete");
    button.disabled = n == 0;
    button.textContent = n ? "Delete " + n + " selected duplicate" + (n > 1 ? "s" : "") : "Delete selected duplicates";
}

function selectSuggested() {
    selected = new Set();
    groups.forEach(function(group) {
        group.bookmarks.slice(1).forEach(function(b) { selected.add(b.id); });
    });
    render();
}

function deselectAll() {
    selected = new Set();
    render();
}

function deleteSelected() {
    var ids = idsToRemove(groups, selected);
    if (!ids.length) return;
    if (!confirm("Delete " + ids.length + " bookmark" + (ids.length > 1 ? "s" : "") + "?")) return;
    var byId = new Map();
    groups.forEach(function(group) {
        group.bookmarks.forEach(function(b) { byId.set(b.id, b); });
    });
    var removed = [];
    var failed = 0;
    Promise.all(ids.map(function(id) {
        return chrome.bookmarks.remove(id).then(function() {
            removed.push(byId.get(id));
        }, function(e) {
            console.error("cannot remove " + id + ": " + e.message);
            failed++;
        });
    })).then(function() {
        lastRemoved = removed;
        var message = "Deleted " + removed.length + " bookmark" + (removed.length != 1 ? "s" : "") + ".";
        if (failed) message += " " + failed + " could not be deleted.";
        setStatus(message, removed.length ? { label: "Undo", run: undo } : null);
        refresh();
    });
}

// recreate the bookmarks removed by the last deletion, at their position
async function undo() {
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
    setStatus("Restored " + (toRestore.length - failed) + " bookmark" + (toRestore.length - failed != 1 ? "s" : "") + "."
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
    document.getElementById("suggested").addEventListener("click", selectSuggested);
    document.getElementById("clear").addEventListener("click", deselectAll);
    document.getElementById("delete").addEventListener("click", deleteSelected);

    // keep the list up to date when bookmarks are changed elsewhere
    [chrome.bookmarks.onCreated, chrome.bookmarks.onRemoved, chrome.bookmarks.onChanged,
     chrome.bookmarks.onMoved, chrome.bookmarks.onImportEnded].forEach(function(event) {
        event.addListener(scheduleRefresh);
    });

    refresh();
});
