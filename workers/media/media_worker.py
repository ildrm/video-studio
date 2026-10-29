#!/usr/bin/env python3
"""One-shot, filesystem-staged media processor. The caller supplies isolation and authorization."""
from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path
import re
import selectors
import shutil
import signal
import subprocess
import struct
import sys
import tempfile
import time
import unicodedata
from fractions import Fraction
from typing import Any, Callable

TICKS = 240000
MAX_SEQUENCE_TICKS = TICKS * 24 * 60 * 60
MAX_INPUT_BYTES = 2 * 1024 * 1024 * 1024
MAX_INPUTS = 32
MAX_AUDIO_CLIP_TICKS = TICKS * 600
MAX_REQUEST_BYTES = 2 * 1024 * 1024
MAX_CAPTION_CUES = 500
MAX_CAPTION_TEXT = 2000
MEDIA_FORMATS = 'mov,matroska,webm,wav,mp3,aac'
ALLOWED_FPS = {(24, 1), (25, 1), (30, 1), (50, 1), (60, 1), (24000, 1001), (30000, 1001), (60000, 1001)}
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
SHA256 = re.compile(r'^[0-9a-f]{64}$')
_active: subprocess.Popen | None = None

class MediaError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code, self.message = code, message

def fail(code: str, message: str) -> None:
    raise MediaError(code, message)

def event(kind: str, **values: Any) -> None:
    print(json.dumps({'event': kind, **values}, separators=(',', ':')), flush=True)

