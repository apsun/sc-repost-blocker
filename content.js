// Returns a copy of the stream collection with all reposts from
// users that the current user is not also following removed.
function filterReposts(collection, followings) {
    let result = [];
    for (let i = 0; i < collection.length; ++i) {
        let item = collection[i];
        if (item["type"] === "track-repost") {
            if (!followings.has(item["track"]["user_id"])) {
                continue;
            }
        } else if (item["type"] === "playlist-repost") {
            if (!followings.has(item["playlist"]["user_id"])) {
                continue;
            }
        }
        result.push(item);
    }

    let filtered = collection.length - result.length;
    console.log(`Filtered ${filtered}/${collection.length} items`);
    return result;
}

// Modifies a textual version of the stream API response to
// remove all reposts. Takes a JSON string as input and returns
// a JSON string after filtering.
function filterRepostsInResponse(responseText, followings) {
    let json = JSON.parse(responseText);
    let newJson = {
        ...json,
        "collection": filterReposts(json["collection"], followings)
    };
    return JSON.stringify(newJson);
}

// Checks whether the given URL is the stream API endpoint.
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

// Takes a base URL and an object containing query params and
// generates a URL with the query params appended.
function withQuery(baseUrl, params) {
    let url = new URL(baseUrl);
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    return url.toString();
}

// Wrapper for fetch() that takes a query parameter and adds
// it to the URL, and returns the result as JSON.
async function fetchJson(url, init) {
    if (init !== null && init["query"] !== undefined) {
        url = withQuery(url, init["query"]);
        delete init["query"];
    }
    let resp = await fetch(url, init);
    if (!resp.ok) {
        throw new Error(`Request to ${url} failed with result ${resp.status}`);
    }
    let json = await resp.json();
    return json;
}

// Wrapper for fetchJson() that adds the authToken parameter.
async function fetchAuthorized(url, authToken) {
    let headers = {};
    if (authToken !== null) {
        headers["Authorization"] = "OAuth " + authToken;
    }

    return await fetchJson(url, {
        "headers": headers,
    });
}

// Returns the value of the specified cookie, or null if the
// cookie is not set.
function getCookie(key) {
    let match = document.cookie.match(new RegExp("(^|;) *" + key + "=([^;]+)"));
    if (match !== null) {
        return match[2];
    }
    return null;
}

// Gets the list of user IDs that the current user is following.
// This is necessary in the scenario that the user follows both
// users A and B. If A posts a track and B reposts it, the track
// will only show up in the stream once as a repost. If we don't
// do this, we will end up removing the track altogether from
// the stream, even though it's probably something the user
// wanted to see.
async function getFollowings() {
    let authToken = getCookie("oauth_token");
    if (authToken === null) {
        console.log("Did not find OAuth token for current user");
        return new Set();
    }

    try {
        let me = await fetchAuthorized(
            "https://api-v2.soundcloud.com/me",
            authToken
        );
        let ret = await fetchAuthorized(
            `https://api-v2.soundcloud.com/users/${me["id"]}/followings/ids`,
            authToken
        );
        let ids = ret["collection"];
        console.log(`Fetched ${ids.length} followers for current user`);
        return new Set(ids);
    } catch (e) {
        alert(e);
        return new Set();
    }
}

(function() {
    // Start fetching followings list (note: no await here is intentional)
    let followings = getFollowings();

    // Patch the XMLHttpRequest.send() API to shim the load callback.
    // When the request completes, replace the responseText property
    // to return the filtered JSON object.
    //
    // Note that we can't just hook the responseText property descriptor,
    // since we may potentially need to asynchronously await the result
    // of loading the followings list. This means we need to do the hooks
    // in the XHR callbacks.
    let send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(body) {
        let onload = this.onload;
        if (onload !== null) {
            this.onload = function(e) {
                let xhr = this;

                // Ignore requests that are not for the stream API
                if (!isStreamUrl(xhr.responseURL)) {
                    onload.call(xhr, e);
                    return;
                }

                // Replace reposts in the API response. Note that we
                // depend on the followings list, so only perform the
                // filtering after it's loaded.
                followings.then((v) => {
                    Object.defineProperty(xhr, "responseText", {
                        value: filterRepostsInResponse(xhr.responseText, v)
                    });
                    onload.call(xhr, e);
                });
            };
        }
        return send.call(this, body);
    };
})();
