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

function requestListener(request) {
    // Only filter on home stream. If filtering on artist
    // pages is also desired, use startsWith instead.
    if (!isStreamUrl(request.url)) {
        return;
    }

    // Create response filter
    let filter = browser.webRequest.filterResponseData(request.requestId);
    let decoder = new TextDecoder("utf-8");
    let encoder = new TextEncoder();

    // Collect response body so we can parse all of it at
    // once into JSON
    let body = "";
    filter.ondata = e => {
        body += decoder.decode(e.data, {
            "stream": true
        });
    };

    // Callback for when the response body is complete
    filter.onstop = e => {
        body += decoder.decode();

        // Workaround for weird issue where some responses
        // are empty
        if (body.length === 0) {
            filter.close();
            return;
        }

        let response = replaceReposts(body);
        filter.write(encoder.encode(response));
        filter.close();
    };
}

browser.webRequest.onBeforeRequest.addListener(
    requestListener,
    {
        "urls": ["*://api-v2.soundcloud.com/*"],
    },
    ["blocking"]
);
