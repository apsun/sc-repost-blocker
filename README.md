# SoundCloud repost blocker

Removes reposts from your SoundCloud stream. I follow artists because I
enjoy their music, not their taste in music.

Note that reposts on artist pages are not removed, since SoundCloud
has that functionality built in. Only reposts on the homepage stream
will be filtered.

As of version 2.0, this extension injects a content script into the
SoundCloud page that monkey patches the `XMLHttpRequest` API. The previous
version used the Firefox-specific `filterResponseData` API. If you wish
to use that version, see the legacy branch.
