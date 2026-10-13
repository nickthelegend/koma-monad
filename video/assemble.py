#!/usr/bin/env python3
"""Cut the KOMA Metropolis video: intro → live demo beats → CRE card → reveal → room → outro.

Each beat is a slice of a capture at its own speed. Narration lines start at their beat and set its minimum length.
Captions come from the ElevenLabs word timings, rendered as PNGs (this ffmpeg has no libass) and overlaid, plus an
.srt. Audio is normalised to -16 LUFS.
    python3 video/assemble.py      (from the repo root) → docs/demo/koma-metropolis.mp4 + .srt
"""
import json, os, subprocess, math

W = "video/work"
VO = f"{W}/vo"
OUT = "docs/demo"
os.makedirs(OUT, exist_ok=True)
os.makedirs(f"{W}/seg", exist_ok=True)

def run(*a):
    subprocess.run(a, check=True)

def dur(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).decode().strip())

def vo(i):
    return json.load(open(f"{VO}/{i}.json"))

# (source, in, out, speed, narration line, narration delay, live tag)
BEATS = [
    ("intro.mp4", 0, 33.5, 1, None, 0, False),
    ("demo.webm", 8.6, 16.6, 1, "d1", 0.4, True),       # /monad pipeline
    ("demo.webm", 18.5, 30.5, 3, "d2", 0.3, True),      # connect, series
    ("demo.webm", 30.5, 41.0, 1, None, 0, True),        # buy → receipt
    ("demo.webm", 44.0, 51.5, 1, "d3", 0.5, True),      # graduated to v4
    ("demo.webm", 52.0, 60.0, 1.5, "d4", 0.3, True),    # studio, typing
    ("demo.webm", 60.0, 83.0, 6, None, 0, True),        # Hunyuan thinking (sped up)
    ("demo.webm", 83.0, 91.5, 1, None, 0, True),        # pitch, pay, sign
    ("demo.webm", 91.5, 139.6, 5, "d5", 0.2, True),     # Kimi writes, FLUX draws (sped up)
    ("demo.webm", 139.6, 145.5, 1, None, 0, True),      # receipt
    ("demo.webm", 145.8, 159.8, 1.4, "d6", 0.6, True),  # the issue
    ("demo.webm", 185.8, 209.0, 1.6, "d7", 0.3, True),  # votes
    ("cre.mp4", 0, 7.6, 1, "d8", 0.3, False),           # CRE card (real output)
    ("reveal.webm", 4.0, 19.5, 1, "d9", 1.4, True),     # the reveal + story so far
    ("demo.webm", 498.9, 531.0, 2.6, "d10", 0.5, True), # Writers' Room
    ("outro.mp4", 0, 6.0, 1, "o1", 0.5, False),
]
INTRO_VO = [("i1", 0.8), ("i2", 7.4), ("i3", 16.3), ("i4", 22.6)]

# 1. clips. A line plays over its beat and the unnarrated beats after it; the last beat of that run holds its final
# frame only if the line would otherwise overrun.
lengths = [(b - a) / sp for (_, a, b, sp, *_r) in BEATS]
holds = [0.0] * len(BEATS)
for n, (_, _, _, _, line, delay, _) in enumerate(BEATS):
    if not line:
        continue
    end = n
    while end + 1 < len(BEATS) and not BEATS[end + 1][4]:
        end += 1
    room = sum(lengths[n:end + 1])
    holds[end] = max(holds[end], vo(line)["seconds"] + delay + 0.5 - room)
clips, t, placed, live = [], 0.0, [], []
for n, (src, a, b, sp, line, delay, tag) in enumerate(BEATS):
    hold = holds[n]
    out = f"{W}/seg/{n:02d}.mp4"
    vf = f"setpts=(PTS-STARTPTS)/{sp},fps=30,scale=1920:1080:flags=lanczos,format=yuv420p" + (f",tpad=stop_mode=clone:stop_duration={hold:.3f}" if hold else "")
    run("ffmpeg", "-y", "-loglevel", "error", "-ss", str(a), "-to", str(b), "-i", f"{W}/{src}", "-vf", vf, "-an", "-c:v", "libx264", "-crf", "18", "-preset", "medium", out)
    d = dur(out)
    if line:
        placed.append((line, t + delay))
    if tag:
        live.append((t, t + d))
    clips.append(out)
    t += d
