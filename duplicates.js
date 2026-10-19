// Pure functions to find duplicated bookmarks, without access to the
// chrome API, so that they can be tested with node (see tests/).

// query parameters added by trackers, they do not change the page
var TRACKING_PARAMS = /^(utm_.*|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|yclid|_ga)$/i;

// Return a key that is equal for URLs pointing to the same page,
// ignoring http/https, "www.", the trailing slash, the fragment and the
// tracking parameters. URLs that are not http(s) are returned unchanged.
function normalizeUrl(url) {
    var u;
    try {
        u = new URL(url);
    } catch (e) {
        return url;
    }
    if (u.protocol != "http:" && u.protocol != "https:") return url;
    var host = u.host.toLowerCase().replace(/^www\./, "");
    // user and password can select different resources, keep them
    var userinfo = u.username ? u.username + (u.password ? ":" + u.password : "") + "@" : "";
    var path = u.pathname.replace(/\/+$/, "");
    var params = [];
    u.searchParams.forEach(function(value, name) {
        if (!TRACKING_PARAMS.test(name)) params.push([name, value]);
    });
    var query = new URLSearchParams(params).toString();
    return userinfo + host + path + (query ? "?" + query : "");
}

// Flatten the tree returned by chrome.bookmarks.getTree into a list of
// bookmarks (folders excluded). Each bookmark gets a "path" property with
// the titles of the folders containing it, root excluded.
function flattenTree(nodes) {
    var list = [];
    function visit(node, path) {
        if (node.url) {
            list.push(Object.assign({}, node, { path: path }));
        }
        else if (node.children) {
            // the root node has no title and is not shown
            var childPath = node.parentId === undefined ? path : path.concat([node.title]);
            node.children.forEach(function(child) { visit(child, childPath); });
        }
    }
    nodes.forEach(function(node) { visit(node, []); });
    return list;
}

// Group the bookmarks with the same key (by default the URL itself).
// Return only the groups with more than one bookmark, as a list of
// { key, bookmarks }, sorted by key; in each group the bookmarks are
// sorted by date, the oldest first.
function groupDuplicates(bookmarks, keyFunction) {
    keyFunction = keyFunction || function(url) { return url; };
    var groups = new Map();
    bookmarks.forEach(function(bookmark) {
        var key = keyFunction(bookmark.url);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(bookmark);
    });
    var result = [];
    groups.forEach(function(group, key) {
        if (group.length < 2) return;
        group.sort(function(a, b) { return (a.dateAdded || 0) - (b.dateAdded || 0); });
        result.push({ key: key, bookmarks: group });
    });
    result.sort(function(a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; });
    return result;
}

// Given the groups and the set of selected ids, return the ids that can be
// removed: in a group where every bookmark is selected the oldest one is
// kept, so that a bookmark is never lost completely.
function idsToRemove(groups, selected) {
    var ids = [];
    groups.forEach(function(group) {
        var groupIds = group.bookmarks.map(function(b) { return b.id; });
        var chosen = groupIds.filter(function(id) { return selected.has(id); });
        if (chosen.length == groupIds.length) chosen = chosen.slice(1);
        ids = ids.concat(chosen);
    });
    return ids;
}

// Sort the removed bookmarks so that recreating them in this order with
// chrome.bookmarks.create puts each one back at its original index.
function restoreOrder(removed) {
    return removed.slice().sort(function(a, b) {
        if (a.parentId != b.parentId) return a.parentId < b.parentId ? -1 : 1;
        return a.index - b.index;
    });
}

if (typeof module !== "undefined") {
    module.exports = { normalizeUrl, flattenTree, groupDuplicates, idsToRemove, restoreOrder };
}
