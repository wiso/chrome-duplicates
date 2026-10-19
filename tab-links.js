// Broken links tab. Checking the links contacts every bookmarked site, so it
// needs the optional host permission, asked only when the user starts a check.
TABS.links = (function() {
    var ORIGINS = ["http://*/*", "https://*/*"];
    var CONCURRENCY = 6;
    var TIMEOUT = 15000;
    var KINDS = [
        { kind: "notfound", title: "Page not found", text: "The site answers that the page does not exist anymore (404 or 410).", select: true },
        { kind: "unreachable", title: "Site unreachable", text: "The site cannot be reached: the domain may not exist anymore.", select: false },
        { kind: "error", title: "Server error or no answer", text: "The site answered with an error or did not answer in time: it may be temporary.", select: false }
    ];

    // "intro", "checking" or "done"
    var phase = "intro";
    var granted = false;
    var cancelled = false;
    var progress = { checked: 0, total: 0 };
    // bookmark id -> { bookmark, kind, status }
    var results = new Map();
    var selected = new Set();
    var checkedAt = null;

    function update(tree) {
        if (!results.size) return;
        // forget bookmarks removed meanwhile, and update the others
        var current = new Map(flattenTree(tree).map(function(b) { return [b.id, b]; }));
        results.forEach(function(result, id) {
            if (current.has(id) && current.get(id).url == result.bookmark.url) result.bookmark = current.get(id);
            else {
                results.delete(id);
                selected.delete(id);
            }
        });
    }

    function count() {
        return phase == "done" ? results.size : null;
    }

    function summary() {
        if (phase == "checking") return "Checking links…";
        if (phase == "done") {
            return (results.size ? plural(results.size, "bookmark") + " with a broken link" : "No broken links")
                + " · checked " + checkedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        }
        return "Find bookmarks whose page does not exist anymore";
    }

    function renderIntro(container) {
        container.replaceChildren(element("section", { className: "intro" }, [
            element("h2", { textContent: "Find broken links" }),
            element("p", { textContent: "Bookmark Cleaner can visit each bookmarked page to find the ones that do not exist anymore." }),
            element("p", { className: "hint", textContent: "This contacts every bookmarked website, so Chrome will ask you to allow access to all sites. The access is used only for this check, nothing is sent anywhere else, and you can revoke it at any time." }),
            element("p", {}, [
                element("button", { className: "button primary", textContent: "Check links", onclick: start }),
                granted ? element("button", { className: "button link-button", textContent: "Revoke site access", onclick: revoke }) : null
            ])
        ]));
    }

    function renderProgress(container) {
        var bar = element("progress", { id: "link-progress", max: progress.total || 1, value: progress.checked });
        container.replaceChildren(element("section", { className: "intro" }, [
            element("h2", { textContent: "Checking links…" }),
            bar,
            element("p", { id: "link-progress-text", className: "hint", textContent: progressText() }),
            element("p", {}, [element("button", { className: "button", textContent: "Stop", onclick: function() { cancelled = true; } })])
        ]));
    }

    function progressText() {
        return "Checked " + progress.checked + " of " + plural(progress.total, "link") + ".";
    }

    function renderResults(container, filter) {
        var toolbar = element("p", { className: "toolbar" }, [
            element("span", { className: "hint", textContent: (cancelled ? "Stopped after " + progress.checked + " of " : "Checked ") + plural(progress.total, "link") + "." }),
            element("button", { className: "button small", textContent: "Check again", onclick: start }),
            element("button", { className: "button link-button small", textContent: "Revoke site access", onclick: revoke })
        ]);
        if (!results.size) {
            container.replaceChildren(toolbar, emptyState("No broken links found", "Every checked bookmark points to a page that answers."));
            return;
        }
        var sections = [toolbar];
        KINDS.forEach(function(kind) {
            var items = [];
            results.forEach(function(result) {
                var b = result.bookmark;
                if (result.kind == kind.kind && matchesText([b.title, b.url].concat(b.path), filter)) items.push(result);
            });
            if (!items.length) return;
            var list = element("ul", { className: "copies" });
            items.forEach(function(result) {
                var b = result.bookmark;
                var pathText = b.path.join(" › ");
                list.append(selectionRow("link-" + b.id, selected.has(b.id), function(event) {
                    if (event.target.checked) selected.add(b.id);
                    else selected.delete(b.id);
                    updateActions();
                }, [
                    element("span", { className: "path", textContent: pathText, title: pathText }),
                    element("span", { className: "copy-title", textContent: b.title || b.url, title: b.title }),
                    element("a", { className: "variant", href: b.url, target: "_blank", rel: "noopener", textContent: b.url, title: "Open in a new tab" })
                ], function(checked) { return checked ? "Delete" : "Keep"; },
                element("span", { className: "status", textContent: result.status ? "HTTP " + result.status : { timeout: "No answer", inconclusive: "Inconclusive" }[result.error] || "Unreachable" })));
            });
            sections.push(element("section", { className: "group" }, [
                element("header", { className: "group-header" }, [
                    element("div", { className: "group-heading" }, [
                        element("div", { className: "group-title", textContent: kind.title }),
                        element("div", { className: "group-subtitle", textContent: kind.text })
                    ]),
                    element("span", { className: "badge", textContent: plural(items.length, "bookmark") })
                ]),
                list
            ]));
        });
        if (sections.length == 1) sections.push(emptyState("Nothing matches the filter", "No broken link contains “" + filter + "”."));
        container.replaceChildren.apply(container, sections);
    }

    function render(container, filter) {
        if (phase == "checking") renderProgress(container);
        else if (phase == "done") renderResults(container, filter);
        else {
            // show "Revoke" only if the access was already granted
            chrome.permissions.contains({ origins: ORIGINS }).then(function(has) {
                if (has != granted) {
                    granted = has;
                    if (phase == "intro" && currentTab == "links") renderIntro(container);
                }
            });
            renderIntro(container);
        }
    }

    function actions() {
        if (phase != "done" || !results.size) return null;
        var n = selected.size;
        var rerender = function() { render(document.getElementById("bookmarks"), filterText()); updateActions(); };
        return {
            text: n ? plural(n, "bookmark") + " selected for deletion" : "Nothing selected",
            buttons: [
                { label: "Select all", run: function() { results.forEach(function(r, id) { selected.add(id); }); rerender(); } },
                { label: "Deselect all", run: function() { selected.clear(); rerender(); } },
                { label: n ? "Delete " + plural(n, "bookmark") : "Delete", run: deleteSelected, danger: true, disabled: n == 0 }
            ]
        };
    }

    async function start() {
        if (phase == "checking") return;
        // must be called directly from the click, before any other await
        granted = await chrome.permissions.request({ origins: ORIGINS });
        if (!granted) {
            showToast("Site access is needed to check the links.");
            return;
        }
        var urls = linksToCheck(flattenTree(tree));
        phase = "checking";
        cancelled = false;
        progress = { checked: 0, total: urls.size };
        var found = new Map();
        var unreachable = 0;
        window.render();
        await checkAll(Array.from(urls.keys()), function(url) {
            return checkLink(url, fetch.bind(window), TIMEOUT);
        }, CONCURRENCY, function(url, result) {
            progress.checked++;
            var kind = classifyLink(result);
            if (kind == "unreachable") unreachable++;
            if (kind != "ok") {
                urls.get(url).forEach(function(b) {
                    found.set(b.id, { bookmark: b, kind: kind, status: result.status, error: result.error });
                });
            }
            var bar = document.getElementById("link-progress");
            if (bar) {
                bar.value = progress.checked;
                document.getElementById("link-progress-text").textContent = progressText();
            }
        }, function() { return cancelled; });
        results = found;
        selected = new Set();
        results.forEach(function(result, id) {
            if (KINDS.some(function(k) { return k.kind == result.kind && k.select; })) selected.add(id);
        });
        phase = "done";
        checkedAt = new Date();
        // every site unreachable: most likely the computer is offline
        if (progress.checked > 2 && unreachable == progress.checked) {
            showToast("No site could be reached: check your internet connection and try again.");
        }
        if (tree) TABS.links.update(tree);
        window.render();
    }

    async function revoke() {
        await chrome.permissions.remove({ origins: ORIGINS });
        granted = false;
        showToast("Site access revoked.");
        window.render();
    }

    async function deleteSelected() {
        var ids = Array.from(selected);
        if (!ids.length || busy) return;
        var ok = await confirmDialog("Delete " + plural(ids.length, "bookmark") + "?",
            "The bookmarks with a broken link you selected are deleted. You can undo right after.", "Delete");
        if (!ok) return;
        await runOperation(async function() {
            // a bookmark may have changed since the check (e.g. its URL was
            // edited): delete only the ones still pointing to the checked URL,
            // and keep their current data for undo
            var current = new Map(flattenTree(await chrome.bookmarks.getTree()).map(function(b) { return [b.id, b]; }));
            var byId = new Map();
            ids.forEach(function(id) {
                if (results.has(id) && current.has(id) && current.get(id).url == results.get(id).bookmark.url) {
                    byId.set(id, current.get(id));
                }
            });
            var result = await removeBookmarks(Array.from(byId.keys()), byId);
            var message = "Deleted " + plural(result.removed.length, "bookmark") + ".";
            if (result.failed) message += " " + result.failed + " could not be deleted.";
            var changed = ids.length - byId.size;
            if (changed) message += " " + changed + " kept because they changed after the check.";
            return {
                message: message,
                undo: result.removed.length ? function() { return restoreBookmarks(result.removed); } : null
            };
        });
    }

    return { update: update, count: count, summary: summary, render: render, actions: actions };
})();
