// Pure functions to check if bookmarked pages still exist, without access to
// the chrome API (fetch is passed as an argument), so that they can be tested
// with node (see tests/).

// Classify the result of checkLink:
// - "notfound": the server says the page does not exist (404, 410)
// - "unreachable": the server cannot be reached (e.g. the domain is gone)
// - "error": server error, no answer in time or contradictory answers,
//   maybe temporary
// - "ok": anything else, including pages that need a login (401, 403) or
//   refuse automated requests (429)
function classifyLink(result) {
    if (result.error) return result.error == "network" ? "unreachable" : "error";
    if (result.status == 404 || result.status == 410) return "notfound";
    if (result.status >= 500) return "error";
    return "ok";
}

// Return a map from each http(s) URL to the bookmarks pointing to it, so that
// each URL is checked once.
function linksToCheck(bookmarks) {
    var urls = new Map();
    bookmarks.forEach(function(bookmark) {
        if (!/^https?:/i.test(bookmark.url)) return;
        if (!urls.has(bookmark.url)) urls.set(bookmark.url, []);
        urls.get(bookmark.url).push(bookmark);
    });
    return urls;
}

// Request url and return { status } or { error }, where error is "timeout",
// "network" or "inconclusive". Some servers do not support HEAD: if it fails
// with an HTTP error, GET is tried and its result is the answer; if GET does
// not answer, the result is inconclusive (never a definitive 404).
// Only the headers are read, the body is not downloaded.
async function checkLink(url, fetchFunction, timeout) {
    async function attempt(method) {
        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, timeout);
        try {
            var response = await fetchFunction(url, {
                method: method, redirect: "follow", credentials: "omit",
                cache: "no-store", signal: controller.signal
            });
            return { status: response.status };
        } catch (e) {
            return { error: e.name == "AbortError" ? "timeout" : "network" };
        } finally {
            clearTimeout(timer);
            // stop downloading the body
            controller.abort();
        }
    }
    var result = await attempt("HEAD");
    if (result.status >= 400) {
        var get = await attempt("GET");
        result = get.error ? { error: get.error == "network" ? "inconclusive" : get.error } : get;
    }
    return result;
}

// Run check on each url, at most concurrency at a time, calling
// onResult(url, result) for each one. Stop starting new checks when
// isCancelled() returns true.
async function checkAll(urls, check, concurrency, onResult, isCancelled) {
    var next = 0;
    async function worker() {
        while (next < urls.length && !isCancelled()) {
            var url = urls[next++];
            onResult(url, await check(url));
        }
    }
    var workers = [];
    for (var i = 0; i < Math.min(concurrency, urls.length); i++) workers.push(worker());
    await Promise.all(workers);
}

if (typeof module !== "undefined") {
    module.exports = { classifyLink, linksToCheck, checkLink, checkAll };
}
