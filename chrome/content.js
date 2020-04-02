function filterReposts(collection) {
    let result = collection.filter(item => !item["type"].endsWith("-repost"));
    let filtered = collection.length - result.length;
    console.log(`Filtered ${filtered}/${collection.length} items`);
    return result;
}

function replaceReposts(responseText) {
    let json = JSON.parse(responseText);
    let newJson = {
        ...json,
        "collection": filterReposts(json["collection"])
    };
    return JSON.stringify(newJson);
}

function isStreamUrl(url) {
    if (url === "") {
        return false;
    }
    try {
        return new URL(url).pathname === "/stream";
    } catch (e) {
        return false;
    }
}

// Patch the XMLHttpRequest.send() API to shim the load callback.
// When the request completes, replace the responseText property
// to return the filtered JSON object.
let send = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function(body) {
    let cb = this.onreadystatechange;
    this.onreadystatechange = function(e) {
        if (this.readyState === XMLHttpRequest.DONE) {
            if (isStreamUrl(this.responseURL)) {
                Object.defineProperty(this, "responseText", {
                    value: replaceReposts(this.responseText)
                });
            }
        }
        if (cb !== null) {
            cb.call(this, e);
        }
    };
    return send.call(this, body);
};
