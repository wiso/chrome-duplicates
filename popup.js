document.addEventListener('DOMContentLoaded', function () {
    var newURL = "main.html";
    chrome.tabs.create({ url: newURL });
});
