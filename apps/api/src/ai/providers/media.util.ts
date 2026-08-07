import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Téléchargement échoué (${res.status}) ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    ff.stderr.on('data', (d) => (stderr += d.toString()));
    ff.on('error', (err) => reject(err));
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${stderr.slice(-400)}`))));
  });
}

/**
 * Colle une piste audio (voix off / musique) sur une vidéo. La vidéo est bouclée
 * pour couvrir toute la durée de l'audio (`-stream_loop -1` + `-shortest`).
 * Renvoie le MP4 monté (buffer). `musicUrl` optionnel = fond sonore atténué.
 */
export async function muxAudioOnVideo(
  videoUrl: string,
  voiceUrl: string,
  musicUrl?: string,
): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'odl-mux-'));
  const vin = join(dir, 'v.mp4');
  const ain = join(dir, `voice-${randomUUID()}.audio`);
  const min = join(dir, `music-${randomUUID()}.audio`);
  const out = join(dir, 'out.mp4');
  try {
    await writeFile(vin, await download(videoUrl));
    await writeFile(ain, await download(voiceUrl));

    if (musicUrl) {
      await writeFile(min, await download(musicUrl));
      // Voix à plein volume + musique atténuée (0.25), mixées ensemble.
      await runFfmpeg([
        '-y',
        '-stream_loop', '-1', '-i', vin,
        '-i', ain,
        '-stream_loop', '-1', '-i', min,
        '-filter_complex', '[2:a]volume=0.25[bg];[1:a][bg]amix=inputs=2:duration=first:dropout_transition=0[aout]',
        '-map', '0:v:0', '-map', '[aout]',
        '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-shortest',
        out,
      ]);
    } else {
      await runFfmpeg([
        '-y',
        '-stream_loop', '-1', '-i', vin,
        '-i', ain,
        '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-shortest',
        out,
      ]);
    }
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
