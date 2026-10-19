const test = require("node:test");
const assert = require("node:assert");
const { classifyLink, linksToCheck, checkLink, checkAll } = require("../links.js");

test("classifyLink", () => {
    assert.strictEqual(classifyLink({ status: 200 }), "ok");
    assert.strictEqual(classifyLink({ status: 403 }), "ok");
    assert.strictEqual(classifyLink({ status: 429 }), "ok");
    assert.strictEqual(classifyLink({ status: 404 }), "notfound");
    assert.strictEqual(classifyLink({ status: 410 }), "notfound");
    assert.strictEqual(classifyLink({ status: 503 }), "error");
    assert.strictEqual(classifyLink({ error: "timeout" }), "error");
    assert.strictEqual(classifyLink({ error: "network" }), "unreachable");
    assert.strictEqual(classifyLink({ error: "inconclusive" }), "error");
});

test("linksToCheck keeps http(s) URLs once", () => {
    const urls = linksToCheck([
        { id: "1", url: "https://a.com/" },
        { id: "2", url: "https://a.com/" },
        { id: "3", url: "javascript:alert(1)" },
        { id: "4", url: "HTTP://b.com/" },
        { id: "5", url: "file:///tmp" },
    ]);
    assert.deepStrictEqual([...urls.keys()], ["https://a.com/", "HTTP://b.com/"]);
    assert.deepStrictEqual(urls.get("https://a.com/").map((b) => b.id), ["1", "2"]);
});

function fakeFetch(answers) {
    const calls = [];
    const fetch = async (url, options) => {
        calls.push(options.method);
        const answer = answers[options.method];
        if (answer instanceof Error) throw answer;
        if (answer == "hang") {
            return new Promise((resolve, reject) => {
                options.signal.addEventListener("abort", () => {
                    const e = new Error("aborted");
                    e.name = "AbortError";
                    reject(e);
                });
            });
        }
        return { status: answer };
    };
    return { fetch, calls };
}

test("checkLink uses HEAD", async () => {
    const f = fakeFetch({ HEAD: 200 });
    assert.deepStrictEqual(await checkLink("u", f.fetch, 1000), { status: 200 });
    assert.deepStrictEqual(f.calls, ["HEAD"]);
});

test("checkLink retries with GET when HEAD gives an HTTP error", async () => {
    const f = fakeFetch({ HEAD: 405, GET: 200 });
    assert.deepStrictEqual(await checkLink("u", f.fetch, 1000), { status: 200 });
    assert.deepStrictEqual(f.calls, ["HEAD", "GET"]);
    const g = fakeFetch({ HEAD: 404, GET: 404 });
    assert.deepStrictEqual(await checkLink("u", g.fetch, 1000), { status: 404 });
});

test("checkLink is inconclusive when the GET retry does not answer", async () => {
    const f = fakeFetch({ HEAD: 404, GET: "hang" });
    assert.deepStrictEqual(await checkLink("u", f.fetch, 20), { error: "timeout" });
    const g = fakeFetch({ HEAD: 405, GET: new TypeError("Failed to fetch") });
    assert.deepStrictEqual(await checkLink("u", g.fetch, 1000), { error: "inconclusive" });
});

test("checkLink reports network errors and timeouts", async () => {
    const f = fakeFetch({ HEAD: new TypeError("Failed to fetch") });
    assert.deepStrictEqual(await checkLink("u", f.fetch, 1000), { error: "network" });
    assert.deepStrictEqual(f.calls, ["HEAD"]);
    const g = fakeFetch({ HEAD: "hang" });
    assert.deepStrictEqual(await checkLink("u", g.fetch, 20), { error: "timeout" });
});

test("checkAll limits concurrency and can be cancelled", async () => {
    let running = 0, maxRunning = 0;
    const check = async (url) => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 5));
        running--;
        return { status: 200 };
    };
    const seen = [];
    await checkAll(["a", "b", "c", "d", "e"], check, 2, (url) => seen.push(url), () => false);
    assert.deepStrictEqual(seen.sort(), ["a", "b", "c", "d", "e"]);
    assert.strictEqual(maxRunning, 2);

    const partial = [];
    await checkAll(["a", "b", "c", "d"], check, 1, (url) => partial.push(url), () => partial.length >= 2);
    assert.deepStrictEqual(partial, ["a", "b"]);
});
