const test = require("node:test");
const assert = require("node:assert");
const { findEmptyFolders, findSameNameFolders } = require("../folders.js");

function folder(id, parentId, index, title, children, extra) {
    return Object.assign({ id, parentId, index, title, dateAdded: Number(id), children }, extra);
}

function bookmark(id, parentId, index) {
    return { id, parentId, index, title: "b" + id, url: "https://example.com/" + id };
}

// root > Bookmarks bar (1) and Other bookmarks (2)
function tree(bar, other) {
    return [{ id: "0", title: "", children: [
        folder("1", "0", 0, "Bookmarks bar", bar),
        folder("2", "0", 1, "Other bookmarks", other || []),
    ] }];
}

test("findEmptyFolders returns the outermost empty folders", () => {
    const t = tree([
        folder("10", "1", 0, "Empty", []),
        folder("11", "1", 1, "Nested", [folder("12", "11", 0, "Inner", [folder("13", "12", 0, "Deep", [])])]),
        folder("14", "1", 2, "Full", [bookmark("15", "14", 0), folder("16", "14", 1, "Empty inside", [])]),
    ]);
    const empty = findEmptyFolders(t);
    assert.deepStrictEqual(empty.map((f) => [f.id, f.path, f.subfolders]), [
        ["10", ["Bookmarks bar"], 0],
        ["11", ["Bookmarks bar"], 2],
        ["16", ["Bookmarks bar", "Full"], 0],
    ]);
    assert.deepStrictEqual(empty[1].snapshot, {
        title: "Nested", children: [{ title: "Inner", children: [{ title: "Deep", children: [] }] }],
    });
});

test("findEmptyFolders ignores top-level and managed folders", () => {
    const t = tree([folder("10", "1", 0, "Managed", [], { unmodifiable: "managed" })], []);
    assert.deepStrictEqual(findEmptyFolders(t), []);
});

test("findSameNameFolders groups siblings with the same name, oldest first", () => {
    const t = tree([
        folder("12", "1", 0, "News ", [bookmark("20", "12", 0)]),
        folder("10", "1", 1, "news", [bookmark("21", "10", 0), bookmark("22", "10", 1)]),
        folder("11", "1", 2, "Work", []),
        bookmark("23", "1", 3),
    ], [
        folder("13", "2", 0, "News", []),
        folder("14", "2", 1, "Work", [folder("15", "14", 0, "a", []), folder("16", "14", 1, "A", [])]),
    ]);
    const groups = findSameNameFolders(t);
    assert.deepStrictEqual(groups.map((g) => [g.key, g.path, g.folders.map((f) => [f.id, f.items])]), [
        ["1/news", ["Bookmarks bar"], [["10", 2], ["12", 1]]],
        ["14/a", ["Other bookmarks", "Work"], [["15", 0], ["16", 0]]],
    ]);
    assert.strictEqual(groups[0].title, "news");
});

test("findSameNameFolders ignores top-level, managed and untitled folders", () => {
    const t = tree([
        folder("10", "1", 0, "", []),
        folder("11", "1", 1, "", []),
        folder("12", "1", 2, "M", [], { unmodifiable: "managed" }),
        folder("13", "1", 3, "M", []),
    ]);
    assert.deepStrictEqual(findSameNameFolders(t), []);
});
