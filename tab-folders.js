// Empty folders and same-name folders tabs.

// Selection helpers shared by the tabs: new items get the default
// selection, items already seen keep the user's choice.
function updateSelection(keys, selected, seen, defaultSelected) {
    var stillSeen = new Set(keys);
    keys.forEach(function(key) {
        if (!seen.has(key) && defaultSelected) selected.add(key);
    });
    selected.forEach(function(key) {
        if (!stillSeen.has(key)) selected.delete(key);
    });
    return stillSeen;
}

function selectionRow(id, checked, onchange, content, tagText, extra) {
    var checkbox = element("input", { type: "checkbox", id: id, checked: checked, onchange: onchange });
    checkbox.setAttribute("aria-describedby", "tag-" + id);
    var tag = element("span", { className: "tag", id: "tag-" + id, textContent: tagText(checked) });
    var row = element("li", { className: "copy" + (checked ? " deleting" : "") }, [
        checkbox,
        element("label", { htmlFor: id, className: "copy-text" }, content),
        extra || null,
        tag
    ]);
    checkbox.addEventListener("change", function() {
        row.classList.toggle("deleting", checkbox.checked);
        tag.textContent = tagText(checkbox.checked);
    });
    return row;
}

function folderIcon() {
    return element("span", { className: "folder-icon", textContent: "📁", ariaHidden: "true" });
}

TABS.empty = (function() {
    var folders = [];
    var selected = new Set();
    var seen = new Set();

    function update(tree) {
        folders = findEmptyFolders(tree);
        seen = updateSelection(folders.map(function(f) { return f.id; }), selected, seen, true);
    }

    function count() {
        return folders.length;
    }

    function summary() {
        return folders.length ? plural(folders.length, "empty folder") : "No empty folders";
    }

    function render(container, filter) {
        if (!folders.length) {
            container.replaceChildren(emptyState("No empty folders",
                "Every folder contains at least one bookmark."));
            return;
        }
        var visible = folders.filter(function(f) { return matchesText([f.title].concat(f.path), filter); });
        if (!visible.length) {
            container.replaceChildren(emptyState("Nothing matches the filter",
                "No empty folder contains “" + filter + "”."));
            return;
        }
        var list = element("ul", { className: "copies" });
        visible.forEach(function(folder) {
            var pathText = folder.path.join(" › ");
            list.append(selectionRow("empty-" + folder.id, selected.has(folder.id), function(event) {
                if (event.target.checked) selected.add(folder.id);
                else selected.delete(folder.id);
                updateActions();
            }, [
                element("span", { className: "path", textContent: pathText, title: pathText }),
                element("span", { className: "copy-title", textContent: folder.title || "(untitled folder)" }),
                folder.subfolders ? element("span", { className: "variant", textContent: "contains " + plural(folder.subfolders, "empty subfolder") }) : null
            ], function(checked) { return checked ? "Delete" : "Keep"; },
            element("span", { className: "date", textContent: formatDate(folder.dateAdded), title: "Date added" })));
        });
        container.replaceChildren(element("section", { className: "group" }, [
            element("header", { className: "group-header" }, [
                folderIcon(),
                element("div", { className: "group-heading" }, [
                    element("div", { className: "group-title", textContent: "Folders without bookmarks" }),
                    element("div", { className: "group-subtitle", textContent: "Empty subfolders are removed with their folder." })
                ]),
                element("span", { className: "badge", textContent: plural(folders.length, "folder") })
            ]),
            list
        ]));
    }

    function actions() {
        if (!folders.length) return null;
        var n = selected.size;
        return {
            text: n ? plural(n, "folder") + " selected for deletion" : "Nothing selected",
            buttons: [
                { label: "Select all", run: function() { folders.forEach(function(f) { selected.add(f.id); }); render(document.getElementById("bookmarks"), filterText()); updateActions(); } },
                { label: "Deselect all", run: function() { selected.clear(); render(document.getElementById("bookmarks"), filterText()); updateActions(); } },
                { label: n ? "Delete " + plural(n, "folder") : "Delete", run: deleteSelected, danger: true, disabled: n == 0 }
            ]
        };
    }

    // recreate a folder and its empty subfolders
    async function restoreFolder(parentId, index, snapshot) {
        var created = await chrome.bookmarks.create({ parentId: parentId, index: index, title: snapshot.title });
        for (var i = 0; i < snapshot.children.length; i++) {
            await restoreFolder(created.id, i, snapshot.children[i]);
        }
    }

    async function deleteSelected() {
        var requested = new Set(selected);
        if (!requested.size || busy) return;
        var ok = await confirmDialog("Delete " + plural(requested.size, "empty folder") + "?",
            "Only folders without bookmarks are deleted, and you can undo right after.", "Delete");
        if (!ok) return;
        await runOperation(async function() {
            // delete only the folders that are still empty now
            var fresh = findEmptyFolders(await chrome.bookmarks.getTree()).filter(function(f) { return requested.has(f.id); });
            var removed = [];
            var failed = 0;
            for (var folder of fresh) {
                try {
                    await chrome.bookmarks.removeTree(folder.id);
                    removed.push(folder);
                } catch (e) {
                    console.error("cannot remove folder " + folder.id + ": " + e.message);
                    failed++;
                }
            }
            var message = "Deleted " + plural(removed.length, "empty folder") + ".";
            if (failed) message += " " + failed + " could not be deleted.";
            var skipped = requested.size - fresh.length;
            if (skipped) message += " " + skipped + " kept because they are not empty anymore.";
            return {
                message: message,
                undo: removed.length ? async function() {
                    var notRestored = 0;
                    for (var f of restoreOrder(removed)) {
                        try {
                            await restoreFolder(f.parentId, f.index, f.snapshot);
                        } catch (e) {
                            console.error("cannot restore folder " + f.title + ": " + e.message);
                            notRestored++;
                        }
                    }
                    return "Restored " + plural(removed.length - notRestored, "folder") + "."
                        + (notRestored ? " " + notRestored + " could not be restored." : "");
                } : null
            };
        });
    }

    return { update: update, count: count, summary: summary, render: render, actions: actions };
})();

