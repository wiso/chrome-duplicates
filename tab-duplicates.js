// Duplicates tab: bookmarks saved more than once.
TABS.duplicates = (function() {
    // groups currently found, see groupDuplicates in duplicates.js
    var groups = [];
    // ids of the selected bookmarks, and of all the bookmarks already seen:
    // a refresh keeps the selection made by the user, and only the new
    // bookmarks get the default selection
    var selected = new Set();
    var seen = new Set();
    // rows of the page by bookmark id, to update them without rendering again
    var rows = new Map();

    function keyFunction() {
        return document.getElementById("normalize").checked ? normalizeUrl : undefined;
    }

    function update(tree) {
        groups = groupDuplicates(flattenTree(tree), keyFunction());
        var stillSeen = new Set();
        groups.forEach(function(group) {
            group.bookmarks.forEach(function(bookmark, j) {
                if (!seen.has(bookmark.id) && j != 0) selected.add(bookmark.id);
                stillSeen.add(bookmark.id);
            });
            // groups can change (e.g. normalization turned off): never show
            // every copy as selected
            if (group.bookmarks.every(function(b) { return selected.has(b.id); })) {
                selected.delete(group.bookmarks[0].id);
            }
        });
        // forget the bookmarks that are not duplicated anymore
        seen = stillSeen;
        selected.forEach(function(id) {
            if (!seen.has(id)) selected.delete(id);
        });
    }

    function count() {
        return groups.length;
    }

    function summary() {
        if (!groups.length) return "No duplicates";
        var copies = groups.reduce(function(n, g) { return n + g.bookmarks.length; }, 0);
        return plural(groups.length, "link") + " saved more than once · "
            + plural(copies - groups.length, "extra copy", "extra copies");
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
            // the label gives the name (folder and title), the tag the state
            checkbox.setAttribute("aria-describedby", "tag-" + bookmark.id);
            var pathText = bookmark.path.join(" › ");
            var path = pathText ? element("span", { className: "path", textContent: pathText, title: pathText }) : null;
            var label = element("label", { htmlFor: checkbox.id, className: "copy-text" }, [
                path,
                element("span", { className: "copy-title", textContent: bookmark.title || bookmark.url, title: bookmark.title }),
                // always show the URL, so every copy reads the same way
                element("span", { className: "variant", textContent: bookmark.url, title: bookmark.url })
            ]);
            var row = element("li", { className: "copy" }, [
                checkbox,
                label,
                element("span", { className: "date", textContent: formatDate(bookmark.dateAdded), title: "Date added" }),
                element("span", { className: "tag", id: "tag-" + bookmark.id }),
                element("button", {
                    className: "button small keep-only",
                    textContent: "Keep only this",
                    title: "Keep this copy and select the others for deletion",
                    onclick: function() { keepOnlyThis(group, bookmark); }
                })
            ]);
            rows.set(bookmark.id, { row: row, checkbox: checkbox, group: group });
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

    function render(container, filter) {
        var visible = groups.filter(function(group) {
            return group.bookmarks.some(function(b) { return matchesText([b.title, b.url].concat(b.path), filter); });
        });
        rows = new Map();
        if (!groups.length) {
            container.replaceChildren(emptyState("Your bookmarks are tidy!",
                document.getElementById("normalize").checked
                    ? "No duplicated bookmarks found."
                    : "No duplicated bookmarks found. Turn on smart matching to also find links that differ only slightly.",
                supportLink()));
        }
        else if (!visible.length) {
            container.replaceChildren(emptyState("Nothing matches the filter",
                "No duplicated bookmark contains “" + filter + "”."));
        }
        else {
            container.replaceChildren.apply(container, visible.map(renderGroup));
        }
        updateRows();
    }

    function updateRows() {
        rows.forEach(function(item, id) {
            var deleting = selected.has(id);
            item.checkbox.checked = deleting;
            item.row.classList.toggle("deleting", deleting);
            item.row.querySelector(".tag").textContent = deleting ? "Delete" : "Keep";
            // "Keep only this" is useless when this copy is already the only
            // one kept: hide it, keeping its space so that rows stay aligned
            var alreadyOnly = !deleting && item.group.bookmarks.every(function(b) {
                return b.id == id || selected.has(b.id);
            });
            item.row.querySelector(".keep-only").classList.toggle("useless", alreadyOnly);
        });
    }

    function selectionChanged() {
        updateRows();
        updateActions();
    }

    function actions() {
        if (!groups.length) return null;
        var ids = idsToRemove(groups, selected);
        var n = ids.length;
        var hidden = ids.filter(function(id) { return !rows.has(id); }).length;
        var text = n ? plural(n, "bookmark") + " selected for deletion" : "Nothing selected";
        if (hidden) text += " (" + hidden + " hidden by the filter)";
        return {
            text: text,
            buttons: [
                { label: "Select suggested", run: selectSuggested },
                { label: "Deselect all", run: deselectAll },
                { label: n ? "Delete " + plural(n, "bookmark") : "Delete", run: deleteSelected, danger: true, disabled: n == 0 }
            ]
        };
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
        selectionChanged();
    }

    function keepOnlyThis(group, bookmark) {
        group.bookmarks.forEach(function(b) {
            if (b.id == bookmark.id) selected.delete(b.id);
            else selected.add(b.id);
        });
        selectionChanged();
    }

    function selectSuggested() {
        selected = new Set();
        groups.forEach(function(group) {
            group.bookmarks.slice(1).forEach(function(b) { selected.add(b.id); });
        });
        selectionChanged();
    }

    function deselectAll() {
        selected = new Set();
        selectionChanged();
    }

    async function deleteSelected() {
        var requested = idsToRemove(groups, selected);
        if (!requested.length || busy) return;
        var ok = await confirmDialog("Delete " + plural(requested.length, "bookmark") + "?",
            "At least one copy of each link is kept, and you can undo right after.",
            "Delete");
        if (!ok) return;
        await runOperation(async function() {
            // bookmarks may have changed (e.g. by sync) since the list was
            // shown: apply the keep-one rule again on the current tree
            var fresh = groupDuplicates(flattenTree(await chrome.bookmarks.getTree()), keyFunction());
            var ids = idsToRemove(fresh, new Set(requested));
            var byId = new Map();
            fresh.forEach(function(group) {
                group.bookmarks.forEach(function(b) { byId.set(b.id, b); });
            });
            var result = await removeBookmarks(ids, byId);
            var message = "Deleted " + plural(result.removed.length, "bookmark") + ".";
            if (result.failed) message += " " + result.failed + " could not be deleted.";
            var skipped = requested.length - ids.length;
            if (skipped) message += " " + skipped + " kept because the other copies were removed in the meantime.";
            return {
                message: message,
                undo: result.removed.length ? function() { return restoreBookmarks(result.removed); } : null
            };
        });
    }

    return {
        update: update, count: count, summary: summary, render: render, actions: actions, smart: true
    };
})();
