var list = []

function dumpBookmarks() {
    var bookmarkTreeNodes = chrome.bookmarks.getTree(
	function(bookmarkTreeNodes) {
	    
	    list = dumpTreeNodes(bookmarkTreeNodes);
	    list = find_duplicates(list);
	    console.log(list);

	    var table = $("<table>");
	    for (i = 0; i < list.length; i++)
	    {
		var tr = $('<tr>');
		var td_input = $('<td>');
		var td_label = $('<td>');
		var anchor = $('<a>', { href: list[i].url });
		var complete_title = "";
		for (var iparent = 1; iparent < list[i].parent.length; iparent++) {
		    complete_title += " < " + list[i].parent[iparent];
		}
		complete_title += " < " + list[i].title;
		anchor.append(complete_title);
		var input = $('<input />', { type: 'checkbox', id: list[i].id, value: list[i].title });
		var label = $('<label />', { 'for': list[i].id });
		label.append(anchor);
		td_input.append(input);
		td_label.append(anchor);
		tr.append(td_input);
		tr.append(td_label);

		table.append(tr);
	    }
	    $("#bookmarks").append(table);

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

function groupby(list) {
    var s = list;
    s.sort(function(a, b) { if (b.url > a.url) return -1;
			    if (b.url < a.url) return 1;
			    return 0; });
    var result = [];
    d = 0;
    for (var i = 0; i < s.length - 1 ; i++) {
	if (!d) {
	    d = {};
	    d[s[i].url] = [s[i]];
	}

	if (s[i].url == s[i + 1].url) {
	    d[s[i].url].push(s[i + 1]);
	}
	else {
	    if (d[s[i].url].length > 1) result.push(d);
	    d = 0;
	}
    }
    return result;
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
    $("#delete").click(function() {
	var selected = [];
	$($("input[type=checkbox]:checked")).each(function() {
	    var id = $(this).attr('id');
	    console.log("removing " + id);
	    chrome.bookmarks.remove(id);
	});
	console.log("clicked");
	console.log(selected);
	console.log(list);
    });
});
