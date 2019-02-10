# SoundCloud repost blocker

Removes reposts from your SoundCloud stream. I follow artists because I
enjoy their music, not their taste in music.

Note that reposts on artist pages are not removed, since SoundCloud
has that functionality built in. Only reposts on the homepage stream
will be filtered.

Works using the WebExtensions webRequest API instead of the browser DOM,
meaning it's less prone to breakage and doesn't suffer the problem of
elements appearing and disappearing from the page as it loads.
