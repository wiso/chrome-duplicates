var list = []

function dumpBookmarks() {
    $("#bookmarks").empty();
    var bookmarkTreeNodes = chrome.bookmarks.getTree(
	function(bookmarkTreeNodes) {
	    
	    list = dumpTreeNodes(bookmarkTreeNodes);
	    var list_duplicates = groupby(list);
	    var nlinks = list_duplicates.length;

	    var table = $("<table>");
	    for (var i = 0; i < nlinks; i++)
	    {
		var tr = $('<tr>').addClass('url');
		var td_title = $('<td>').attr("colspan", 2);
		var anchor = $('<a>', { href: list_duplicates[i][0] });
		anchor.text(list_duplicates[i][0]);
		td_title.append(anchor);
		tr.append(td_title);
		table.append(tr);
		for (var j = 0; j < list_duplicates[i][1].length; j++)
		{
		    var duplicate = list_duplicates[i][1][j];
		    var tr = $('<tr>');
		    var td_input = $('<td>');
		    var td_title = $('<td>');
		    var input = $('<input />', { type: 'checkbox', id: duplicate.id, value: duplicate.title, checked: (j != 0) });
		    td_input.append(input);
		    var complete_title = "";
		    for (var iparent = 1; iparent < duplicate.parent.length; iparent++) {
			complete_title += duplicate.parent[iparent] + " > ";
		    }
		    complete_title += duplicate.title;
		    td_title.text(complete_title);
		    tr.append(td_input);
		    tr.append(td_title);
		    table.append(tr);

		}
	    }
	    if (!nlinks) {
		$("#bookmarks").append("No duplicates found");
	    }
	    else
	    {
		$("#bookmarks").append("found " + nlinks + " duplicated link" + (nlinks > 1 ? "s" : ""));
		$("#bookmarks").append(table);
	    }
	    

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
			    if (b.dateAdded > a.dateAdded) return -1;
			    if (b.dateAdded < a.dateAdded) return 1;
			    return 0; });
    var result = [];
    var d = 0;
    for (var i = 0; i < s.length; i++) {
	if (d && s[i].url == d[0]) {
	    d[1].push(s[i]);
	}
	else {
	    if (d && d[1].length > 1) result.push(d);
	    d = [s[i].url, [s[i]]];
	}
    }
    if (d && d[1].length > 1) result.push(d);
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

    $("#clear").click(function() {
	$("input[type=checkbox]").removeAttr('checked');
    });

    $("#delete").click(function() {
	var removals = [];
	$("input[type=checkbox]:checked").each(function() {
	    var id = $(this).attr('id');
	    console.log("removing " + id);
	    removals.push(chrome.bookmarks.remove(id).catch(function(e) {
		console.error("cannot remove " + id + ": " + e.message);
	    }));
	});
	// reload the list, so that removed bookmarks are not shown anymore
	Promise.all(removals).then(dumpBookmarks);
    });
});