for i, at in INTRO_VO:
    placed.append((i, at))
total = t
open(f"{W}/seg/list.txt", "w").write("".join(f"file '{os.path.abspath(c)}'\n" for c in clips))
run("ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", f"{W}/seg/list.txt", "-c", "copy", f"{W}/base.mp4")

# 2. narration bed
inputs, filt = [], []
for k, (i, at) in enumerate(sorted(placed, key=lambda x: x[1])):
    inputs += ["-i", f"{VO}/{i}.mp3"]
    filt.append(f"[{k}:a]adelay={int(at*1000)}|{int(at*1000)},apad[a{k}]")
mix = "".join(f"[a{k}]" for k in range(len(placed)))
filt.append(f"{mix}amix=inputs={len(placed)}:normalize=0,atrim=0:{total:.3f},loudnorm=I=-16:TP=-1.5:LRA=11[aout]")
run("ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(filt), "-map", "[aout]", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", f"{W}/vo.m4a")

# 3. captions: chunks of the written text, timed from the voiced line (proportionally when the spoken words differ)
caps = []
for i, at in placed:
    v = vo(i)
    words = v["text"].split()
    spoken = v["words"]
    size = 7
    for c in range(0, len(words), size):
        chunk = words[c:c + size]
        if len(spoken) == len(words):
            s, e = spoken[c]["s"], spoken[min(c + size, len(words)) - 1]["e"]
        else:
            s = v["seconds"] * c / len(words)
            e = v["seconds"] * min(c + size, len(words)) / len(words)
        caps.append({"text": " ".join(chunk), "s": round(at + s, 3), "e": round(at + e + 0.15, 3)})
caps.sort(key=lambda c: c["s"])
for a, b in zip(caps, caps[1:]):
    a["e"] = min(a["e"], b["s"])
json.dump({"caps": caps, "live": live, "total": total}, open(f"{W}/captions.json", "w"), indent=1)

def ts(x):
    h, m, s = int(x // 3600), int(x % 3600 // 60), x % 60
    return f"{h:02d}:{m:02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}"
open(f"{OUT}/koma-metropolis.srt", "w").write("".join(f"{n+1}\n{ts(c['s'])} --> {ts(c['e'])}\n{c['text']}\n\n" for n, c in enumerate(caps)))

# 4. PNGs for captions and the live tag (Playwright, KOMA's fonts, transparent background)
run("node", "video/caption-pngs.mjs")

# 5. overlay everything, in one pass
fs, idx = [], 1
ins = ["-i", f"{W}/base.mp4"]
prev = "0:v"
ins += ["-i", f"{W}/cap/live.png"]
live_en = "+".join(f"between(t,{a:.2f},{b:.2f})" for a, b in live)
fs.append(f"[{prev}][1:v]overlay=x=56:y=44:enable='{live_en}'[v1]")
prev, idx = "v1", 2
for n, c in enumerate(caps):
    ins += ["-i", f"{W}/cap/{n:03d}.png"]
    fs.append(f"[{prev}][{idx}:v]overlay=x=(W-w)/2:y=H-h-70:enable='between(t,{c['s']:.3f},{c['e']:.3f})'[v{idx}]")
    prev, idx = f"v{idx}", idx + 1
open(f"{W}/overlay.txt", "w").write(";".join(fs))
run("ffmpeg", "-y", "-loglevel", "error", *ins, "-i", f"{W}/vo.m4a", "-filter_complex_script", f"{W}/overlay.txt",
    "-map", f"[{prev}]", "-map", f"{idx}:a", "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-pix_fmt", "yuv420p",
    "-c:a", "copy", "-movflags", "+faststart", "-shortest", f"{OUT}/koma-metropolis.mp4")
print(f"{OUT}/koma-metropolis.mp4  {dur(f'{OUT}/koma-metropolis.mp4'):.1f}s, {len(caps)} captions")
