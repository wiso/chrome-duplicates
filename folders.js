// Pure functions to find empty folders and folders with the same name,
// without access to the chrome API, so that they can be tested with node
// (see tests/).

// Depth of the nodes in the tree returned by chrome.bookmarks.getTree:
// 0 is the root, 1 the top-level folders (Bookmarks bar, Other bookmarks,
// Mobile bookmarks), which cannot be changed. Only folders from depth 2
// can be removed or merged.
var EDITABLE_DEPTH = 2;

function hasBookmarks(node) {
    return Boolean(node.url) || (node.children || []).some(hasBookmarks);
}

// Folders inside a folder without bookmarks, to recreate it on undo.
function folderSnapshot(node) {
    return {
        title: node.title,
        children: (node.children || []).map(folderSnapshot)
    };
}

function countSubfolders(snapshot) {
    return snapshot.children.reduce(function(n, child) { return n + 1 + countSubfolders(child); }, 0);
}

// Return the folders that contain no bookmark, also through their
// subfolders, as a list of { id, title, parentId, index, dateAdded, path,
// subfolders, snapshot }. Only the outermost empty folder is returned:
// removing it removes its empty subfolders too.
function findEmptyFolders(nodes) {
    var result = [];
    function visit(node, path, depth) {
        if (node.url) return;
        if (depth >= EDITABLE_DEPTH && !node.unmodifiable && !hasBookmarks(node)) {
            var snapshot = folderSnapshot(node);
            result.push({
                id: node.id, title: node.title, parentId: node.parentId, index: node.index,
                dateAdded: node.dateAdded, path: path, subfolders: countSubfolders(snapshot),
                snapshot: snapshot
            });
            return;
        }
        var childPath = depth == 0 ? path : path.concat([node.title]);
        (node.children || []).forEach(function(child) { visit(child, childPath, depth + 1); });
    }
    nodes.forEach(function(node) { visit(node, [], 0); });
    return result;
}

function folderNameKey(title) {
    return title.trim().toLowerCase();
}

// Return the folders with the same name (ignoring case and surrounding
// spaces) inside the same parent, as a list of { key, parentId, path, title,
// folders }, where folders is sorted by date, the oldest first: it is the one
// the others are merged into.
function findSameNameFolders(nodes) {
    var groups = [];
    function visit(node, path, depth) {
        if (node.url) return;
        var children = node.children || [];
        var childPath = depth == 0 ? path : path.concat([node.title]);
        if (depth + 1 >= EDITABLE_DEPTH) {
            var byName = new Map();
            children.forEach(function(child) {
                if (child.url || child.unmodifiable) return;
                var key = folderNameKey(child.title);
                if (!key) return;
                if (!byName.has(key)) byName.set(key, []);
                byName.get(key).push(child);
            });
            byName.forEach(function(folders, key) {
                if (folders.length < 2) return;
                folders = folders.slice().sort(function(a, b) {
                    return (a.dateAdded || 0) - (b.dateAdded || 0) || a.index - b.index;
                });
                groups.push({
                    key: node.id + "/" + key,
                    parentId: node.id,
                    path: childPath,
                    title: folders[0].title,
                    folders: folders.map(function(f) {
                        return {
                            id: f.id, title: f.title, index: f.index, dateAdded: f.dateAdded,
                            items: (f.children || []).length
                        };
                    })
                });
            });
        }
        children.forEach(function(child) { visit(child, childPath, depth + 1); });
    }
    nodes.forEach(function(node) { visit(node, [], 0); });
    return groups;
}

if (typeof module !== "undefined") {
    module.exports = { findEmptyFolders, findSameNameFolders, folderNameKey };
}