TABS.samename = (function() {
    var groups = [];
    var selected = new Set();
    var seen = new Set();

    function update(tree) {
        groups = findSameNameFolders(tree);
        seen = updateSelection(groups.map(function(g) { return g.key; }), selected, seen, true);
    }

    function count() {
        return groups.length;
    }

    function summary() {
        return groups.length ? plural(groups.length, "folder name") + " used more than once in the same place" : "No folders with the same name";
    }

    function renderGroup(group) {
        var id = "merge-" + group.key.replace(/[^a-z0-9]/gi, "_");
        var checkbox = element("input", { type: "checkbox", id: id, checked: selected.has(group.key) });
        var section;
        checkbox.addEventListener("change", function() {
            if (checkbox.checked) selected.add(group.key);
            else selected.delete(group.key);
            section.classList.toggle("merging", checkbox.checked);
            updateActions();
        });
        var list = element("ul", { className: "copies" });
        group.folders.forEach(function(folder, i) {
            list.append(element("li", { className: "copy" + (i ? " merged" : "") }, [
                folderIcon(),
                element("span", { className: "copy-text" }, [
                    element("span", { className: "copy-title", textContent: folder.title }),
                    element("span", { className: "variant", textContent: plural(folder.items, "item") })
                ]),
                element("span", { className: "date", textContent: formatDate(folder.dateAdded), title: "Date added" }),
                element("span", { className: "tag", textContent: i ? "Move into first" : "Keep" })
            ]));
        });
        var pathText = group.path.join(" › ");
        section = element("section", { className: "group" + (selected.has(group.key) ? " merging" : "") }, [
            element("header", { className: "group-header" }, [
                checkbox,
                element("label", { htmlFor: id, className: "group-heading" }, [
                    element("span", { className: "path", textContent: pathText, title: pathText }),
                    element("span", { className: "group-title", textContent: "Merge “" + group.title + "”" })
                ]),
                element("span", { className: "badge", textContent: plural(group.folders.length, "folder") })
            ]),
            list
        ]);
        return section;
    }

    function render(container, filter) {
        if (!groups.length) {
            container.replaceChildren(emptyState("No folders with the same name",
                "No folder has a sibling with the same name."));
            return;
        }
        var visible = groups.filter(function(g) { return matchesText([g.title].concat(g.path), filter); });
        if (!visible.length) {
            container.replaceChildren(emptyState("Nothing matches the filter",
                "No folder contains “" + filter + "”."));
            return;
        }
        container.replaceChildren.apply(container, visible.map(renderGroup));
    }

    function actions() {
        if (!groups.length) return null;
        var n = selected.size;
        var rerender = function() { render(document.getElementById("bookmarks"), filterText()); updateActions(); };
        return {
            text: n ? plural(n, "group") + " selected for merging" : "Nothing selected",
            buttons: [
                { label: "Select all", run: function() { groups.forEach(function(g) { selected.add(g.key); }); rerender(); } },
                { label: "Deselect all", run: function() { selected.clear(); rerender(); } },
                { label: n ? "Merge " + plural(n, "group") : "Merge", run: mergeSelected, danger: true, disabled: n == 0 }
            ]
        };
    }

    async function mergeSelected() {
        var requested = new Set(selected);
        if (!requested.size || busy) return;
        var ok = await confirmDialog("Merge " + plural(requested.size, "group") + " of folders?",
            "The content of each folder is moved into the oldest folder with the same name, then the emptied folders are removed. You can undo right after.",
            "Merge");
        if (!ok) return;
        await runOperation(async function() {
            var fresh = findSameNameFolders(await chrome.bookmarks.getTree()).filter(function(g) { return requested.has(g.key); });
            // to undo: items moved (with their original folder and index)
            // and folders removed
            var moves = [];
            var removedFolders = [];
            var failed = 0;
            for (var group of fresh) {
                var target = group.folders[0];
                for (var folder of group.folders.slice(1)) {
                    try {
                        var children = await chrome.bookmarks.getChildren(folder.id);
                        for (var child of children) {
                            await chrome.bookmarks.move(child.id, { parentId: target.id });
                            moves.push({ id: child.id, parentId: folder.id, index: child.index });
                        }
                        await chrome.bookmarks.remove(folder.id);
                        removedFolders.push({ id: folder.id, parentId: group.parentId, index: folder.index, title: folder.title });
                    } catch (e) {
                        console.error("cannot merge folder " + folder.id + ": " + e.message);
                        failed++;
                    }
                }
            }
            var message = "Merged " + plural(fresh.length, "group") + " of folders.";
            if (failed) message += " " + plural(failed, "folder") + " could not be merged.";
            return {
                message: message,
                undo: removedFolders.length || moves.length ? function() { return unmerge(moves, removedFolders); } : null
            };
        });
    }

    async function unmerge(moves, removedFolders) {
        var newIds = new Map();
        var failed = 0;
        for (var folder of restoreOrder(removedFolders)) {
            try {
                var created = await chrome.bookmarks.create({ parentId: folder.parentId, index: folder.index, title: folder.title });
                newIds.set(folder.id, created.id);
            } catch (e) {
                console.error("cannot restore folder " + folder.title + ": " + e.message);
            }
        }
        for (var move of restoreOrder(moves)) {
            try {
                await chrome.bookmarks.move(move.id, { parentId: newIds.get(move.parentId) || move.parentId, index: move.index });
            } catch (e) {
                console.error("cannot move back " + move.id + ": " + e.message);
                failed++;
            }
        }
        return "Restored " + plural(removedFolders.length, "folder") + "."
            + (failed ? " " + plural(failed, "item") + " could not be moved back." : "");
    }

    return { update: update, count: count, summary: summary, render: render, actions: actions };
})();
