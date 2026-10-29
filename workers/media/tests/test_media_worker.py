import copy
import hashlib
from fractions import Fraction
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import unittest

WORKER = Path(__file__).resolve().parents[1] / 'media_worker.py'


def invoke(request, root, extra_env=None, seconds=30):
    env = {**os.environ, 'MEDIA_WORK_ROOT': str(root), **(extra_env or {})}
    completed = subprocess.run([sys.executable, str(WORKER)], input=json.dumps(request), text=True,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, timeout=seconds)
    events = [json.loads(line) for line in completed.stdout.splitlines()]
    return completed, events


def uuid(n):
    return f'{n:08d}-0000-4000-8000-000000000001'


class InputValidationTests(unittest.TestCase):
    def test_rejects_outside_workroot_before_running_tool(self):
        with tempfile.TemporaryDirectory() as directory:
            completed, events = invoke({'operation': 'probe', 'inputPath': '/etc/passwd'}, Path(directory))
            self.assertNotEqual(completed.returncode, 0)
            self.assertEqual(events[-1]['error']['code'], 'INVALID_PATH')
            self.assertNotIn('/etc/passwd', completed.stdout)

    def test_rejects_unknown_operation_without_fake_success(self):
        with tempfile.TemporaryDirectory() as directory:
            completed, events = invoke({'operation': 'untrusted_command', 'command': 'touch /tmp/x'}, Path(directory))
            self.assertNotEqual(completed.returncode, 0)
            self.assertEqual(events[-1]['event'], 'failed')
            self.assertEqual(events[-1]['error']['code'], 'INVALID_REQUEST')

    def test_rejects_nonfinite_json(self):
        with tempfile.TemporaryDirectory() as directory:
            env = {**os.environ, 'MEDIA_WORK_ROOT': directory}
            completed = subprocess.run([sys.executable, str(WORKER)], input='{"operation": NaN}', text=True,
                                       capture_output=True, env=env, timeout=10)
            self.assertNotEqual(completed.returncode, 0)
            self.assertEqual(json.loads(completed.stdout)['error']['code'], 'INVALID_REQUEST')


class RealMediaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='studio-worker-test-')
        cls.root = Path(cls.temp.name).resolve()
        cls.ffmpeg = os.environ.get('FFMPEG_PATH', 'ffmpeg')
        cls.ffprobe = os.environ.get('FFPROBE_PATH', 'ffprobe')
        for tool in (cls.ffmpeg, cls.ffprobe):
            try:
                check = subprocess.run([tool, '-version'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
            except (FileNotFoundError, subprocess.TimeoutExpired):
                cls.temp.cleanup()
                raise unittest.SkipTest(f'{tool} is unavailable; real media tests not run')
            if check.returncode:
                cls.temp.cleanup()
                raise unittest.SkipTest(f'{tool} cannot start; real media tests not run')
        caption_help = subprocess.run([cls.ffmpeg, '-hide_banner', '-h', 'filter=drawtext'],
                                      capture_output=True, text=True, timeout=10)
        cls.caption_renderer = all(option in caption_help.stdout for option in ('fontfile', 'textfile', 'text_shaping'))
        cls.red, cls.blue = cls.root / 'red.mp4', cls.root / 'blue.mp4'
        cls.wav, cls.mp3, cls.aac = cls.root / 'tone.wav', cls.root / 'tone.mp3', cls.root / 'tone.aac'
        make = [cls.ffmpeg, '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=160x90:r=30:d=2',
                '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2', '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709', '-c:a', 'aac', '-t', '2', '-y', str(cls.red)]
        subprocess.run(make, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15)
        make = [cls.ffmpeg, '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=160x90:r=30:d=2',
                '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709', '-t', '2', '-y', str(cls.blue)]
        subprocess.run(make, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15)
        for path, codec in ((cls.wav, 'pcm_s16le'), (cls.mp3, 'libmp3lame'), (cls.aac, 'aac')):
            subprocess.run([cls.ffmpeg, '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i',
                            'sine=frequency=880:sample_rate=48000:duration=2', '-c:a', codec, '-y', str(path)],
                           check=True, capture_output=True, timeout=15)
        cls.meta = {}
        for file in (cls.red, cls.blue, cls.wav, cls.mp3, cls.aac):
            completed, events = invoke({'operation': 'probe', 'inputPath': str(file)}, cls.root)
            if completed.returncode != 0:
                raise AssertionError(events)
            cls.meta[file] = events[-1]['result']

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def request(self, name='output.mp4'):
        refs = []
        clips = []
        mapping = {}
        for index, source in enumerate((self.red, self.blue)):
            meta = self.meta[source]['video']
            numerator, denominator = map(int, meta['timeBase'].split('/'))
            pts_per_second = denominator // numerator
            self.assertEqual(pts_per_second * numerator, denominator)
            version = uuid(10 + index)
            refs.append({'assetId': uuid(20 + index), 'versionId': version, 'kind': 'video',
                         'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'status': 'ready'})
            mapping[version] = str(source)
            start = meta['startPts']
            clips.append({'id': uuid(30 + index), 'type': 'media', 'assetVersionId': version,
                          'startTick': 240000 * index, 'durationTick': 240000,
                          'sourceRange': {'inPts': start, 'outPts': start + pts_per_second,
                                          'timeBase': {'num': numerator, 'den': denominator}},
                          'playbackRate': {'num': 1, 'den': 1}, 'sourceAudio': {'enabled': True, 'gainDb': 0},
                          'transform': {'x': 0, 'y': 0, 'scaleX': 1, 'scaleY': 1, 'rotationDeg': 0, 'opacity': 1},
                          'effects': [], 'keyframes': []})
        project = {'schemaVersion': 1, 'projectId': uuid(1), 'revision': 3, 'timebase': 240000,
                   'canvas': {'width': 160, 'height': 90, 'frameRate': {'num': 30, 'den': 1},
                              'backgroundColor': '#000000ff', 'workingColorSpace': 'rec709-sdr'},
                   'assets': refs, 'activeSequenceId': uuid(2),
                   'sequences': [{'id': uuid(2), 'durationTick': 480000,
                                  'tracks': [{'id': uuid(3), 'kind': 'video', 'order': 0, 'locked': False,
                                              'muted': False, 'solo': False, 'visible': True, 'clips': clips}],
                                  'transitions': [], 'markers': []}],
                   'thumbnail': {'width': 160, 'height': 90, 'layers': []}, 'exportPresets': []}
        return {'operation': 'render', 'document': project, 'assets': mapping, 'outputPath': str(self.root / name)}

    def test_probe_reports_actual_stream_timing(self):
        red = self.meta[self.red]
        self.assertEqual(red['video']['width'], 160)
        self.assertEqual(red['video']['height'], 90)
        self.assertEqual(red['video']['startPts'], 0)
        self.assertEqual(red['video']['durationPts'] * Fraction(red['video']['timeBase']), 2)
        self.assertEqual(red['audio']['codec'], 'aac')
        self.assertIsNone(self.meta[self.blue]['audio'])

    def with_audio(self, req, *, start=120000, duration=240000, gain=0, muted=False, solo=False):
        metadata = self.meta[self.wav]['audio']
        tb = Fraction(metadata['timeBase'])
        span = Fraction(duration, 240000) / tb
        self.assertEqual(span.denominator, 1)
        version = uuid(50)
        req['document']['assets'].append({'assetId': uuid(51), 'versionId': version, 'kind': 'audio',
                                          'sha256': hashlib.sha256(self.wav.read_bytes()).hexdigest(), 'status': 'ready'})
        req['assets'][version] = str(self.wav)
        clip = {'id': uuid(52), 'type': 'media', 'assetVersionId': version,
                'startTick': start, 'durationTick': duration,
                'sourceRange': {'inPts': metadata['startPts'], 'outPts': metadata['startPts'] + span.numerator,
                                'timeBase': {'num': tb.numerator, 'den': tb.denominator}},
                'playbackRate': {'num': 1, 'den': 1}, 'sourceAudio': {'enabled': True, 'gainDb': gain},
                'transform': {'x': 0, 'y': 0, 'scaleX': 1, 'scaleY': 1, 'rotationDeg': 0, 'opacity': 1},
                'effects': [], 'keyframes': []}
        req['document']['sequences'][0]['tracks'].append({'id': uuid(53), 'kind': 'audio', 'order': 1,
            'locked': False, 'muted': muted, 'solo': solo, 'visible': True, 'clips': [clip]})
        return req

    def audio_amplitudes(self, output_path):
        import array
        import math
        data = subprocess.run([self.ffmpeg, '-hide_banner', '-loglevel', 'error', '-i', output_path,
                               '-map', '0:a:0', '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'],
                              check=True, capture_output=True, timeout=10).stdout
        samples = array.array('f'); samples.frombytes(data)
        def amplitude(center, frequency):
            start = int((center - .05) * 48000); window = samples[start:start + 4800]
            sin_part = sum(x * math.sin(2 * math.pi * frequency * i / 48000) for i, x in enumerate(window))
            cos_part = sum(x * math.cos(2 * math.pi * frequency * i / 48000) for i, x in enumerate(window))
            return 2 * math.hypot(sin_part, cos_part) / len(window)
        return amplitude

    def with_captions(self, req, text='Caption', *, start=120000, duration=120000, require_renderer=True):
        if require_renderer and not self.caption_renderer:
            self.skipTest('This FFmpeg build lacks drawtext with text shaping; real caption render not run')
        candidates = (os.environ.get('FONT_PATH', ''), '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                      '/System/Library/Fonts/Supplemental/Arial.ttf')
        font = next((Path(value) for value in candidates if value and Path(value).is_file()), None)
        if font is None:
            self.skipTest('A real TTF font is required for caption rendering tests')
        version = uuid(60)
        req['document']['assets'].append({'assetId': uuid(61), 'versionId': version, 'kind': 'font',
                                          'sha256': hashlib.sha256(font.read_bytes()).hexdigest(), 'status': 'ready'})
        staged = self.root / 'caption-font.ttf'
        staged.write_bytes(font.read_bytes())
        req['assets'][version] = str(staged)
        cue = {'id': uuid(62), 'type': 'caption', 'startTick': start, 'durationTick': duration,
               'text': text, 'language': 'en',
               'style': {'fontAssetVersionId': version, 'fontSizePx': 18, 'color': '#ffffffff',
                         'align': 'center', 'direction': 'auto', 'outlinePx': 1, 'outlineColor': '#000000ff'},
               'transform': {'x': .5, 'y': .55, 'scaleX': 1, 'scaleY': 1, 'rotationDeg': 0, 'opacity': 1}}
        req['document']['sequences'][0]['tracks'].append({'id': uuid(63), 'kind': 'caption', 'order': 2,
            'locked': False, 'muted': False, 'solo': False, 'visible': True, 'clips': [cue]})
        return req

    def frame_rgb(self, path, frame):
        return subprocess.run([self.ffmpeg, '-hide_banner', '-loglevel', 'error', '-i', path,
                               '-vf', f'select=eq(n\\,{frame})', '-vsync', '0', '-frames:v', '1',
                               '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                              check=True, capture_output=True, timeout=10).stdout

    def test_caption_burnin_has_exact_half_open_frame_boundaries(self):
        req = self.with_captions(self.request('caption-boundaries.mp4'), 'Test caption')
        completed, events = invoke(req, self.root)
        self.assertEqual(completed.returncode, 0, events)
        output = events[-1]['result']['outputPath']
        whites = []
        for frame in (14, 15, 29, 30):
            data = self.frame_rgb(output, frame)
            whites.append(sum(min(data[i:i + 3]) > 180 for i in range(0, len(data), 3)))
        self.assertLess(whites[0], 10)
        self.assertGreater(whites[1], 100)
        self.assertGreater(whites[2], 100)
        self.assertLess(whites[3], 10)

    def test_caption_literal_unicode_and_filter_metacharacters_are_data(self):
        text = '%{eif:1/0:d} \' : ; [movie] \\ literal' + '\nسلام'
        req = self.with_captions(self.request('caption-literal.mp4'), text)
        cue = req['document']['sequences'][0]['tracks'][-1]['clips'][0]
        cue['language'] = 'fa-IR'; cue['style']['direction'] = 'rtl'
        cue['style']['fontSizePx'] = 10
        completed, events = invoke(req, self.root)
        self.assertEqual(completed.returncode, 0, events)
        data = self.frame_rgb(events[-1]['result']['outputPath'], 20)
        self.assertGreater(sum(min(data[i:i + 3]) > 180 for i in range(0, len(data), 3)), 40)

    def test_caption_track_can_be_hidden_without_changing_timing(self):
        req = self.with_captions(self.request('caption-hidden.mp4'))
        req['document']['sequences'][0]['tracks'][-1]['visible'] = False
        completed, events = invoke(req, self.root)
        self.assertEqual(completed.returncode, 0, events)
        data = self.frame_rgb(events[-1]['result']['outputPath'], 20)
        self.assertLess(sum(min(data[i:i + 3]) > 180 for i in range(0, len(data), 3)), 10)

    def test_caption_auto_direction_uses_first_strong_character_for_alignment(self):
        req = self.with_captions(self.request('caption-auto-rtl.mp4'), 'سلام')
        cue = req['document']['sequences'][0]['tracks'][-1]['clips'][0]
        cue['language'] = 'fa'; cue['style']['align'] = 'start'; cue['transform']['x'] = .75
        completed, events = invoke(req, self.root)
        self.assertEqual(completed.returncode, 0, events)
        data = self.frame_rgb(events[-1]['result']['outputPath'], 20)
        xs = [(i // 3) % 160 for i in range(0, len(data), 3) if min(data[i:i + 3]) > 180]
        self.assertGreater(len(xs), 20)
        self.assertLess(max(xs), 123, 'RTL start anchors the right edge, rather than clipping text to the right')
        self.assertLess(min(xs), 110)

    def test_captions_compose_with_crossfade_and_independent_music(self):
        req = self.with_captions(self.with_audio(self.fade_request('caption-fade-audio.mp4'),
                                                start=0, duration=240000), 'Mixed caption')
        completed, events = invoke(req, self.root)
        self.assertEqual(completed.returncode, 0, events)
        result = events[-1]['result']
        self.assertAlmostEqual(result['durationSeconds'], 1.5, delta=.04)
        data = self.frame_rgb(result['outputPath'], 22)
        self.assertGreater(sum(min(data[i:i + 3]) > 180 for i in range(0, len(data), 3)), 100)
        self.assertGreater(self.audio_amplitudes(result['outputPath'])(.75, 880), .01)

    def test_captions_reject_unknown_fonts_unsafe_controls_overlap_and_unsupported_transform(self):
        mutations = (
            lambda cue, track: cue['style'].update({'fontAssetVersionId': uuid(99)}),
            lambda cue, track: cue.update({'text': 'nul\x00text'}),
            lambda cue, track: cue.update({'text': '\ud800'}),
            lambda cue, track: cue.update({'startTick': 120001}),
            lambda cue, track: cue['transform'].update({'rotationDeg': 5}),
            lambda cue, track: track['clips'].append({**copy.deepcopy(cue), 'id': uuid(64)}),
            lambda cue, track: cue.update({'durationTick': 480000}),
            lambda cue, track: cue.update({'text': 'x' * 2001}),
        )
        for index, mutate in enumerate(mutations):
            req = self.with_captions(self.request(f'invalid-caption-{index}.mp4'), require_renderer=False)
            track = req['document']['sequences'][0]['tracks'][-1]
            mutate(track['clips'][0], track)
            completed, events = invoke(req, self.root)
            self.assertNotEqual(completed.returncode, 0, events)
            self.assertIn(events[-1]['error']['code'], ('INVALID_PROJECT', 'UNSUPPORTED_PROJECT'))
            self.assertFalse(Path(req['outputPath']).exists())

    def test_caption_missing_shaping_renderer_reports_capability_unavailable(self):
        req = self.with_captions(self.request('caption-no-renderer.mp4'), require_renderer=False)
        tool = Path(__file__).resolve().parent / 'fixtures' / 'no_caption_filter.sh'
        completed, events = invoke(req, self.root, {'FFMPEG_PATH': str(tool)})
        self.assertNotEqual(completed.returncode, 0)
        self.assertEqual(events[-1]['error']['code'], 'MEDIA_CAPABILITY_UNAVAILABLE')
        self.assertFalse(Path(req['outputPath']).exists())

    def test_maximum_caption_track_renders_without_exceeding_argv_limit(self):
        req = self.with_captions(self.request('captions-500.mp4'), 'Cue', start=0, duration=8000)
        seq = req['document']['sequences'][0]
        first = seq['tracks'][0]['clips'][0]
        first['durationTick'] = 480000
        first['sourceRange']['outPts'] = first['sourceRange']['inPts'] + self.meta[self.red]['video']['durationPts']
        seq['tracks'][0]['clips'] = [{**copy.deepcopy(first), 'id': uuid(100 + index), 'startTick': index * 480000}
                                     for index in range(10)]
        seq['durationTick'] = 4800000
        cue = seq['tracks'][-1]['clips'][0]
        seq['tracks'][-1]['clips'] = [{**copy.deepcopy(cue), 'id': uuid(1000 + index), 'startTick': index * 8000}
                                     for index in range(500)]
        completed, events = invoke(req, self.root, seconds=90)
        self.assertEqual(completed.returncode, 0, events)
        self.assertAlmostEqual(events[-1]['result']['durationSeconds'], 20, delta=.04)

    def test_tool_output_is_bounded_before_inspection_can_fill_disk(self):
        for fixture in ('flood_stdout.sh', 'flood_stderr.sh'):
            tool = Path(__file__).resolve().parent / 'fixtures' / fixture
            completed, events = invoke({'operation': 'probe', 'inputPath': str(self.red)}, self.root,
                                       {'FFPROBE_PATH': str(tool)}, seconds=10)
            self.assertNotEqual(completed.returncode, 0)
            self.assertEqual(events[-1]['error']['code'], 'MEDIA_OUTPUT_TOO_LARGE')

    def test_non_square_source_pixels_preserve_display_aspect_in_render_and_thumbnail(self):
        source = self.root / 'wide-pixels.mp4'
        subprocess.run([self.ffmpeg, '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i',
                        'color=c=red:s=160x90:r=30:d=2', '-vf', 'setsar=2', '-c:v', 'libx264',
                        '-pix_fmt', 'yuv420p', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709',
                        '-y', str(source)], check=True, capture_output=True, timeout=15)
        req = self.request('wide-pixels-render.mp4')
        asset = req['document']['assets'][0]
        asset['sha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
        req['assets'][asset['versionId']] = str(source)
        completed, events = invoke(req, self.root)
        self.assertEqual(completed.returncode, 0, events)
        data = self.frame_rgb(events[-1]['result']['outputPath'], 15)
        top, middle = data[:3], data[(45 * 160 + 80) * 3:(45 * 160 + 80) * 3 + 3]
        self.assertLess(max(top), 10, 'wide display aspect leaves black letterboxing')
        self.assertGreater(middle[0], middle[2] + 100, 'source image remains visible')
        target = self.root / 'wide-pixels-thumbnail.png'
        completed, events = invoke({'operation': 'thumbnail', 'inputPath': str(source),
                                    'outputPath': str(target), 'atSeconds': .5}, self.root)
        self.assertEqual(completed.returncode, 0, events)
        self.assertEqual((events[-1]['result']['width'], events[-1]['result']['height']), (320, 90))

    def test_audio_only_probe_reports_stream_pts_for_wav_mp3_aac(self):
        for path, expected in ((self.wav, 'pcm_s16le'), (self.mp3, 'mp3'), (self.aac, 'aac')):
            result = self.meta[path]
            self.assertIsNone(result['video'])
            self.assertEqual(result['audio']['codec'], expected)
            self.assertGreater(result['audio']['durationPts'], 0)
            self.assertIsNotNone(result['audio']['startPts'])
            self.assertGreater(Fraction(result['audio']['timeBase']), 0)
        self.assertEqual(self.meta[self.wav]['audio']['startPtsSource'], 'first_packet')
        completed, events = invoke({'operation': 'thumbnail', 'inputPath': str(self.wav),
                                    'outputPath': str(self.root / 'audio.png'), 'atSeconds': 0}, self.root)
        self.assertNotEqual(completed.returncode, 0)
        self.assertEqual(events[-1]['error']['code'], 'UNSUPPORTED_MEDIA')

    def test_audio_track_mixes_with_independent_position_gain_mute_and_solo(self):
        req = self.with_audio(self.request('audio-mix.mp4'), gain=-6)
        completed, events = invoke(req, self.root)
        self.assertEqual(completed.returncode, 0, events)
        result = events[-1]['result']
        self.assertAlmostEqual(result['durationSeconds'], 2, delta=.04)
        self.assertEqual(result['video']['frameRate'], '30/1')
        amplitude = self.audio_amplitudes(result['outputPath'])
        self.assertGreater(amplitude(.25, 440), .01)
        self.assertLess(amplitude(.25, 880), .002)
        self.assertGreater(amplitude(.75, 440), .01)
        self.assertGreater(amplitude(.75, 880), .01)
        self.assertGreater(amplitude(1.25, 880), .01)
        self.assertLess(amplitude(1.75, 880), .002)
        muted = self.with_audio(self.request('audio-muted.mp4'), muted=True)
        completed, events = invoke(muted, self.root)
        self.assertEqual(completed.returncode, 0, events)
        amplitude = self.audio_amplitudes(events[-1]['result']['outputPath'])
        self.assertGreater(amplitude(.75, 440), .01)
        self.assertLess(amplitude(.75, 880), .002)
        solo = self.with_audio(self.request('audio-solo.mp4'), solo=True)
        completed, events = invoke(solo, self.root)
        self.assertEqual(completed.returncode, 0, events)
        amplitude = self.audio_amplitudes(events[-1]['result']['outputPath'])
        self.assertLess(amplitude(.75, 440), .002)
        self.assertGreater(amplitude(.75, 880), .01)

    def test_audio_track_can_use_video_asset_audio_stream(self):
        req = self.with_audio(self.request('video-audio-source.mp4'))
        track = req['document']['sequences'][0]['tracks'][1]
        old_asset = req['document']['assets'].pop()
        del req['assets'][old_asset['versionId']]
        video_asset = req['document']['assets'][0]
        clip = track['clips'][0]
        clip['assetVersionId'] = video_asset['versionId']
        meta = self.meta[self.red]['audio']; tb = Fraction(meta['timeBase']); span = Fraction(1) / tb
        self.assertEqual(span.denominator, 1)
        clip['sourceRange'] = {'inPts': meta['startPts'], 'outPts': meta['startPts'] + span.numerator,
                               'timeBase': {'num': tb.numerator, 'den': tb.denominator}}
        completed, events = invoke(req, self.root)
        self.assertEqual(completed.returncode, 0, events)
        amplitude = self.audio_amplitudes(events[-1]['result']['outputPath'])
        self.assertGreater(amplitude(.75, 440), amplitude(.25, 440) * 1.5)
        self.assertGreater(amplitude(1.25, 440), .01)
        self.assertLess(amplitude(1.75, 440), .002)

    def test_decoded_audio_coverage_rejects_short_source(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location('worker_for_coverage', WORKER)
        worker = importlib.util.module_from_spec(spec); spec.loader.exec_module(worker)
        clip = {'path': self.wav, 'inPts': 0, 'outPts': 144000,
                'tb': Fraction(1, 48000), 'duration': 720000}
        with self.assertRaises(worker.MediaError) as context:
            worker.validate_decoded_audio(clip, self.root)
        self.assertEqual(context.exception.code, 'INVALID_MEDIA')

    def test_audio_clip_enable_and_independent_gain(self):
        normal = self.with_audio(self.request('audio-normal.mp4'), gain=0)
        completed, events = invoke(normal, self.root)
        self.assertEqual(completed.returncode, 0, events)
        normal_amplitude = self.audio_amplitudes(events[-1]['result']['outputPath'])(.75, 880)
        quiet = self.with_audio(self.request('audio-quiet.mp4'), gain=-6)
        completed, events = invoke(quiet, self.root)
        self.assertEqual(completed.returncode, 0, events)
        quiet_amplitude = self.audio_amplitudes(events[-1]['result']['outputPath'])(.75, 880)
        self.assertGreater(normal_amplitude, .01)
        self.assertGreater(quiet_amplitude / normal_amplitude, .43)
        self.assertLess(quiet_amplitude / normal_amplitude, .57)
        disabled = self.with_audio(self.request('audio-disabled.mp4'))
        disabled['document']['sequences'][0]['tracks'][1]['clips'][0]['sourceAudio']['enabled'] = False
        completed, events = invoke(disabled, self.root)
        self.assertEqual(completed.returncode, 0, events)
        amplitude = self.audio_amplitudes(events[-1]['result']['outputPath'])
        self.assertLess(amplitude(.75, 880), .002)
        self.assertGreater(amplitude(.75, 440), .01)

    def test_mp3_and_aac_sources_mix_with_probed_audio_pts(self):
        for source in (self.mp3, self.aac):
            with self.subTest(source=source.suffix):
                req = self.with_audio(self.request(f'mixed-{source.suffix[1:]}.mp4'))
                asset = req['document']['assets'][-1]
                asset['sha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
                req['assets'][asset['versionId']] = str(source)
                meta = self.meta[source]['audio']; tb = Fraction(meta['timeBase'])
                span = Fraction(1, 1) / tb
                self.assertEqual(span.denominator, 1)
                clip = req['document']['sequences'][0]['tracks'][1]['clips'][0]
                clip['sourceRange'] = {'inPts': meta['startPts'], 'outPts': meta['startPts'] + span.numerator,
                                       'timeBase': {'num': tb.numerator, 'den': tb.denominator}}
                completed, events = invoke(req, self.root)
                self.assertEqual(completed.returncode, 0, events)
                amplitude = self.audio_amplitudes(events[-1]['result']['outputPath'])
                self.assertLess(amplitude(.25, 880), .002)
                self.assertGreater(amplitude(.75, 880), .01)
                self.assertGreater(amplitude(1.25, 880), .01)
                self.assertLess(amplitude(1.75, 880), .002)

    def test_audio_track_contiguous_clips_mix_over_video_crossfade(self):
        req = self.with_audio(self.fade_request('fade-with-music.mp4'), start=60000, duration=240000)
        track = req['document']['sequences'][0]['tracks'][1]
        first = track['clips'][0]; first['durationTick'] = 120000; first['sourceRange']['outPts'] = 24000
        second = copy.deepcopy(first); second['id'] = uuid(54); second['startTick'] = 180000
        second['sourceRange']['inPts'] = 24000; second['sourceRange']['outPts'] = 48000
        track['clips'].append(second)
        completed, events = invoke(req, self.root)
        self.assertEqual(completed.returncode, 0, events)
        self.assertAlmostEqual(events[-1]['result']['durationSeconds'], 1.5, delta=.04)
        amplitude = self.audio_amplitudes(events[-1]['result']['outputPath'])
        self.assertLess(amplitude(.1, 880), .002)
        self.assertGreater(amplitude(.5, 880), .01)
        self.assertGreater(amplitude(1.0, 880), .01)
        self.assertLess(amplitude(1.35, 880), .002)

    def test_audio_track_rejects_gaps_overlap_out_of_bounds_and_unsupported_tracks(self):
        for index, mutate in enumerate((
            lambda s: s['tracks'][1]['clips'][0].update({'startTick': 120001}),
            lambda s: s['tracks'][1]['clips'][0].update({'durationTick': 480000}),
            lambda s: s['tracks'][1]['clips'][0]['sourceRange'].update({'outPts': 96001}),
            lambda s: s['tracks'][1].update({'kind': 'caption'}),
        )):
            req = self.with_audio(self.request(f'invalid-audio-{index}.mp4'))
            mutate(req['document']['sequences'][0])
            completed, events = invoke(req, self.root)
            self.assertNotEqual(completed.returncode, 0, events)
            self.assertEqual(events[-1]['event'], 'failed')
            self.assertFalse(Path(req['outputPath']).exists())
        req = self.with_audio(self.request('audio-gap.mp4'))
        track = req['document']['sequences'][0]['tracks'][1]
        second = copy.deepcopy(track['clips'][0]); second['id'] = uuid(54); second['startTick'] = 370000
        track['clips'].append(second)
        completed, events = invoke(req, self.root)
        self.assertNotEqual(completed.returncode, 0, events)
        self.assertEqual(events[-1]['event'], 'failed')

    def test_thumbnail_is_real_decodable_png_and_cannot_overwrite(self):
        target = self.root / 'frame.png'
        req = {'operation': 'thumbnail', 'inputPath': str(self.red), 'outputPath': str(target), 'atSeconds': 0.5}
        completed, events = invoke(req, self.root)
        self.assertEqual(completed.returncode, 0, events)
        self.assertEqual(events[-1]['event'], 'completed')
        result = events[-1]['result']
        self.assertEqual(result['width'], 320)
        self.assertGreater(result['height'], 0)
        self.assertTrue(target.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'))
        self.assertEqual(hashlib.sha256(target.read_bytes()).hexdigest(), result['sha256'])
        completed, events = invoke(req, self.root)
        self.assertNotEqual(completed.returncode, 0)
        self.assertEqual(events[-1]['error']['code'], 'INVALID_PATH')
        self.assertEqual(hashlib.sha256(target.read_bytes()).hexdigest(), result['sha256'])

    def test_render_creates_verified_output_with_real_cuts_audio_and_silence(self):
        request = self.request('actual.mp4')
        completed, events = invoke(request, self.root)
        self.assertEqual(completed.returncode, 0, events)
        self.assertEqual(events[-1]['event'], 'completed')
        self.assertTrue(any(event['event'] == 'progress' and event['phase'] == 'running' for event in events))
        result = events[-1]['result']
        self.assertEqual(result['video']['codec'], 'h264')
        self.assertEqual(result['audio']['codec'], 'aac')
        self.assertAlmostEqual(result['durationSeconds'], 2, delta=.1)
        self.assertEqual(hashlib.sha256(Path(result['outputPath']).read_bytes()).hexdigest(), result['sha256'])
        colors = []
        for timestamp in ('0.5', '1.5'):
            data = subprocess.run([self.ffmpeg, '-hide_banner', '-loglevel', 'error', '-ss', timestamp,
                                   '-i', result['outputPath'], '-frames:v', '1', '-f', 'rawvideo',
                                   '-pix_fmt', 'rgb24', '-'], check=True, capture_output=True, timeout=10).stdout
            colors.append(data[:3])
        self.assertGreater(colors[0][0], colors[0][2] + 100, 'first segment is red')
        self.assertGreater(colors[1][2], colors[1][0] + 100, 'second segment is blue')
        import array
        decoded = subprocess.run([self.ffmpeg, '-hide_banner', '-loglevel', 'error', '-i', result['outputPath'],
                                  '-map', '0:a:0', '-ac', '1', '-ar', '48000', '-f', 's16le', '-'],
                                 check=True, capture_output=True, timeout=10).stdout
        samples = array.array('h')
        samples.frombytes(decoded)
        first = samples[12000:36000]
        second = samples[60000:84000]
        self.assertGreater(sum(abs(x) for x in first) / len(first), 100, 'first clip retains audio')
        self.assertLess(sum(abs(x) for x in second) / len(second), 20, 'silent clip receives silence')
        self.assertTrue(Path(result['outputPath']).is_file())

    def fade_request(self, name='fade.mp4'):
        req = self.request(name)
        seq = req['document']['sequences'][0]
        first, second = seq['tracks'][0]['clips']
        second['startTick'] = 120000
        seq['durationTick'] = 360000
        seq['transitions'] = [{'id': uuid(40), 'fromClipId': first['id'], 'toClipId': second['id'],
                               'type': 'fade', 'durationTick': 120000, 'audioCrossfade': True}]
        return req

    def test_crossfade_overlaps_correct_duration_frames_color_and_audio(self):
        req = self.fade_request('dissolve.mp4')
        completed, events = invoke(req, self.root)
        self.assertEqual(completed.returncode, 0, events)
        result = events[-1]['result']
        self.assertAlmostEqual(result['durationSeconds'], 1.5, delta=.04)
        counted = subprocess.run([self.ffprobe, '-v', 'error', '-select_streams', 'v:0', '-count_frames',
                                  '-show_entries', 'stream=nb_read_frames', '-of', 'json', result['outputPath']],
                                 capture_output=True, check=True, timeout=10)
        self.assertEqual(int(json.loads(counted.stdout)['streams'][0]['nb_read_frames']), 45)
        colors = []
        for timestamp in ('0.25', '0.75', '1.25'):
            data = subprocess.run([self.ffmpeg, '-hide_banner', '-loglevel', 'error', '-ss', timestamp,
                                   '-i', result['outputPath'], '-frames:v', '1', '-f', 'rawvideo',
                                   '-pix_fmt', 'rgb24', '-'], check=True, capture_output=True, timeout=10).stdout
            colors.append(data[:3])
        self.assertGreater(colors[0][0], colors[0][2] + 100)
        self.assertGreater(colors[1][0], 60)
        self.assertGreater(colors[1][2], 60)
        self.assertGreater(colors[2][2], colors[2][0] + 100)
        import array
        data = subprocess.run([self.ffmpeg, '-hide_banner', '-loglevel', 'error', '-i', result['outputPath'],
                               '-map', '0:a:0', '-ac', '1', '-ar', '48000', '-f', 's16le', '-'],
                              check=True, capture_output=True, timeout=10).stdout
        samples = array.array('h')
        samples.frombytes(data)
        average = lambda lo, hi: sum(abs(x) for x in samples[lo:hi]) / (hi - lo)
        self.assertGreater(average(6000, 18000), average(33000, 39000) * 1.5)
        self.assertLess(average(54000, 66000), 20)

    def test_crossfade_at_fractional_frame_rate_has_exact_frame_count(self):
        req = self.fade_request('fractional-fade.mp4')
        doc = req['document']
        doc['canvas']['frameRate'] = {'num': 30000, 'den': 1001}
        seq = doc['sequences'][0]
        seq['durationTick'] = 360360
        seq['transitions'][0]['durationTick'] = 120120
        for index, color in enumerate(('red', 'blue')):
            source = self.root / f'fractional-fade-{color}.mp4'
            subprocess.run([self.ffmpeg, '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i',
                            f'color=c={color}:s=160x90:r=30000/1001:d=2', '-c:v', 'libx264',
                            '-pix_fmt', 'yuv420p', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709',
                            '-y', str(source)], check=True, capture_output=True, timeout=15)
            completed, probed = invoke({'operation': 'probe', 'inputPath': str(source)}, self.root)
            self.assertEqual(completed.returncode, 0, probed)
            meta = probed[-1]['result']['video']
            tb = Fraction(meta['timeBase'])
            span = Fraction(1001, 1000) / tb
            self.assertEqual(span.denominator, 1)
            asset = doc['assets'][index]
            asset['sha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
            req['assets'][asset['versionId']] = str(source)
            clip = seq['tracks'][0]['clips'][index]
            clip['startTick'] = 120120 * index
            clip['durationTick'] = 240240
            clip['sourceRange'] = {'inPts': meta['startPts'], 'outPts': meta['startPts'] + span.numerator,
                                   'timeBase': {'num': tb.numerator, 'den': tb.denominator}}
        completed, events = invoke(req, self.root)
        self.assertEqual(completed.returncode, 0, events)
        result = events[-1]['result']
        self.assertEqual(result['video']['frameRate'], '30000/1001')
        self.assertAlmostEqual(result['durationSeconds'], 1.5015, delta=.04)
        counted = subprocess.run([self.ffprobe, '-v', 'error', '-select_streams', 'v:0', '-count_frames',
                                  '-show_entries', 'stream=nb_read_frames', '-of', 'json', result['outputPath']],
                                 capture_output=True, check=True, timeout=10)
        self.assertEqual(int(json.loads(counted.stdout)['streams'][0]['nb_read_frames']), 45)

    def test_crossfade_blends_both_audio_tracks(self):
        import array
        import math
        source = self.root / 'blue-tone.mp4'
        subprocess.run([self.ffmpeg, '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i',
                        'color=c=blue:s=160x90:r=30:d=2', '-f', 'lavfi', '-i',
                        'sine=frequency=880:sample_rate=48000:duration=2', '-c:v', 'libx264',
                        '-pix_fmt', 'yuv420p', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709',
                        '-c:a', 'aac', '-t', '2', '-y', str(source)], check=True, capture_output=True, timeout=15)
        req = self.fade_request('audio-fade.mp4')
        asset = req['document']['assets'][1]
        asset['sha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
        req['assets'][asset['versionId']] = str(source)
        completed, events = invoke(req, self.root)
        self.assertEqual(completed.returncode, 0, events)
        result = events[-1]['result']
        data = subprocess.run([self.ffmpeg, '-hide_banner', '-loglevel', 'error', '-i', result['outputPath'],
                               '-map', '0:a:0', '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'],
                              check=True, capture_output=True, timeout=10).stdout
        samples = array.array('f')
        samples.frombytes(data)
        def amplitude(center, frequency):
            start = int((center - .05) * 48000)
            window = samples[start:start + 4800]
            sin_part = sum(x * math.sin(2 * math.pi * frequency * i / 48000) for i, x in enumerate(window))
            cos_part = sum(x * math.cos(2 * math.pi * frequency * i / 48000) for i, x in enumerate(window))
            return 2 * math.hypot(sin_part, cos_part) / len(window)
        first_440, first_880 = amplitude(.25, 440), amplitude(.25, 880)
        mid_440, mid_880 = amplitude(.75, 440), amplitude(.75, 880)
        last_440, last_880 = amplitude(1.25, 440), amplitude(1.25, 880)
        self.assertGreater(first_440, first_880 * 5)
        self.assertGreater(mid_440, first_440 * .25)
        self.assertGreater(mid_880, last_880 * .25)
        self.assertGreater(last_880, last_440 * 5)

    def test_crossfade_rejects_ambiguous_overlap_and_wrong_audio_policy(self):
        for index, mutate in enumerate((
            lambda seq: seq['transitions'][0].update({'durationTick': 80000}),
            lambda seq: seq['transitions'][0].update({'toClipId': uuid(99)}),
            lambda seq: seq['transitions'][0].update({'audioCrossfade': False}),
            lambda seq: seq['transitions'][0].update({'type': 'wipe'}),
            lambda seq: seq['tracks'][0]['clips'][1].update({'startTick': 0}),
        )):
            req = self.fade_request(f'invalid-fade-{index}.mp4')
            mutate(req['document']['sequences'][0])
            completed, events = invoke(req, self.root)
            self.assertNotEqual(completed.returncode, 0, events)
            self.assertEqual(events[-1]['event'], 'failed')
            self.assertFalse(Path(req['outputPath']).exists())

    def test_rejects_unsupported_effect_without_output(self):
        req = self.request('unsupported.mp4')
        req['document']['sequences'][0]['tracks'][0]['clips'][0]['effects'] = [{'type': 'unvalidated'}]
        completed, events = invoke(req, self.root)
        self.assertNotEqual(completed.returncode, 0)
        self.assertEqual(events[-1]['error']['code'], 'UNSUPPORTED_PROJECT')
        self.assertFalse(Path(req['outputPath']).exists())

    def test_rejects_changed_asset_and_preserves_existing_output(self):
        req = self.request('occupied.mp4')
        Path(req['outputPath']).write_bytes(b'keep me')
        completed, events = invoke(req, self.root)
        self.assertNotEqual(completed.returncode, 0)
        self.assertEqual(events[-1]['error']['code'], 'INVALID_PATH')
        self.assertEqual(Path(req['outputPath']).read_bytes(), b'keep me')
        req = self.request('tampered.mp4')
        req['document']['assets'][0]['sha256'] = '0' * 64
        completed, events = invoke(req, self.root)
        self.assertNotEqual(completed.returncode, 0)
        self.assertEqual(events[-1]['error']['code'], 'ASSET_CHECKSUM_MISMATCH')
        self.assertFalse(Path(req['outputPath']).exists())

    def test_fractional_frame_rate_preserves_30_frame_duration(self):
        source = self.root / 'fractional.mp4'
        subprocess.run([self.ffmpeg, '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i',
                        'color=c=green:s=160x90:r=30000/1001:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                        '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709', '-y', str(source)],
                       check=True, capture_output=True, timeout=15)
        complete, probed = invoke({'operation': 'probe', 'inputPath': str(source)}, self.root)
        self.assertEqual(complete.returncode, 0, probed)
        metadata = probed[-1]['result']['video']
        stream_time_base = Fraction(metadata['timeBase'])
        frame_span = Fraction(1001, 1000) / stream_time_base
        self.assertEqual(frame_span.denominator, 1)
        req = self.request('fractional-result.mp4')
        doc = req['document']
        doc['canvas']['frameRate'] = {'num': 30000, 'den': 1001}
        doc['assets'] = doc['assets'][:1]
        doc['assets'][0]['sha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
        doc['sequences'][0]['durationTick'] = 240240
        doc['sequences'][0]['tracks'][0]['clips'] = doc['sequences'][0]['tracks'][0]['clips'][:1]
        clip = doc['sequences'][0]['tracks'][0]['clips'][0]
        clip['durationTick'] = 240240
        clip['sourceRange'] = {'inPts': metadata['startPts'], 'outPts': metadata['startPts'] + frame_span.numerator,
                               'timeBase': {'num': stream_time_base.numerator, 'den': stream_time_base.denominator}}
        req['assets'] = {doc['assets'][0]['versionId']: str(source)}
        if self.caption_renderer:
            self.with_captions(req, 'Fractional caption', start=120120, duration=120120)
        complete, events = invoke(req, self.root)
        self.assertEqual(complete.returncode, 0, events)
        self.assertEqual(events[-1]['result']['video']['frameRate'], '30000/1001')
        self.assertAlmostEqual(events[-1]['result']['durationSeconds'], 1.001, delta=0.04)
        if self.caption_renderer:
            for frame, active in ((14, False), (15, True), (29, True)):
                data = self.frame_rgb(events[-1]['result']['outputPath'], frame)
                white = sum(min(data[i:i + 3]) > 180 for i in range(0, len(data), 3))
                self.assertEqual(white > 100, active)

    def test_cancel_kills_encoder_and_removes_staging(self):
        fake = Path(__file__).resolve().parent / 'fixtures' / 'slow_encoder.sh'
        req = self.request('cancelled.mp4')
        env = {**os.environ, 'MEDIA_WORK_ROOT': str(self.root), 'FFMPEG_PATH': str(fake)}
        process = subprocess.Popen([sys.executable, str(WORKER)], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, text=True, env=env)
        process.stdin.write(json.dumps(req))
        process.stdin.close()
        first = json.loads(process.stdout.readline())
        self.assertEqual(first['phase'], 'preparing')
        process.send_signal(signal.SIGTERM)
        output = process.stdout.read()
        process.wait(timeout=10)
        events = [json.loads(line) for line in output.splitlines()]
        self.assertNotEqual(process.returncode, 0)
        self.assertEqual(events[-1]['error']['code'], 'CANCELLED')
        self.assertFalse(Path(req['outputPath']).exists())
        self.assertFalse(list(self.root.glob('studio-render-*')))
        process.stdout.close()
        process.stderr.close()

    def test_rejects_untagged_source(self):
        source = self.root / 'untagged.mp4'
        subprocess.run([self.ffmpeg, '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i',
                        'color=c=yellow:s=160x90:r=30:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                        '-y', str(source)], check=True, capture_output=True, timeout=15)
        req = self.request('untagged-output.mp4')
        version = req['document']['assets'][0]['versionId']
        req['document']['assets'][0]['sha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
        req['assets'][version] = str(source)
        complete, events = invoke(req, self.root)
        self.assertNotEqual(complete.returncode, 0)
        self.assertEqual(events[-1]['error']['code'], 'UNSUPPORTED_MEDIA')
        self.assertFalse(Path(req['outputPath']).exists())

    def test_nonexecutable_media_tool_reports_unavailable(self):
        fake = self.root / 'not-executable'
        fake.write_text('#!/bin/sh\nexit 0\n')
        fake.chmod(0o644)
        req = self.request('nonexecutable.mp4')
        completed, events = invoke(req, self.root, {'FFMPEG_PATH': str(fake)})
        self.assertNotEqual(completed.returncode, 0)
        self.assertEqual(events[-1]['error']['code'], 'MEDIA_TOOL_UNAVAILABLE')
        self.assertFalse(Path(req['outputPath']).exists())

    def test_timeout_kills_subprocess_and_keeps_partial_unpublished(self):
        fake = Path(__file__).resolve().parent / 'fixtures' / 'slow_encoder.sh'
        req = self.request('timeout.mp4')
        completed, events = invoke(req, self.root, {'FFMPEG_PATH': str(fake), 'MEDIA_TIMEOUT_SECONDS': '1'}, seconds=10)
        self.assertNotEqual(completed.returncode, 0)
        self.assertEqual(events[-1]['error']['code'], 'PROCESS_TIMEOUT')
        self.assertFalse(Path(req['outputPath']).exists())
        self.assertFalse(list(self.root.glob('studio-render-*')))


if __name__ == '__main__':
    unittest.main()
