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

// Log of the changes made to the tree, to undo them exactly: each entry
// records where a folder or item was just before it was removed or moved,
// read from the live tree. Undo replays the log backwards.
function ChangeLog() {
    this.entries = [];
}

// remove an empty folder; fails (and logs nothing) if it is not empty
ChangeLog.prototype.removeFolder = async function(id) {
    var node = (await chrome.bookmarks.get(id))[0];
    await chrome.bookmarks.remove(id);
    this.entries.push({ type: "remove", id: id, parentId: node.parentId, index: node.index, title: node.title });
};

ChangeLog.prototype.move = async function(id, parentId) {
    var node = (await chrome.bookmarks.get(id))[0];
    await chrome.bookmarks.move(id, { parentId: parentId });
    this.entries.push({ type: "move", id: id, parentId: node.parentId, index: node.index });
};

// Undo the logged changes; return the number of changes not undone.
ChangeLog.prototype.undo = async function() {
    // ids of the folders recreated by the undo, by their old id
    var newIds = new Map();
    var current = function(id) { return newIds.get(id) || id; };
    var failed = 0;
    for (var i = this.entries.length - 1; i >= 0; i--) {
        var entry = this.entries[i];
        try {
            if (entry.type == "remove") {
                var created = await chrome.bookmarks.create({ parentId: current(entry.parentId), index: entry.index, title: entry.title });
                newIds.set(entry.id, created.id);
            }
            else {
                await chrome.bookmarks.move(current(entry.id), { parentId: current(entry.parentId), index: entry.index });
            }
        } catch (e) {
            console.error("cannot undo " + entry.type + " of " + entry.id + ": " + e.message);
            failed++;
        }
    }
    return failed;
};

// ids of a folder and its subfolders, children first
function foldersBottomUp(node) {
    return (node.children || []).filter(function(c) { return !c.url; })
        .reduce(function(ids, child) { return ids.concat(foldersBottomUp(child)); }, [])
        .concat([node.id]);
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

    async function deleteSelected() {
        var requested = new Set(selected);
        if (!requested.size || busy) return;
        var ok = await confirmDialog("Delete " + plural(requested.size, "empty folder") + "?",
            "Only folders without bookmarks are deleted, and you can undo right after.", "Delete");
        if (!ok) return;
        await runOperation(async function() {
            var log = new ChangeLog();
            var deleted = 0;
            var kept = 0;
            for (var id of requested) {
                // remove the subfolders first, one by one: chrome.bookmarks.remove
                // refuses a folder that is not empty, so a bookmark added
                // meanwhile (e.g. by sync) is never deleted
                try {
                    var node = (await chrome.bookmarks.getSubTree(id))[0];
                    for (var folderId of foldersBottomUp(node)) await log.removeFolder(folderId);
                    deleted++;
                } catch (e) {
                    console.error("cannot remove folder " + id + ": " + e.message);
                    kept++;
                }
            }
            var message = "Deleted " + plural(deleted, "empty folder") + ".";
            if (kept) message += " " + kept + " kept because they are not empty anymore.";
            return {
                message: message,
                undo: log.entries.length ? async function() {
                    var failed = await log.undo();
                    return "Restored the deleted folders." + (failed ? " " + plural(failed, "folder") + " could not be restored." : "");
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
        // the oldest folder id is unique, the name may not be a valid id
        var id = "merge-" + group.folders[0].id;
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
            // groups can be nested (a merged folder may contain another
            // group): the log records the live position before each change,
            // so that undo restores the exact hierarchy
            var log = new ChangeLog();
            var failed = 0;
            for (var group of fresh) {
                var target = group.folders[0];
                for (var folder of group.folders.slice(1)) {
                    try {
                        var children = await chrome.bookmarks.getChildren(folder.id);
                        for (var child of children) await log.move(child.id, target.id);
                        await log.removeFolder(folder.id);
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
                undo: log.entries.length ? async function() {
                    var notUndone = await log.undo();
                    return "Restored the merged folders." + (notUndone ? " " + plural(notUndone, "change") + " could not be undone." : "");
                } : null
            };
        });
    }

    return { update: update, count: count, summary: summary, render: render, actions: actions };
})();
