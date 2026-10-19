// Open the page with the duplicated bookmarks when the toolbar icon is
// clicked, or bring it to the front if it is already open.
chrome.action.onClicked.addListener(async function() {
    var url = chrome.runtime.getURL("main.html");
    // runtime.getContexts is available from Chrome 116
    if (chrome.runtime.getContexts) {
        var contexts = await chrome.runtime.getContexts({ contextTypes: ["TAB"], documentUrls: [url] });
        if (contexts.length) {
            await chrome.tabs.update(contexts[0].tabId, { active: true });
            await chrome.windows.update(contexts[0].windowId, { focused: true });
            return;
        }
    }
    await chrome.tabs.create({ url: url });
});
