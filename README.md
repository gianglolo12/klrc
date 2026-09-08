# klrc

Karaoke lyrics in your terminal. Give it a YouTube link or an audio file; it
plays the song and highlights the lyrics word by word, in time with the music.

```
  Hạ Còn Vương Nắng · DatKaa                          mpv ●   offset +0.0s
 ─────────────────────────────────────────────────────────────────────────

         và rồi ngày ấy cũng qua đi thật nhanh
       anh vẫn nhớ như in ngày đầu tiên gặp em

    ▸  hạ còn vương nắng, anh còn vương em
       ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔

       mà sao giờ đây đôi ta đã cách xa nhau
         một mùa hạ nữa lại về trên phố

 ─────────────────────────────────────────────────────────────────────────
   ▁▂▃▅▇▆▄▂▁▃▅▇█▆▄▂▁▂▄▆█▇▅▃▁▂▃▅▄▂▁▂▄▅▇▆▃▁▂▄▆▇▅▃▂▁▃▄▂
   ▰▰▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱   1:24 / 3:47

   space pause    ←→ seek 5s    [ ] sync    q quit
```

macOS only, for now.

## Usage

```bash
npx klrc "https://www.youtube.com/watch?v=..."   # YouTube link
npx klrc ~/Music/song.mp3                        # local file
npx klrc doctor                                  # check your setup
```

Nothing to install first: ffmpeg comes from npm, and yt-dlp is fetched
automatically (checksum-verified) the first time you paste a YouTube link.

### Keys

| Key | What it does |
|---|---|
| `space` | pause / resume |
| `←` `→` | seek 5s — **needs mpv** |
| `[` `]` | nudge lyric timing by 0.25s, remembered next time |
| `q` | quit |

### Options

```
--player <mpv|afplay>   pick the audio player
--title <name>          override the title used for the lyrics lookup
--artist <name>         override the artist used for the lyrics lookup
--no-audio              scroll lyrics on a timer without playing audio
--open                  open a new Terminal window and play there
```

## Use it from Claude Code

Install the plugin, then ask for a song by name instead of hunting for a link:

```
/plugin marketplace add <this-repo>
/plugin install klrc
```

```
/karaoke Hạ Còn Vương Nắng
/karaoke bài của Vũ về Hà Nội mùa thu
/karaoke fix          ← lyrics are wrong or out of sync
```

Claude finds the right video, then opens karaoke in a **new Terminal window** —
the animation needs a real TTY, which a chat pane cannot provide.

`/karaoke fix` is where the integration earns its keep: lrclib is
community-contributed, so lyrics sometimes have typos or a missing line. Claude
edits the cached `.lrc` directly. Ask it to clean up wording, not to fix a
song-wide timing offset — that is what `[` and `]` are for, and they are stored
separately so edits never clobber them.

## Why install mpv?

klrc works out of the box with `afplay`, which every Mac has. But afplay cannot
report its playback position, so klrc has to *count a clock* and assume the audio
keeps perfect pace. It drifts by a few tenths of a second by minute three, and
seeking is impossible.

`mpv` answers "where are you now?" over an IPC socket, so timing stays exact for
the whole song and `←` `→` work:

```bash
brew install mpv
```

The corner of the screen always shows which player is in use.

## Troubleshooting

**`no lyrics found`** — YouTube titles are messy (`Song | Official MV [4K]`, the
channel name instead of the artist). klrc cleans them up before searching, but
not always correctly. Retry with the real names:

```bash
npx klrc --title "Hạ Còn Vương Nắng" --artist "DatKaa" "<link>"
```

If lrclib genuinely doesn't have the song, you can contribute it at
[lrclib.net](https://lrclib.net).

**Lyrics are consistently early or late** — press `[` or `]` while playing. The
offset is saved per song, so the next time you open it the timing is already
right.

**A song plays but the words are for a different version** — remixes, live cuts
and sped-up uploads have a different length, so the lyrics don't line up. Look
for the official audio.

**`This video is blocked in your region`** — nothing klrc can do about that one.

## Where things are kept

```
~/.klrc/
  bin/yt-dlp                 downloaded once, checksum-verified
  audio/<id>.m4a             audio pulled from YouTube
  lyrics/<id>.lrc            lyrics — safe to edit by hand
  spectrum/<id>.json         precomputed spectrum
  config.json                per-song timing offsets
```

Delete the folder any time; everything is re-fetched on demand.

## Credits

Lyrics come from [LRCLIB](https://lrclib.net), an open, free lyrics database. If
klrc is useful to you, consider contributing lyrics back.