def integer(value: Any, name: str, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        fail('INVALID_PROJECT', f'Invalid {name}.')
    return value

def number(value: Any, name: str, minimum: float, maximum: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not minimum <= value <= maximum:
        fail('INVALID_PROJECT', f'Invalid {name}.')
    return float(value)

def ratio(value: Any, name: str) -> Fraction:
    if not isinstance(value, dict) or set(value) != {'num', 'den'}:
        fail('INVALID_PROJECT', f'Invalid {name}.')
    return Fraction(integer(value['num'], name, 1, 1000000000), integer(value['den'], name, 1, 1000000000))

def require_object(value: Any, fields: set[str], name: str) -> dict:
    if not isinstance(value, dict) or set(value) != fields:
        fail('INVALID_PROJECT', f'Invalid {name}.')
    return value

def uid(value: Any, name: str) -> str:
    if not isinstance(value, str) or not UUID.fullmatch(value):
        fail('INVALID_PROJECT', f'Invalid {name}.')
    return value.lower()

def root_dir() -> Path:
    value = os.environ.get('MEDIA_WORK_ROOT', '')
    if not value or not Path(value).is_absolute():
        fail('CONFIGURATION_ERROR', 'An absolute media work root is required.')
    try:
        path = Path(value).resolve(strict=True)
    except OSError:
        fail('CONFIGURATION_ERROR', 'The media work root is unavailable.')
    if not path.is_dir():
        fail('CONFIGURATION_ERROR', 'The media work root must be a directory.')
    return path

def local_path(value: Any, root: Path, *, output: bool = False) -> Path:
    if not isinstance(value, str) or not value or len(value) > 4096 or not Path(value).is_absolute() or '\x00' in value:
        fail('INVALID_PATH', 'A staged local path is required.')
    supplied = Path(value)
    try:
        if output:
            parent = supplied.parent.resolve(strict=True)
            path = parent / supplied.name
            if not parent.is_dir() or supplied.name in {'.', '..'} or path.exists() or path.is_symlink():
                fail('INVALID_PATH', 'Output must be a new file in the work root.')
        else:
            path = supplied.resolve(strict=True)
            if not path.is_file() or path.stat().st_size > MAX_INPUT_BYTES:
                fail('INVALID_PATH', 'The staged input is unavailable or exceeds the size limit.')
        if not path.is_relative_to(root):
            fail('INVALID_PATH', 'The staged path is outside the work root.')
    except OSError:
        fail('INVALID_PATH', 'The staged path is unavailable.')
    return path

def timeout() -> float:
    try:
        value = int(os.environ.get('MEDIA_TIMEOUT_SECONDS', '600'))
    except ValueError:
        fail('CONFIGURATION_ERROR', 'Invalid media timeout.')
    if not 1 <= value <= 3600:
        fail('CONFIGURATION_ERROR', 'Invalid media timeout.')
    return float(value)

def binary(env_name: str, default: str) -> str:
    name = os.environ.get(env_name, default)
    if not name or '\x00' in name:
        fail('CONFIGURATION_ERROR', 'Invalid media executable.')
    return name

def run_stream(args: list[str], seconds_limit: float, consume: Callable[[bytes], None], *, limit: int,
               cwd: Path | None = None) -> int:
    """Drain both pipes under a deadline and byte caps, without unbounded temporary files."""
    global _active
    selector = selectors.DefaultSelector()
    try:
        _active = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, bufsize=0, start_new_session=True, cwd=cwd)
        assert _active.stdout is not None and _active.stderr is not None
        selector.register(_active.stdout, selectors.EVENT_READ, 'stdout')
        selector.register(_active.stderr, selectors.EVENT_READ, 'stderr')
        totals = {'stdout': 0, 'stderr': 0}
        deadline = time.monotonic() + seconds_limit
        while selector.get_map():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                fail('PROCESS_TIMEOUT', 'Media processing exceeded its time limit.')
            for key, _ in selector.select(min(.5, remaining)):
                chunk = os.read(key.fileobj.fileno(), 65536)
                if not chunk:
                    selector.unregister(key.fileobj)
                    continue
                totals[key.data] += len(chunk)
                if totals[key.data] > (limit if key.data == 'stdout' else 1024 * 1024):
                    fail('MEDIA_OUTPUT_TOO_LARGE', 'Media tool output exceeded its limit.')
                if key.data == 'stdout':
                    consume(chunk)
        try:
            return _active.wait(timeout=max(.001, deadline - time.monotonic()))
        except subprocess.TimeoutExpired:
            fail('PROCESS_TIMEOUT', 'Media processing exceeded its time limit.')
    except (FileNotFoundError, PermissionError):
        fail('MEDIA_TOOL_UNAVAILABLE', 'The configured media tool is unavailable or not executable.')
    finally:
        selector.close()
        if _active is not None:
            if _active.poll() is None:
                try:
                    os.killpg(_active.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                _active.wait()
            for stream in (_active.stdout, _active.stderr):
                if stream is not None:
                    stream.close()
        _active = None


def run_capture(args: list[str], seconds: float, *, limit: int = 2 * 1024 * 1024) -> str:
    data = bytearray()
    status = run_stream(args, seconds, data.extend, limit=limit)
    if status:
        fail('MEDIA_PROCESS_FAILED', 'Media inspection or processing failed.')
    try:
        return data.decode('utf-8', errors='strict')
    except UnicodeError:
        fail('MEDIA_PROCESS_FAILED', 'Media inspection returned invalid data.')

def optional_safe_int(value: Any, *, positive: bool = False) -> int | None:
    try:
        if isinstance(value, bool) or value is None:
            return None
        converted = int(value)
        if str(converted) != str(value) or abs(converted) > 9007199254740991 or (positive and converted <= 0):
            return None
        return converted
    except (ValueError, TypeError, OverflowError):
        return None

def first_audio_packet_pts(path: Path) -> int | None:
    args = [binary('FFPROBE_PATH', 'ffprobe'), '-v', 'error', '-protocol_whitelist', 'file,pipe',
            '-format_whitelist', MEDIA_FORMATS, '-select_streams', 'a:0', '-read_intervals', '%+#1',
            '-show_packets', '-show_entries', 'packet=pts', '-of', 'json', str(path)]
    try:
        packets = json.loads(run_capture(args, min(timeout(), 60.0))).get('packets', [])
        return optional_safe_int(packets[0].get('pts')) if packets and isinstance(packets[0], dict) else None
    except (ValueError, TypeError):
        return None

def probe(path: Path) -> dict:
    args = [binary('FFPROBE_PATH', 'ffprobe'), '-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', MEDIA_FORMATS, '-show_streams', '-show_format', '-of', 'json', str(path)]
    try:
        raw = json.loads(run_capture(args, min(timeout(), 60.0)))
    except (ValueError, TypeError):
        fail('INVALID_MEDIA', 'Unable to inspect media metadata.')
    if not isinstance(raw, dict) or not isinstance(raw.get('streams'), list):
        fail('INVALID_MEDIA', 'Media has no inspectable streams.')
    if len(raw['streams']) > 32:
        fail('INVALID_MEDIA', 'Media contains too many streams.')
    streams = raw['streams']
    videos = [s for s in streams if s.get('codec_type') == 'video' and not s.get('disposition', {}).get('attached_pic')]
    audios = [s for s in streams if s.get('codec_type') == 'audio']
    if len(videos) > 1 or len(audios) > 1 or (not videos and not audios):
        fail('UNSUPPORTED_MEDIA', 'At most one video and one audio stream are supported.')
    video = videos[0] if videos else None
    if video:
        width = integer(video.get('width'), 'source width', 1, 8192)
        height = integer(video.get('height'), 'source height', 1, 8192)
        if width * height > 8192 * 4320:
            fail('UNSUPPORTED_MEDIA', 'Source dimensions exceed the pixel limit.')
        video_result = {'codec': video.get('codec_name'), 'width': width, 'height': height,
                        'timeBase': video.get('time_base'), 'frameRate': video.get('avg_frame_rate'),
                        'sampleAspectRatio': video.get('sample_aspect_ratio', '1:1'),
                        'rotation': next((entry.get('rotation') for entry in video.get('side_data_list', [])
                                          if isinstance(entry, dict) and 'rotation' in entry), 0),
                        'startPts': optional_safe_int(video.get('start_pts')), 'durationPts': optional_safe_int(video.get('duration_ts'), positive=True),
                        'colorTransfer': video.get('color_transfer'), 'colorPrimaries': video.get('color_primaries'), 'colorSpace': video.get('color_space')}
    else:
        video_result = None
    audio = audios[0] if audios else None
    if audio:
        start_pts = optional_safe_int(audio.get('start_pts'))
        start_source = 'stream'
        if start_pts is None:
            start_pts = first_audio_packet_pts(path)
            start_source = 'first_packet' if start_pts is not None else None
        audio_result = {'codec': audio.get('codec_name'), 'sampleRate': audio.get('sample_rate'),
                        'channels': audio.get('channels'), 'timeBase': audio.get('time_base'),
                        'startPts': start_pts, 'durationPts': optional_safe_int(audio.get('duration_ts'), positive=True),
                        'startPtsSource': start_source}
    else:
        audio_result = None
    duration = raw.get('format', {}).get('duration')
    try:
        seconds_value = float(duration)
    except (TypeError, ValueError):
        fail('INVALID_MEDIA', 'Media duration is unavailable.')
    if not math.isfinite(seconds_value) or seconds_value <= 0 or seconds_value > 24 * 3600:
        fail('INVALID_MEDIA', 'Media duration is outside the supported limit.')
    return {'durationSeconds': seconds_value, 'format': raw.get('format', {}).get('format_name', ''),
            'video': video_result, 'audio': audio_result}

def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def seconds(value: Fraction) -> str:
    # Filter values are compiler generated; 12 decimal places are much finer than a tick.
    return f'{float(value):.12f}'


def display_ratio(video: dict) -> Fraction:
    """Resolve display geometry before scaling; coded pixels need not be square."""
    sar = video.get('sampleAspectRatio')
    try:
        aspect = Fraction(sar.replace(':', '/')) if sar and sar != 'N/A' else Fraction(1)
    except (ValueError, TypeError, AttributeError, ZeroDivisionError):
        fail('UNSUPPORTED_MEDIA', 'Source pixel aspect ratio is unavailable.')
    if aspect <= 0 or not Fraction(1, 100) <= aspect <= 100:
        fail('UNSUPPORTED_MEDIA', 'Source pixel aspect ratio is outside the supported range.')
    rotation = video.get('rotation', 0)
    if isinstance(rotation, bool) or not isinstance(rotation, (int, float)) or not math.isfinite(rotation) or rotation % 90:
        fail('UNSUPPORTED_MEDIA', 'Only right-angle source display rotation is supported.')
    result = Fraction(video['width'], video['height']) * aspect
    return 1 / result if rotation % 180 else result


def fit_display(video: dict, width: int, height: int) -> tuple[int, int]:
    aspect = display_ratio(video)
    if aspect >= Fraction(width, height):
        return width, max(2, int(Fraction(width, 1) / aspect) // 2 * 2)
    return max(2, int(height * aspect) // 2 * 2), height

def supported_document(doc: Any, assets: Any, root: Path) -> dict:
    require_object(doc, {'schemaVersion', 'projectId', 'revision', 'timebase', 'canvas', 'assets', 'activeSequenceId', 'sequences', 'thumbnail', 'exportPresets'}, 'project')
    if doc['schemaVersion'] != 1 or doc['timebase'] != TICKS:
        fail('UNSUPPORTED_PROJECT', 'Project schema version or timebase is not supported.')
    uid(doc['projectId'], 'project id')
    integer(doc['revision'], 'revision', 0, 9007199254740991)
    canvas = require_object(doc['canvas'], {'width', 'height', 'frameRate', 'backgroundColor', 'workingColorSpace'}, 'canvas')
    width = integer(canvas['width'], 'canvas width', 16, 3840)
    height = integer(canvas['height'], 'canvas height', 16, 3840)
    if width % 2 or height % 2 or width * height > 3840 * 2160:
        fail('UNSUPPORTED_PROJECT', 'Output dimensions must be even and within the processing limit.')
    fps = ratio(canvas['frameRate'], 'frame rate')
    if (fps.numerator, fps.denominator) not in ALLOWED_FPS:
        fail('UNSUPPORTED_PROJECT', 'Frame rate is not supported.')
    if canvas['workingColorSpace'] != 'rec709-sdr' or canvas['backgroundColor'] != '#000000ff':
        fail('UNSUPPORTED_PROJECT', 'Only black SDR canvases are supported.')
    if not isinstance(doc['assets'], list) or not 1 <= len(doc['assets']) <= MAX_INPUTS or not isinstance(assets, dict):
        fail('INVALID_PROJECT', 'A bounded set of staged assets is required.')
    references = {}
    for asset in doc['assets']:
        require_object(asset, {'assetId', 'versionId', 'kind', 'sha256', 'status'}, 'asset')
        version_id = uid(asset['versionId'], 'asset version')
        uid(asset['assetId'], 'asset id')
        if version_id in references or asset['kind'] not in ('video', 'audio', 'font') or asset['status'] != 'ready' or not isinstance(asset['sha256'], str) or not SHA256.fullmatch(asset['sha256']):
            fail('UNSUPPORTED_PROJECT', 'Assets must be distinct ready video, audio or font versions with a checksum.')
        references[version_id] = asset
    if set(assets) != set(references):
        fail('INVALID_PROJECT', 'Staged assets do not match the project references.')
    if not isinstance(doc['sequences'], list) or len(doc['sequences']) != 1:
        fail('UNSUPPORTED_PROJECT', 'Exactly one sequence is supported.')
    seq = require_object(doc['sequences'][0], {'id', 'durationTick', 'tracks', 'transitions', 'markers'}, 'sequence')
    if uid(doc['activeSequenceId'], 'active sequence') != uid(seq['id'], 'sequence id'):
        fail('INVALID_PROJECT', 'Active sequence is missing.')
    sequence_duration = integer(seq['durationTick'], 'sequence duration', 1, MAX_SEQUENCE_TICKS)
    if not isinstance(seq['transitions'], list) or not isinstance(seq['markers'], list):
        fail('INVALID_PROJECT', 'Sequence transitions or markers are invalid.')
    if len(seq['transitions']) > 1:
        fail('UNSUPPORTED_PROJECT', 'Only one two-clip crossfade is supported.')
    transition = seq['transitions'][0] if seq['transitions'] else None
    if transition is not None:
        require_object(transition, {'id', 'fromClipId', 'toClipId', 'type', 'durationTick', 'audioCrossfade'}, 'transition')
        uid(transition['id'], 'transition id')
        uid(transition['fromClipId'], 'transition source')
        uid(transition['toClipId'], 'transition target')
        if transition['type'] != 'fade' or transition['audioCrossfade'] is not True:
            fail('UNSUPPORTED_PROJECT', 'Only video fade with audio crossfade is supported.')
        overlap = integer(transition['durationTick'], 'transition duration', 1, MAX_SEQUENCE_TICKS)
        if Fraction(overlap, TICKS) * fps % 1:
            fail('INVALID_PROJECT', 'Transition duration must align to an output frame.')
    else:
        overlap = 0
    tracks = seq['tracks']
    if not isinstance(tracks, list) or not 1 <= len(tracks) <= 3:
        fail('UNSUPPORTED_PROJECT', 'One video, one optional audio and one optional caption track are supported.')
    for candidate in tracks:
        require_object(candidate, {'id', 'kind', 'order', 'locked', 'muted', 'solo', 'visible', 'clips'}, 'track')
        uid(candidate['id'], 'track id')
        integer(candidate['order'], 'track order', 0, 1000)
        if any(type(candidate[key]) is not bool for key in ('locked', 'muted', 'solo', 'visible')):
            fail('INVALID_PROJECT', 'Invalid track controls.')
    videos = [candidate for candidate in tracks if candidate['kind'] == 'video']
    audio_tracks = [candidate for candidate in tracks if candidate['kind'] == 'audio']
    caption_tracks = [candidate for candidate in tracks if candidate['kind'] == 'caption']
    if len(videos) != 1 or len(audio_tracks) > 1 or len(caption_tracks) > 1 or len(videos) + len(audio_tracks) + len(caption_tracks) != len(tracks):
        fail('UNSUPPORTED_PROJECT', 'One video, one optional audio and one optional caption track are supported.')
    if len({candidate['id'].lower() for candidate in tracks}) != len(tracks) or len({candidate['order'] for candidate in tracks}) != len(tracks):
        fail('INVALID_PROJECT', 'Track identities and orders must be distinct.')
    track = videos[0]
    audio_track = audio_tracks[0] if audio_tracks else None
    caption_track = caption_tracks[0] if caption_tracks else None
    if track['visible'] is not True or track['solo'] is not False:
        fail('UNSUPPORTED_PROJECT', 'The video track uses unsupported controls.')
    clips = track['clips']
    if not isinstance(clips, list) or not 1 <= len(clips) <= MAX_INPUTS:
        fail('UNSUPPORTED_PROJECT', 'A sequence must contain between one and 32 clips.')
    if transition is not None and len(clips) != 2:
        fail('UNSUPPORTED_PROJECT', 'A crossfade currently requires exactly two clips.')
    resolved = {}
    for version_id, asset in references.items():
        path = local_path(assets[version_id], root)
        if digest(path) != asset['sha256']:
            fail('ASSET_CHECKSUM_MISMATCH', 'A staged asset did not match its recorded checksum.')
        if asset['kind'] == 'font':
            if path.stat().st_size > 16 * 1024 * 1024:
                fail('UNSUPPORTED_MEDIA', 'Font exceeds the processing size limit.')
            resolved[version_id] = (path, None)
            continue
        inspected = probe(path)
        if (asset['kind'] == 'video' and not inspected['video']) or (asset['kind'] == 'audio' and (inspected['video'] or not inspected['audio'])):
            fail('INVALID_PROJECT', 'Asset kind does not match the inspected media.')
        resolved[version_id] = (path, inspected)
    parsed = []
    cursor = 0
    seen = set()
    for clip in clips:
        require_object(clip, {'id', 'type', 'assetVersionId', 'startTick', 'durationTick', 'sourceRange', 'playbackRate', 'sourceAudio', 'transform', 'effects', 'keyframes'}, 'clip')
        clip_id = uid(clip['id'], 'clip id')
        version_id = uid(clip['assetVersionId'], 'asset version')
        if clip_id in seen or clip['type'] != 'media' or version_id not in resolved:
            fail('INVALID_PROJECT', 'A clip references invalid or duplicate media.')
        seen.add(clip_id)
        start = integer(clip['startTick'], 'clip start', 0, MAX_SEQUENCE_TICKS)
        duration = integer(clip['durationTick'], 'clip duration', 1, MAX_SEQUENCE_TICKS)
        expected_start = cursor - overlap if transition is not None and len(parsed) == 1 else cursor
        if start != expected_start or start + duration > MAX_SEQUENCE_TICKS:
            fail('UNSUPPORTED_PROJECT', 'Clips must be contiguous or use the declared two-clip overlap.')
        if transition is not None and overlap >= duration:
            fail('INVALID_PROJECT', 'Transition must be shorter than both participating clips.')
        if Fraction(start, TICKS) * fps % 1 or Fraction(duration, TICKS) * fps % 1:
            fail('INVALID_PROJECT', 'Each video clip must start and end on an output frame boundary.')
        if ratio(clip['playbackRate'], 'playback rate') != 1:
            fail('UNSUPPORTED_PROJECT', 'Speed changes are not supported.')
        if clip['effects'] != [] or clip['keyframes'] != []:
            fail('UNSUPPORTED_PROJECT', 'Effects and keyframes are not supported.')
        transform = require_object(clip['transform'], {'x', 'y', 'scaleX', 'scaleY', 'rotationDeg', 'opacity'}, 'transform')
        if transform != {'x': 0, 'y': 0, 'scaleX': 1, 'scaleY': 1, 'rotationDeg': 0, 'opacity': 1}:
            fail('UNSUPPORTED_PROJECT', 'Custom transforms are not supported.')
        audio = require_object(clip['sourceAudio'], {'enabled', 'gainDb'}, 'source audio')
        if type(audio['enabled']) is not bool:
            fail('INVALID_PROJECT', 'Invalid source audio state.')
        gain = number(audio['gainDb'], 'source audio gain', -96, 24)
        source = require_object(clip['sourceRange'], {'inPts', 'outPts', 'timeBase'}, 'source range')
        src_in = integer(source['inPts'], 'source in', -9007199254740991, 9007199254740991)
        src_out = integer(source['outPts'], 'source out', -9007199254740991, 9007199254740991)
        tb = ratio(source['timeBase'], 'source timebase')
        if src_out <= src_in or abs(Fraction(duration, TICKS) - (src_out - src_in) * tb) > Fraction(1, TICKS):
            fail('INVALID_PROJECT', 'Source and timeline durations do not match.')
        metadata = resolved[version_id][1]
        if references[version_id]['kind'] != 'video' or not metadata or not metadata['video']:
            fail('INVALID_PROJECT', 'A video clip must reference a video asset.')
        try:
            if Fraction(metadata['video']['timeBase']) != tb:
                fail('INVALID_PROJECT', 'Source timebase differs from inspected media.')
        except (ValueError, TypeError, ZeroDivisionError):
            fail('INVALID_MEDIA', 'Source timebase is unavailable.')
        source_start = metadata['video']['startPts']
        source_duration = metadata['video']['durationPts']
        if source_start is None or source_duration is None:
            fail('UNSUPPORTED_MEDIA', 'Source timestamps are unavailable for an accurate trim.')
        if src_in < source_start or src_out > source_start + source_duration:
            fail('INVALID_PROJECT', 'Clip source range lies outside the media stream.')
        color = metadata['video']
        if (color['colorTransfer'], color['colorPrimaries'], color['colorSpace']) != ('bt709', 'bt709', 'bt709'):
            fail('UNSUPPORTED_MEDIA', 'Source color is untagged or not Rec.709 SDR; color interpretation is not available.')
        if metadata['audio'] and metadata['audio']['channels'] not in (1, 2):
            fail('UNSUPPORTED_MEDIA', 'Only mono and stereo audio sources are supported.')
        fitted = fit_display(metadata['video'], width, height)
        parsed.append({'path': resolved[version_id][0], 'fit': fitted, 'hasAudio': bool(metadata['audio']) and audio['enabled'] and not track['muted'] and not (audio_track and audio_track['solo']), 'gain': gain, 'inPts': src_in, 'outPts': src_out, 'tb': tb, 'duration': duration})
        cursor = start + duration
    if transition is not None:
        if transition['fromClipId'].lower() != clips[0]['id'].lower() or transition['toClipId'].lower() != clips[1]['id'].lower():
            fail('INVALID_PROJECT', 'Transition must join the two ordered adjacent clips.')
    if cursor != sequence_duration:
        fail('INVALID_PROJECT', 'Sequence duration does not match its clips.')
    if Fraction(sequence_duration, TICKS) * fps % 1:
        fail('INVALID_PROJECT', 'Sequence duration must end on a frame boundary.')
    audio_clips = []
    if audio_track is not None:
        items = audio_track['clips']
        if not isinstance(items, list) or not 1 <= len(items) <= MAX_INPUTS:
            fail('UNSUPPORTED_PROJECT', 'The audio track must contain between one and 32 clips.')
        previous_end = None
        for item in items:
            require_object(item, {'id', 'type', 'assetVersionId', 'startTick', 'durationTick', 'sourceRange', 'playbackRate', 'sourceAudio', 'transform', 'effects', 'keyframes'}, 'audio clip')
            item_id = uid(item['id'], 'clip id')
            version_id = uid(item['assetVersionId'], 'asset version')
            if item_id in seen or item['type'] != 'media' or version_id not in resolved:
                fail('INVALID_PROJECT', 'An audio clip references invalid or duplicate media.')
            seen.add(item_id)
            start_tick = integer(item['startTick'], 'audio clip start', 0, MAX_SEQUENCE_TICKS)
            duration_tick = integer(item['durationTick'], 'audio clip duration', 1, MAX_AUDIO_CLIP_TICKS)
            if start_tick % 5 or duration_tick % 5:
                fail('INVALID_PROJECT', 'Audio timing must align to a 48000 Hz sample.')
            if start_tick + duration_tick > sequence_duration or (previous_end is not None and start_tick != previous_end):
                fail('UNSUPPORTED_PROJECT', 'Audio clips must be contiguous, ordered and within the sequence.')
            if ratio(item['playbackRate'], 'playback rate') != 1 or item['effects'] != [] or item['keyframes'] != []:
                fail('UNSUPPORTED_PROJECT', 'Audio speed changes, effects and keyframes are not supported.')
            if item['transform'] != {'x': 0, 'y': 0, 'scaleX': 1, 'scaleY': 1, 'rotationDeg': 0, 'opacity': 1}:
                fail('UNSUPPORTED_PROJECT', 'Audio clip transforms are not supported.')
            source_audio = require_object(item['sourceAudio'], {'enabled', 'gainDb'}, 'source audio')
            if type(source_audio['enabled']) is not bool:
                fail('INVALID_PROJECT', 'Invalid source audio state.')
            gain = number(source_audio['gainDb'], 'source audio gain', -96, 24)
            source = require_object(item['sourceRange'], {'inPts', 'outPts', 'timeBase'}, 'audio source range')
            src_in = integer(source['inPts'], 'source in', -9007199254740991, 9007199254740991)
            src_out = integer(source['outPts'], 'source out', -9007199254740991, 9007199254740991)
            tb = ratio(source['timeBase'], 'source timebase')
            if src_out <= src_in or abs(Fraction(duration_tick, TICKS) - (src_out - src_in) * tb) > Fraction(1, TICKS):
                fail('INVALID_PROJECT', 'Audio source and timeline durations do not match.')
            inspected = resolved[version_id][1]
            metadata = inspected['audio'] if inspected else None
            if not metadata or metadata['channels'] not in (1, 2):
                fail('UNSUPPORTED_MEDIA', 'Audio clips require one mono or stereo audio stream.')
            try:
                if Fraction(metadata['timeBase']) != tb:
                    fail('INVALID_PROJECT', 'Audio timebase differs from inspected media.')
            except (ValueError, TypeError, ZeroDivisionError):
                fail('INVALID_MEDIA', 'Audio timebase is unavailable.')
            if metadata['startPts'] is None or metadata['durationPts'] is None:
                fail('UNSUPPORTED_MEDIA', 'Audio timestamps are unavailable for accurate trimming.')
            if src_in < metadata['startPts'] or src_out > metadata['startPts'] + metadata['durationPts']:
                fail('INVALID_PROJECT', 'Audio clip source range lies outside the media stream.')
            audio_clips.append({'path': resolved[version_id][0], 'start': start_tick, 'duration': duration_tick,
                                'inPts': src_in, 'outPts': src_out, 'tb': tb, 'gain': gain,
                                'enabled': source_audio['enabled']})
            previous_end = start_tick + duration_tick
    captions = []
    if caption_track is not None:
        items = caption_track['clips']
        if not isinstance(items, list) or len(items) > MAX_CAPTION_CUES:
            fail('UNSUPPORTED_PROJECT', 'The caption track exceeds the supported cue count.')
        if caption_track['solo'] or caption_track['order'] <= track['order']:
            fail('UNSUPPORTED_PROJECT', 'Captions must be above the video track and cannot be soloed.')
        previous_end = 0
        for cue in items:
            require_object(cue, {'id', 'type', 'startTick', 'durationTick', 'text', 'language', 'style', 'transform'}, 'caption cue')
            cue_id = uid(cue['id'], 'caption id')
            if cue_id in seen or cue['type'] != 'caption':
                fail('INVALID_PROJECT', 'Caption cue identity is invalid or duplicated.')
            seen.add(cue_id)
            start = integer(cue['startTick'], 'caption start', 0, sequence_duration)
            duration = integer(cue['durationTick'], 'caption duration', 1, sequence_duration)
            if start < previous_end or start + duration > sequence_duration:
                fail('INVALID_PROJECT', 'Caption cues must be ordered, non-overlapping and within the sequence.')
            if Fraction(start, TICKS) * fps % 1 or Fraction(duration, TICKS) * fps % 1:
                fail('INVALID_PROJECT', 'Caption cues must align to output frames.')
            text = cue['text']
            # Reject control characters rather than allowing FFmpeg to interpret them inconsistently.
            if not isinstance(text, str) or not 1 <= len(text) <= MAX_CAPTION_TEXT or any((ord(c) < 32 and c != '\n') or 0xD800 <= ord(c) <= 0xDFFF for c in text) or '\x7f' in text:
                fail('INVALID_PROJECT', 'Caption text is empty, too long or contains unsupported control characters.')
            if not isinstance(cue['language'], str) or not re.fullmatch(r'[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*', cue['language']) or len(cue['language']) > 35:
                fail('INVALID_PROJECT', 'Caption language must be a bounded language tag.')
            style = require_object(cue['style'], {'fontAssetVersionId', 'fontSizePx', 'color', 'align', 'direction', 'outlinePx', 'outlineColor'}, 'caption style')
            version_id = uid(style['fontAssetVersionId'], 'caption font')
            if version_id not in references or references[version_id]['kind'] != 'font':
                fail('INVALID_PROJECT', 'A caption requires an immutable staged font asset.')
            font_size = number(style['fontSizePx'], 'caption font size', 8, 200)
            outline = number(style['outlinePx'], 'caption outline', 0, 10)
            if not all(isinstance(style[key], str) and re.fullmatch(r'#[0-9A-Fa-f]{8}', style[key]) for key in ('color', 'outlineColor')):
                fail('INVALID_PROJECT', 'Caption colors must be explicit RGBA values.')
            if style['align'] not in ('start', 'center', 'end') or style['direction'] not in ('ltr', 'rtl', 'auto'):
                fail('INVALID_PROJECT', 'Caption alignment or direction is invalid.')
            transform = require_object(cue['transform'], {'x', 'y', 'scaleX', 'scaleY', 'rotationDeg', 'opacity'}, 'caption transform')
            x = number(transform['x'], 'caption x', 0, 1)
            y = number(transform['y'], 'caption y', 0, 1)
            if any(transform[key] != expected for key, expected in (('scaleX', 1), ('scaleY', 1), ('rotationDeg', 0), ('opacity', 1))):
                fail('UNSUPPORTED_PROJECT', 'Caption scale, rotation and opacity changes are not supported.')
            direction = style['direction']
            if direction == 'auto':
                direction = next(('rtl' if unicodedata.bidirectional(char) in ('R', 'AL') else 'ltr'
                                  for char in text if unicodedata.bidirectional(char) in ('L', 'R', 'AL')), 'ltr')
            captions.append({'text': text, 'startFrame': int(Fraction(start, TICKS) * fps),
                             'endFrame': int(Fraction(start + duration, TICKS) * fps), 'fontPath': resolved[version_id][0],
                             'fontVersion': version_id, 'fontSize': font_size, 'outline': outline,
                             'color': style['color'][1:], 'outlineColor': style['outlineColor'][1:],
                             'align': style['align'], 'direction': direction, 'x': x, 'y': y})
            previous_end = start + duration
        if not caption_track['visible'] or caption_track['muted']:
            captions = []
    return {'width': width, 'height': height, 'fps': fps, 'duration': sequence_duration,
            'clips': parsed, 'overlap': overlap, 'audioClips': audio_clips,
            'audioTrackMuted': bool(audio_track and audio_track['muted']), 'captions': captions}


def run_render(args: list[str], expected_duration: float, seconds_limit: float, scratch: Path) -> None:
    buffered = b''
    def progress(chunk: bytes) -> None:
        nonlocal buffered
        buffered += chunk
        while b'\n' in buffered:
            line, buffered = buffered.split(b'\n', 1)
            if line.startswith(b'out_time_us='):
                try:
                    fraction = min(1.0, max(0.0, int(line.split(b'=', 1)[1]) / 1000000 / expected_duration))
                    event('progress', phase='running', fraction=round(fraction, 4))
                except ValueError:
                    pass
        if len(buffered) > 65536:
            fail('MEDIA_OUTPUT_TOO_LARGE', 'Media progress output exceeded its limit.')
    if run_stream(args, seconds_limit, progress, limit=2 * 1024 * 1024, cwd=scratch):
        fail('RENDER_FAILED', 'The video render failed. Verify supported codecs and source media.')

def validate_decoded_audio(clip: dict, scratch: Path) -> None:
    """Check decoded sample coverage; no padded/synthetic media can mask a truncated source."""
    global _active
    source_start = seconds(clip['inPts'] * clip['tb'])
    source_end = seconds(clip['outPts'] * clip['tb'])
    duration = seconds(Fraction(clip['duration'], TICKS))
    filters = (f'atrim=start={source_start}:end={source_end},asetpts=PTS-STARTPTS,'
               'aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,'
               f'atrim=duration={duration}')
    args = [binary('FFMPEG_PATH', 'ffmpeg'), '-hide_banner', '-nostdin', '-v', 'error', '-xerror', '-copyts',
            '-protocol_whitelist', 'file,pipe', '-format_whitelist', MEDIA_FORMATS, '-i', str(clip['path']),
            '-map', '0:a:0', '-af', filters, '-ac', '2', '-ar', '48000', '-f', 's16le', 'pipe:1']
    expected_bytes = (clip['duration'] // 5) * 4  # 48 kHz stereo signed 16-bit samples.
    total = 0
    def count(chunk: bytes) -> None:
        nonlocal total
        total += len(chunk)
    status = run_stream(args, timeout(), count, limit=expected_bytes, cwd=scratch)
    if status or total != expected_bytes:
        fail('INVALID_MEDIA', 'The source did not decode the full requested audio interval.')

def render(request: dict, root: Path) -> dict:
    project = supported_document(request.get('document'), request.get('assets'), root)
    output = local_path(request.get('outputPath'), root, output=True)
    fps, width, height = project['fps'], project['width'], project['height']
    input_args = []
    graph = []
    for i, clip in enumerate(project['clips']):
        input_args += ['-protocol_whitelist', 'file,pipe', '-format_whitelist', MEDIA_FORMATS, '-i', str(clip['path'])]
        fitted_width, fitted_height = clip['fit']
        graph.append(f'[{i}:v:0]trim=start_pts={clip["inPts"]}:end_pts={clip["outPts"]},setpts=PTS-STARTPTS,scale={fitted_width}:{fitted_height},setsar=1,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black,fps={fps.numerator}/{fps.denominator},format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS[v{i}]')
        if clip['hasAudio']:
            start = seconds(clip['inPts'] * clip['tb'])
            end = seconds(clip['outPts'] * clip['tb'])
            graph.append(f'[{i}:a:0]atrim=start={start}:end={end},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume={clip["gain"]:.4f}dB,apad,atrim=duration={seconds(Fraction(clip["duration"], TICKS))}[a{i}]')
        else:
            graph.append(f'anullsrc=r=48000:cl=stereo,atrim=duration={seconds(Fraction(clip["duration"], TICKS))},asetpts=PTS-STARTPTS[a{i}]')
    if project['overlap']:
        fade_duration = seconds(Fraction(project['overlap'], TICKS))
        fade_offset = seconds(Fraction(project['clips'][0]['duration'] - project['overlap'], TICKS))
        expected_frames = int(Fraction(project['duration'], TICKS) * fps)
        graph.append(f'[v0][v1]xfade=transition=fade:duration={fade_duration}:offset={fade_offset}[xfaded]')
        frame_tick = TICKS * fps.denominator // fps.numerator
        graph.append(f'[xfaded]trim=end_frame={expected_frames},settb=1/{TICKS},setpts=N*{frame_tick}[vout]')
        graph.append(f'[a0][a1]acrossfade=d={fade_duration}:c1=tri:c2=tri[abase]')
    else:
        graph.append(''.join(f'[v{i}][a{i}]' for i in range(len(project['clips']))) + f'concat=n={len(project["clips"])}:v=1:a=1[vout][abase]')
    if project['audioClips'] and not project['audioTrackMuted']:
        for index, clip in enumerate(project['audioClips']):
            input_number = len(project['clips']) + index
            input_args += ['-protocol_whitelist', 'file,pipe', '-format_whitelist', MEDIA_FORMATS, '-i', str(clip['path'])]
            duration = seconds(Fraction(clip['duration'], TICKS))
            if clip['enabled']:
                source_start = seconds(clip['inPts'] * clip['tb'])
                source_end = seconds(clip['outPts'] * clip['tb'])
                graph.append(f'[{input_number}:a:0]atrim=start={source_start}:end={source_end},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume={clip["gain"]:.4f}dB,atrim=duration={duration}[music{index}]')
            else:
                graph.append(f'anullsrc=r=48000:cl=stereo,atrim=duration={duration},asetpts=PTS-STARTPTS[music{index}]')
        graph.append(''.join(f'[music{i}]' for i in range(len(project['audioClips']))) + f'concat=n={len(project["audioClips"])}:v=0:a=1[musicjoined]')
        delay_samples = project['audioClips'][0]['start'] // 5
        graph.append(f'[musicjoined]adelay={delay_samples}S:all=1[musicdelayed]')
        graph.append('[abase][musicdelayed]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]')
    else:
        graph.append('[abase]anull[aout]')
    with tempfile.TemporaryDirectory(prefix='studio-render-', dir=root) as scratch_name:
        scratch = Path(scratch_name)
        partial = scratch / 'output.mp4'
        video_output = 'vout'
        if project['captions']:
            capabilities = run_capture([binary('FFMPEG_PATH', 'ffmpeg'), '-hide_banner', '-h', 'filter=drawtext'], min(timeout(), 30.0))
            if not all(option in capabilities for option in ('fontfile', 'textfile', 'text_shaping')):
                fail('MEDIA_CAPABILITY_UNAVAILABLE', 'This media runtime lacks the required text and shaping renderer.')
        for index, cue in enumerate(project['captions']):
            # Only compiler-generated relative paths enter the filter language. Caption text is
            # UTF-8 data with expansion disabled, never filter or drawtext expression syntax.
            font_name = f'font-{cue["fontVersion"]}.ttf'
            font_target = scratch / font_name
            if not font_target.exists():
                shutil.copyfile(cue['fontPath'], font_target)
            text = cue['text']
            if cue['direction'] != 'auto':
                text = ('\u202b' if cue['direction'] == 'rtl' else '\u202a') + text + '\u202c'
            text_name = f'caption-{index:04d}.txt'
            (scratch / text_name).write_text(text, encoding='utf-8')
            x = f'{cue["x"] * width:.8f}'
            if cue['align'] == 'center':
                x += '-text_w/2'
            elif (cue['align'] == 'end' and cue['direction'] != 'rtl') or (cue['align'] == 'start' and cue['direction'] == 'rtl'):
                x += '-text_w'
            next_output = f'captioned{index}'
            graph.append(f'[{video_output}]drawtext=fontfile={font_name}:textfile={text_name}:expansion=none:text_shaping=1:fontsize={cue["fontSize"]:.4f}:fontcolor=0x{cue["color"]}:borderw={cue["outline"]:.4f}:bordercolor=0x{cue["outlineColor"]}:x={x}:y={cue["y"] * height:.8f}:enable=\'gte(n,{cue["startFrame"]})*lt(n,{cue["endFrame"]})\'[{next_output}]')
            video_output = next_output
        # A bounded project may still exceed the operating system's per-argument size.
        # Store the generated graph separately, rather than failing valid long cue tracks.
        graph_path = scratch / 'composition.ffgraph'
        graph_path.write_text(';'.join(graph), encoding='utf-8')
        args = [binary('FFMPEG_PATH', 'ffmpeg'), '-hide_banner', '-nostdin', '-v', 'error', '-xerror', '-copyts', *input_args, '-filter_complex_script', str(graph_path), '-map', f'[{video_output}]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709', '-c:a', 'aac', '-ar', '48000', '-movie_timescale', '240000', '-video_track_timescale', '240000', '-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', '-n', str(partial)]
        event('progress', phase='preparing', fraction=None)
        if not project['audioTrackMuted']:
            for clip in project['audioClips']:
                if clip['enabled']:
                    validate_decoded_audio(clip, scratch)
        run_render(args, float(Fraction(project['duration'], TICKS)), timeout(), scratch)
        event('progress', phase='verifying', fraction=None)
        metadata = probe(partial)
        if (metadata['video']['colorTransfer'], metadata['video']['colorPrimaries'], metadata['video']['colorSpace']) != ('bt709', 'bt709', 'bt709'):
            fail('VERIFICATION_FAILED', 'Rendered color metadata does not match SDR Rec.709.')
        if display_ratio(metadata['video']) != Fraction(width, height):
            fail('VERIFICATION_FAILED', 'Rendered display geometry does not match the selected output.')
        if not metadata['audio'] or metadata['video']['codec'] != 'h264' or metadata['audio']['codec'] != 'aac' or metadata['video']['width'] != width or metadata['video']['height'] != height:
            fail('VERIFICATION_FAILED', 'Rendered streams do not match the selected output.')
        output_audio = metadata['audio']
        if output_audio['sampleRate'] != '48000' or output_audio['channels'] != 2 or output_audio['startPts'] != 0 or output_audio['durationPts'] is None:
            fail('VERIFICATION_FAILED', 'Rendered audio stream format or timing is unavailable.')
        try:
            audio_duration = Fraction(output_audio['timeBase']) * output_audio['durationPts']
        except (ValueError, TypeError, ZeroDivisionError):
            fail('VERIFICATION_FAILED', 'Rendered audio timebase is unavailable.')
        if abs(audio_duration - Fraction(project['duration'], TICKS)) > Fraction(2, 48000):
            fail('VERIFICATION_FAILED', 'Rendered audio duration does not match the requested sequence.')
        try:
            result_fps = Fraction(metadata['video']['frameRate'])
        except (ValueError, TypeError, ZeroDivisionError):
            fail('VERIFICATION_FAILED', 'Rendered frame rate is unavailable.')
        if result_fps != fps or abs(metadata['durationSeconds'] - float(Fraction(project['duration'], TICKS))) > max(0.1, 2 / float(fps)):
            fail('VERIFICATION_FAILED', 'Rendered timing does not match the requested sequence.')
        decode_report = run_capture([binary('FFMPEG_PATH', 'ffmpeg'), '-hide_banner', '-nostdin', '-v', 'error', '-xerror', '-protocol_whitelist', 'file,pipe', '-i', str(partial), '-map', '0:v:0', '-map', '0:a:0', '-progress', 'pipe:1', '-nostats', '-f', 'null', '-'], timeout())
        frame_counts = re.findall(r'^frame=\s*(\d+)\s*$', decode_report, flags=re.MULTILINE)
        expected_frames = int(Fraction(project['duration'], TICKS) * fps)
        if not frame_counts or int(frame_counts[-1]) != expected_frames:
            fail('VERIFICATION_FAILED', 'Decoded output frame count does not match the requested sequence.')
        checksum = digest(partial)
        size = partial.stat().st_size
        if not size:
            fail('VERIFICATION_FAILED', 'The output is empty.')
        try:
            os.link(partial, output)
        except FileExistsError:
            fail('OUTPUT_EXISTS', 'The output destination already exists.')
        except OSError:
            fail('OUTPUT_UNAVAILABLE', 'Unable to publish the verified output.')
    return {'outputPath': str(output), 'sha256': checksum, 'sizeBytes': size, **metadata}

def thumbnail(request: dict, root: Path) -> dict:
    source = local_path(request.get('inputPath'), root)
    output = local_path(request.get('outputPath'), root, output=True)
    metadata = probe(source)
    if metadata['video'] is None:
        fail('UNSUPPORTED_MEDIA', 'A video stream is required for a thumbnail.')
    at = number(request.get('atSeconds'), 'thumbnail time', 0, 24 * 3600)
    if at >= metadata['durationSeconds']:
        fail('INVALID_REQUEST', 'Thumbnail time must be inside the source duration.')
    with tempfile.TemporaryDirectory(prefix='studio-thumb-', dir=root) as scratch_name:
        partial = Path(scratch_name) / 'thumbnail.png'
        thumb_width, thumb_height = fit_display(metadata['video'], 320, 8192)
        event('progress', phase='preparing', fraction=None)
        run_capture([binary('FFMPEG_PATH', 'ffmpeg'), '-hide_banner', '-nostdin', '-v', 'error',
                     '-protocol_whitelist', 'file,pipe', '-format_whitelist', MEDIA_FORMATS,
                     '-i', str(source), '-ss', f'{at:.6f}', '-frames:v', '1', '-vf', f'scale={thumb_width}:{thumb_height},setsar=1',
                     '-c:v', 'png', '-n', str(partial)], min(timeout(), 60.0))
        event('progress', phase='verifying', fraction=None)
        try:
            with partial.open('rb') as stream:
                header = stream.read(24)
            if len(header) != 24 or header[:8] != b'\x89PNG\r\n\x1a\n' or header[12:16] != b'IHDR':
                fail('VERIFICATION_FAILED', 'Thumbnail is not a valid PNG.')
            width, height = struct.unpack('>II', header[16:24])
            if not 1 <= width <= 320 or not 1 <= height <= 8192:
                fail('VERIFICATION_FAILED', 'Thumbnail dimensions are invalid.')
            run_capture([binary('FFMPEG_PATH', 'ffmpeg'), '-hide_banner', '-nostdin', '-v', 'error', '-xerror',
                         '-protocol_whitelist', 'file,pipe', '-i', str(partial), '-frames:v', '1',
                         '-f', 'null', '-'], min(timeout(), 60.0))
            checksum, size = digest(partial), partial.stat().st_size
            os.link(partial, output)
        except FileExistsError:
            fail('OUTPUT_EXISTS', 'The output destination already exists.')
        except OSError:
            fail('OUTPUT_UNAVAILABLE', 'Unable to publish the verified thumbnail.')
    return {'outputPath': str(output), 'sha256': checksum, 'sizeBytes': size, 'width': width, 'height': height}

def cancel(signum: int, _frame: Any) -> None:
    if _active is not None and _active.poll() is None:
        try:
            os.killpg(_active.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    raise MediaError('CANCELLED', 'Media processing was cancelled.')

def main() -> int:
    signal.signal(signal.SIGTERM, cancel)
    signal.signal(signal.SIGINT, cancel)
    try:
        data = sys.stdin.buffer.read(MAX_REQUEST_BYTES + 1)
        if len(data) > MAX_REQUEST_BYTES:
            fail('INVALID_REQUEST', 'Media request exceeds the size limit.')
        try:
            request = json.loads(data, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
        except (ValueError, UnicodeError):
            fail('INVALID_REQUEST', 'Media request is not valid JSON.')
        if not isinstance(request, dict):
            fail('INVALID_REQUEST', 'Media request must be an object.')
        root = root_dir()
        operation = request.get('operation')
        if operation == 'probe' and set(request) == {'operation', 'inputPath'}:
            result = probe(local_path(request['inputPath'], root))
        elif operation == 'render' and set(request) == {'operation', 'document', 'assets', 'outputPath'}:
            result = render(request, root)
        elif operation == 'thumbnail' and set(request) == {'operation', 'inputPath', 'outputPath', 'atSeconds'}:
            result = thumbnail(request, root)
        else:
            fail('INVALID_REQUEST', 'Media operation is not supported.')
        event('completed', result=result)
        return 0
    except MediaError as exc:
        event('failed', error={'code': exc.code, 'message': exc.message})
        return 1
    except Exception:
        # Never expose local paths, subprocess stderr, or media metadata to callers.
        event('failed', error={'code': 'INTERNAL_ERROR', 'message': 'Media processing failed unexpectedly.'})
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
