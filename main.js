function dumpBookmarks() {
    var bookmarkTreeNodes = chrome.bookmarks.getTree(
	function(bookmarkTreeNodes) {
	    
	    var list = dumpTreeNodes(bookmarkTreeNodes);
	    list = find_duplicates(list);
	    console.log(list);

	    var table = $("<table>");
	    for (i = 0; i < list.length; i++)
	    {
		var tr = $('<tr>');
		var td_input = $('<td>');
		var td_label = $('<td>');
		var anchor = $('<a>', { href: list[i].url });
		anchor.append(list[i].title);
		var input = $('<input />', { type: 'checkbox', id: 'cb'+i, value: list[i].title });
		var label = $('<label />', { 'for': 'cb'+i });
		label.append(anchor);
		td_input.append(input);
		td_label.append(anchor);
		tr.append(td_input);
		tr.append(td_label);

		table.append(tr);
	    }
	    $("#list").append(table);

	});
}

function find_duplicates(list) {
    var s = list;
    s.sort(function(a, b) { if (b.url > a.url) return -1;
			    if (b.url < a.url) return 1;
			    return 0; });
    s = s.filter( function(v,i,o){ return (i && v.url==o[i-1].url) ? v : 0;});
    return s;
}


function dumpTreeNodes(bookmarkNodes) {
    var list = [];
    var i;
    for (i = 0; i < bookmarkNodes.length; i++) {
	dumpNode(bookmarkNodes[i], list, []);

    }
    return list;
}

function dumpNode(bookmarkNode, list, contest) {
    if (bookmarkNode.children && bookmarkNode.children.length > 0) {
	contest = contest.slice(0);
	var j;
	contest.push(bookmarkNode.title);
	for (j = 0; j < bookmarkNode.children.length; j++) {
	    dumpNode(bookmarkNode.children[j], list, contest);
	}
    }
    else
    {
	if (bookmarkNode.url) {
	    bookmarkNode.parent = contest;
	    list.push(bookmarkNode);
	}
    }
}

document.addEventListener('DOMContentLoaded', function () {
    dumpBookmarks();
});
