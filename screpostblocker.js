function filterReposts(collection) {
    let result = collection.filter(item => !item["type"].endsWith("-repost"));
    let filtered = collection.length - result.length;
    console.log(`Filtered ${filtered}/${collection.length} items`);
    return result;
}

function requestListener(request) {
    // Only filter on home stream. If filtering on artist
    // pages is also desired, use startsWith instead.
    let url = new URL(request.url);
    if (url.pathname !== "/stream") {
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

        // Filter reposts
        let json = JSON.parse(body);
        let newJson = {
            ...json,
            "collection": filterReposts(json["collection"])
        };

        // Output filtered stream
        filter.write(encoder.encode(JSON.stringify(newJson)));
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
