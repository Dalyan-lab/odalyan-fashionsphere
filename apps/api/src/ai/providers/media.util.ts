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
 * Ré-encode une vidéo au format qu'attendent TikTok, Instagram et Facebook :
 * MP4 / H.264 / AAC, 1080 px de large au maximum, 30 images par seconde.
 *
 * Deux bénéfices : les formats exotiques (.avi, .mkv, .wmv, exports 4K…) deviennent
 * publiables, et le poids s'effondre — un export téléphone de 50 Mo tombe couramment
 * sous 10 Mo sans différence visible sur un écran de téléphone.
 *
 * `-movflags +faststart` place l'index en tête du fichier : indispensable pour que
 * les réseaux puissent lire la vidéo en streaming sans la télécharger entièrement.
 */
export async function normalizeVideoForSocial(input: Buffer, originalName = 'video'): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'odl-conv-'));
  // L'extension d'origine aide ffmpeg à choisir le bon démultiplexeur.
  const ext = (originalName.split('.').pop() ?? 'mp4').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'mp4';
  const src = join(dir, `in.${ext}`);
  const out = join(dir, 'out.mp4');
  try {
    await writeFile(src, input);
    await runFfmpeg([
      '-y',
      '-i', src,
      // Largeur ramenée à 1080 px maximum ; -2 garde le ratio avec une hauteur paire.
      '-vf', "scale='min(1080,iw)':-2,fps=30",
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '26',
      '-profile:v', 'high',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      out,
    ]);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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
