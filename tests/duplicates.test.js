const test = require("node:test");
const assert = require("node:assert");
const { normalizeUrl, flattenTree, groupDuplicates, idsToRemove, restoreOrder } = require("../duplicates.js");

function bookmark(id, url, dateAdded) {
    return { id, url, dateAdded, title: "t" + id, path: [] };
}

function ids(groups) {
    return groups.map((g) => g.bookmarks.map((b) => b.id));
}

test("groupDuplicates finds exact duplicates, oldest first", () => {
    const groups = groupDuplicates([
        bookmark("1", "https://a.com/", 3),
        bookmark("2", "https://b.com/", 1),
        bookmark("3", "https://a.com/", 2),
    ]);
    assert.deepStrictEqual(ids(groups), [["3", "1"]]);
    assert.strictEqual(groups[0].key, "https://a.com/");
});

test("groupDuplicates includes the group that sorts last", () => {
    const groups = groupDuplicates([
        bookmark("1", "a", 1),
        bookmark("2", "b", 1),
        bookmark("3", "b", 2),
    ]);
    assert.deepStrictEqual(ids(groups), [["2", "3"]]);
});

test("groupDuplicates with no duplicates", () => {
    assert.deepStrictEqual(groupDuplicates([]), []);
    assert.deepStrictEqual(groupDuplicates([bookmark("1", "a", 1)]), []);
});

test("groupDuplicates with normalizeUrl", () => {
    const groups = groupDuplicates(
        [
            bookmark("1", "http://www.a.com/page/", 1),
            bookmark("2", "https://a.com/page#top", 2),
            bookmark("3", "https://a.com/page?utm_source=x", 3),
            bookmark("4", "https://a.com/other", 4),
        ],
        normalizeUrl,
    );
    assert.deepStrictEqual(ids(groups), [["1", "2", "3"]]);
});

test("normalizeUrl", () => {
    assert.strictEqual(normalizeUrl("https://WWW.Example.com/a/?b=1&utm_medium=x&fbclid=y#c"), "example.com/a?b=1");
    assert.strictEqual(normalizeUrl("http://example.com"), "example.com");
    // the path and the other parameters are kept as they are
    assert.strictEqual(normalizeUrl("https://example.com/A?x=2&y=1"), "example.com/A?x=2&y=1");
    // non http(s) URLs and invalid URLs are not changed
    assert.strictEqual(normalizeUrl("javascript:alert(1)"), "javascript:alert(1)");
    assert.strictEqual(normalizeUrl("file:///home/a/"), "file:///home/a/");
    assert.strictEqual(normalizeUrl("not a url"), "not a url");
});

test("flattenTree", () => {
    const tree = [{
        id: "0", title: "", children: [
            { id: "1", parentId: "0", title: "Bar", children: [
                { id: "10", parentId: "1", title: "x", url: "https://x.com" },
                { id: "11", parentId: "1", title: "Folder", children: [
                    { id: "12", parentId: "11", title: "y", url: "https://y.com" },
                ] },
                { id: "13", parentId: "1", title: "Empty", children: [] },
            ] },
        ],
    }];
    const list = flattenTree(tree);
    assert.deepStrictEqual(list.map((b) => [b.id, b.path]), [
        ["10", ["Bar"]],
        ["12", ["Bar", "Folder"]],
    ]);
    // the tree is not modified
    assert.strictEqual(tree[0].children[0].children[0].path, undefined);
});

test("idsToRemove keeps at least one bookmark per group", () => {
    const groups = groupDuplicates([
        bookmark("1", "a", 1),
        bookmark("2", "a", 2),
        bookmark("3", "b", 1),
        bookmark("4", "b", 2),
        bookmark("5", "b", 3),
    ]);
    assert.deepStrictEqual(idsToRemove(groups, new Set(["2", "4"])), ["2", "4"]);
    // all selected: the oldest is kept
    assert.deepStrictEqual(idsToRemove(groups, new Set(["1", "2", "3", "4", "5"])), ["2", "4", "5"]);
    assert.deepStrictEqual(idsToRemove(groups, new Set()), []);
});

test("restoreOrder sorts by folder and index", () => {
    const removed = [
        { id: "a", parentId: "2", index: 5 },
        { id: "b", parentId: "1", index: 3 },
        { id: "c", parentId: "2", index: 1 },
    ];
    assert.deepStrictEqual(restoreOrder(removed).map((b) => b.id), ["b", "c", "a"]);
    assert.deepStrictEqual(removed.map((b) => b.id), ["a", "b", "c"]);
});
