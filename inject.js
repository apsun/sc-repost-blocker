// Content script loader, because normally content scripts
// are run with an isolated window object. This injects a
// script tag into the page DOM (which we do have access to)
// that points to the real content script.
let file = chrome.runtime.getURL("/content.js");
let script = document.createElement("script");
script.src = file;
document.documentElement.appendChild(script);
