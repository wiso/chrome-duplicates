// Page shell: tabs, action bar, toast, dialog and helpers shared by the
// tabs. Each tab-*.js file adds an object to TABS with:
// - update(tree): recompute its data from chrome.bookmarks.getTree()
// - count(): number shown on the tab, or null
// - summary(): text under the title
// - render(container, filter): show its content
// - actions(): { text, buttons: [{ label, run, danger, disabled }] } for
//   the action bar, or null to hide it
// - smart: true to show the smart matching switch

var TABS = {};
var TAB_ORDER = ["duplicates", "empty", "samename", "links"];
var currentTab = "duplicates";

// last tree returned by chrome.bookmarks.getTree
var tree = null;
// true while a deletion, a merge or an undo is running
var busy = false;
// { run } to undo the last operation; run returns the message to show
var lastUndo = null;

function loadOption(key, fallback) {
    try {
        var value = localStorage.getItem(key);
        return value === null ? fallback : value;
    } catch (e) {
        return fallback;
    }
}

function saveOption(key, value) {
    try {
        localStorage.setItem(key, value);
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

function matchesText(texts, filter) {
    return !filter || texts.join(" ").toLowerCase().includes(filter);
}

function emptyState(title, text, extra) {
    return element("div", { className: "empty" }, [
        element("img", { src: "icon128.png", alt: "", width: 96, height: 96 }),
        element("h2", { textContent: title }),
        element("p", { textContent: text }),
        extra || null
    ]);
}

// message at the bottom of the page, with an Undo button while there is
// something to undo
var toastTimer = null;
function showToast(message) {
    document.getElementById("toast-message").textContent = message;
    document.getElementById("toast-undo").hidden = !lastUndo;
    document.getElementById("toast").hidden = false;
    clearTimeout(toastTimer);
    // keep it while it offers Undo
    if (!lastUndo) toastTimer = setTimeout(hideToast, 6000);
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

// Remove the bookmarks with the given ids; byId gives the data to restore
// them. Return { removed, failed }.
async function removeBookmarks(ids, byId) {
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
    return { removed: removed, failed: failed };
}

// Recreate removed bookmarks at their position; return the message to show.
async function restoreBookmarks(removed) {
    var failed = 0;
    for (var b of restoreOrder(removed)) {
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
    return "Restored " + plural(removed.length - failed, "bookmark") + "."
        + (failed ? " " + failed + " could not be restored." : "");
}

// Run operation (an async function returning { message, undo }) with the
// page marked busy, then show the message and offer undo if given.
async function runOperation(operation) {
    if (busy) return;
    busy = true;
    updateActions();
    var result;
    try {
        result = await operation();
    } finally {
        busy = false;
    }
    if (result.undo) lastUndo = { run: result.undo };
    showToast(result.message);
    refresh();
}

async function undo() {
    if (busy || !lastUndo) return;
    var run = lastUndo.run;
    lastUndo = null;
    busy = true;
    updateActions();
    var message;
    try {
        message = await run();
    } finally {
        busy = false;
    }
    showToast(message);
    refresh();
}

function refresh() {
    chrome.bookmarks.getTree().then(function(newTree) {
        tree = newTree;
        TAB_ORDER.forEach(function(name) { TABS[name].update(tree); });
        render();
    });
}

// refresh at most once for a burst of bookmark events (e.g. an import)
var refreshTimer = null;
function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 300);
}

function filterText() {
    return document.getElementById("filter").value.trim().toLowerCase();
}

function render() {
    if (!tree) return;
    TAB_ORDER.forEach(function(name) {
        var button = document.getElementById("tab-" + name);
        var count = TABS[name].count();
        button.querySelector(".count").textContent = count === null ? "" : count;
        button.setAttribute("aria-selected", name == currentTab);
        button.tabIndex = name == currentTab ? 0 : -1;
    });
    var tab = TABS[currentTab];
    document.getElementById("summary").textContent = tab.summary();
    document.getElementById("smart").hidden = !tab.smart;
    tab.render(document.getElementById("bookmarks"), filterText());
    updateActions();
}

// update the action bar; called by the tabs when their selection changes
function updateActions() {
    var actions = TABS[currentTab].actions();
    document.getElementById("actionbar").hidden = !actions;
    if (!actions) return;
    document.getElementById("selection").textContent = actions.text;
    // reuse the buttons, so that the focused one keeps the focus
    var container = document.getElementById("actions");
    while (container.children.length > actions.buttons.length) container.lastChild.remove();
    actions.buttons.forEach(function(spec, i) {
        var button = container.children[i] || container.appendChild(element("button"));
        button.className = "button" + (spec.danger ? " danger" : "");
        button.textContent = spec.label;
        button.disabled = Boolean(spec.disabled) || (spec.danger && busy);
        button.onclick = spec.run;
    });
}

function selectTab(name, focus) {
    if (!TABS[name]) name = "duplicates";
    currentTab = name;
    if (location.hash.slice(1) != name) history.replaceState(null, "", "#" + name);
    render();
    if (focus) document.getElementById("tab-" + name).focus();
}

document.addEventListener("DOMContentLoaded", function() {
    var normalize = document.getElementById("normalize");
    normalize.checked = loadOption("normalizeUrls", "false") == "true";
    normalize.addEventListener("change", function() {
        saveOption("normalizeUrls", normalize.checked);
        refresh();
    });
    document.getElementById("filter").addEventListener("input", render);
    document.getElementById("toast-undo").addEventListener("click", undo);
    document.getElementById("toast-close").addEventListener("click", hideToast);

    // tabs, with arrow keys to move between them
    TAB_ORDER.forEach(function(name, i) {
        var button = document.getElementById("tab-" + name);
        button.addEventListener("click", function() { selectTab(name); });
        button.addEventListener("keydown", function(event) {
            var step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
            if (!step) return;
            event.preventDefault();
            selectTab(TAB_ORDER[(i + step + TAB_ORDER.length) % TAB_ORDER.length], true);
        });
    });
    window.addEventListener("hashchange", function() { selectTab(location.hash.slice(1)); });
    currentTab = TABS[location.hash.slice(1)] ? location.hash.slice(1) : "duplicates";

    // keep the lists up to date when bookmarks are changed elsewhere
    [chrome.bookmarks.onCreated, chrome.bookmarks.onRemoved, chrome.bookmarks.onChanged,
     chrome.bookmarks.onMoved, chrome.bookmarks.onChildrenReordered,
     chrome.bookmarks.onImportEnded].forEach(function(event) {
        event.addListener(scheduleRefresh);
    });

    refresh();
});
