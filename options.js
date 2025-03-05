"use strict";

async function init() {
    let options = await chrome.storage.sync.get("repostBlocker");

    let maxTrackDurationMs = options["maxTrackDurationMs"];
    document.optionsForm.maxTrackDurationMs.value = maxTrackDurationMs ?? 0;

    for (let radio of document.optionsForm.maxTrackDurationMs) {
        radio.addEventListener("change", async (e) => {
			let currentOptions = await chrome.storage.sync.get("repostBlocker");
			currentOptions["maxTrackDurationMs"] = e.target.value;
            console.log('maxTrackDurationMs: ' + maxTrackDurationMs);
			await chrome.storage.sync.set(currentOptions, function() {
			  console.log('Settings saved' + currentOptions);
			});
        });
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
