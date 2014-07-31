function dumpBookmarks() {
  var bookmarkTreeNodes = chrome.bookmarks.getTree(
    function(bookmarkTreeNodes) {

	var list = dumpTreeNodes(bookmarkTreeNodes);
	
	console.log(list[0].url, list[1].url, list[2].url, list[3].url, list[4].url);
	list.sort(function(a, b) { if (b.url > a.url) return -1;
				   if (b.url < a.url) return 1;
				   return 0; });
	console.log("sorted: ", list[0].url, list[1].url, list[2].url, list[3].url, list[4].url);
	list = list.filter( function(v,i,o){ return (i && v.url==o[i-1].url) ? v : 0;});
	console.log(list);

	var ul = $("<ul>");
	for (i = 0; i < list.length; i++)
	{
	    var li = $('<li>');
	    var anchor = $('<a>', { href: list[i].url });
	    anchor.append(list[i].title);
	    $('<input />', { type: 'checkbox', id: 'cb'+i, value: list[i].title }).appendTo(li);
	    var label = $('<label />', { 'for': 'cb'+i });
	    label.append(anchor);
	    label.appendTo(li);
	    ul.append(li);
	}
	$("#list").append(ul);

    });
}


function dumpTreeNodes(bookmarkNodes) {
    var list = [];
    var i;
    for (i = 0; i < bookmarkNodes.length; i++) {
	dumpNode(bookmarkNodes[i], list);

    }
  return list;
}

function dumpNode(bookmarkNode, list) {
    if (bookmarkNode.children && bookmarkNode.children.length > 0) {
	var j;
	for (j = 0; j < bookmarkNode.children.length; j++) {
	    dumpNode(bookmarkNode.children[j], list);
	}
    }
    else
    {
	if (bookmarkNode.url)
	    list.push(bookmarkNode);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    dumpBookmarks();
});
