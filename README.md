# SoundCloud repost blocker

Removes reposts from your SoundCloud stream. I follow artists because I
enjoy their music, not their taste in music.

Note that reposts on artist pages are not removed, since SoundCloud
has that functionality built in. Only reposts on the homepage stream
will be filtered.

## Firefox edition

Works using the WebExtensions webRequest API instead of the browser DOM,
meaning it's less prone to breakage and doesn't suffer the problem of
elements appearing and disappearing from the page as it loads.

You can download this add-on here:
https://addons.mozilla.org/en-US/firefox/addon/soundcloud-repost-blocker/

## Chrome edition

Since the Chrome WebExtension API is trash, this version injects a
content script into the SoundCloud page that monkey patches the
`XMLHttpRequest` API. It's not as elegant as the Firefox version, but
it's still light years ahead of modifying the DOM.

There is no official Chrome Web Store listing for this extension.
Feel free to load it as an unpacked extension.
