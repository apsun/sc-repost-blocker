// Returns true if the item should be removed from the response.
function shouldFilter(item, followings, settings) {
    let maxTrackDurationMs = settings["maxTrackDurationMs"];

    if (maxTrackDurationMs > 0) {
        let trackDurationMs = item["track"]?.["duration"] ?? 0;
        if (trackDurationMs > 0 && trackDurationMs > maxTrackDurationMs) {
            // Filter out any track which duration is longer than maxTrackDurationMs
            return true;
        }
    }

    if (item["type"] === "track-repost") {
        // Allow if we're following the user who originally posted
        // the track
        if (followings["ids"].has(item["track"]["user_id"])) {
            return false;
        }

        // Allow if the track title or artist contains a username
        // that we're following. This handles the case of artists
        // reposting tracks from a label or collab.
        let title = item["track"]["title"];
        let artist = item["track"]["publisher_metadata"]?.["artist"];
        if (followings["usernames"].some(u => title.includes(u) || artist?.includes(u))) {
            return false;
        }

        return true;
    } else if (item["type"] === "playlist-repost") {
        // Allow if we're following the user who originally posted
        // the playlist
        if (followings["ids"].has(item["playlist"]["user_id"])) {
            return false;
        }

        return true;
    } else {
        // Unhandled item type, allow
        return false;
    }
}

// Returns a copy of the stream collection with all reposts from
// users that the current user is not also following removed.
function filterReposts(collection, followings, settings) {
    let result = [];
    for (let i = 0; i < collection.length; ++i) {
        let item = collection[i];
        if (!shouldFilter(item, followings, settings)) {
            result.push(item);
        }
    }

    let filtered = collection.length - result.length;
    console.log(`Filtered ${filtered}/${collection.length} items`);
    return result;
}

// Modifies a textual version of the stream API response to
// remove all reposts. Takes a JSON string as input and returns
// a JSON string after filtering.
function filterRepostsInResponse(responseText, followings, settings) {
    try {
        let json = JSON.parse(responseText);
        let newJson = {
            ...json,
            "collection": filterReposts(json["collection"], followings, settings)
        };
        return JSON.stringify(newJson);
    } catch (e) {
        alert("SoundCloud repost blocker: failed to filter reposts: " + e);
        return responseText;
    }
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

// Gets the list of users that the current user is following.
// This is necessary in the scenario that the user follows both
// users A and B. If A posts a track and B reposts it, the track
// will only show up in the stream once as a repost. If we don't
// do this, we will end up removing the track altogether from
// the stream, even though it's probably something the user
// wanted to see.
async function getFollowingUsers() {
    let authToken = getCookie("oauth_token");
    if (authToken === null) {
        console.log("Did not find OAuth token for current user");
        return [];
    }

    try {
        let me = await fetchAuthorized(
            "https://api-v2.soundcloud.com/me",
            authToken
        );

        // This appears to be limited to 200 server-side, so no point
        // asking for more than that
        let followings = [];
        let url = `https://api-v2.soundcloud.com/users/${me["id"]}/followings?limit=200`;
        do {
            let resp = await fetchAuthorized(url, authToken);
            followings = followings.concat(resp["collection"]);
            url = resp["next_href"];
        } while (url !== null);

        console.log(`Fetched ${followings.length} followings for current user`);
        return followings;
    } catch (e) {
        alert("SoundCloud repost blocker: failed to get following list: " + e);
        return [];
    }
}

// Returns the ids and usernames of the users that we're following
// in the format {ids: Set<integer>, usernames: Array<string>}
async function getFollowingIdsAndUsernames() {
    let users = await getFollowingUsers();
    return {
        "ids": new Set(users.map(u => u["id"])),
        "usernames": users.map(u => u["username"]),
    };
}


// Loads the repost blocker settings from local storage
async function getRepostBlockerSettings() {
    let settings = {
        "maxTrackDurationMs": 0
    };

    if (typeof chrome !== "undefined" && chrome.storage) {
        settings = await chrome.storage.sync.get("repostBlocker");
    }
    console.log(`Loaded settings ${settings.toString()}`);
    return settings;
}

(function() {
    // Start fetching followings list & settings (note: no await here is intentional)
    let followings = getFollowingIdsAndUsernames();

    // Start loading the saved repost blocker settings (note: no await here is intentional)
    let repostBlockerSettings = getRepostBlockerSettings();

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
                repostBlockerSettings.then((settings) => {
                    followings.then((v) => {
                        Object.defineProperty(xhr, "responseText", {
                            value: filterRepostsInResponse(xhr.responseText, v, settings)
                        });
                        onload.call(xhr, e);
                    });
                });
            };
        }
        return send.call(this, body);
    };
})();
