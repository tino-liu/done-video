# Voice

`npm run voice` speaks each line in `scripts/scenes.mjs` and writes `src/timeline.json`. Clips are cached by a hash of the voice and the text, so a re-run only regenerates lines that changed. All the clips are in `public/audio/voice/`.

## Choosing a voice

- **ElevenLabs** (the real cut). Put `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in `.env`. The user pastes them in themselves. The voice can be the presenter's own clone or a stock voice from the ElevenLabs library. ElevenLabs returns timings for every character, so captions and cues land on the exact word.
- **Placeholder** (no `.env`, or `--placeholder`). This is the computer's own voice: macOS `say` (`voice.placeholder` in `video.config.json`), Windows SAPI, or `espeak-ng` on Linux. The word timings are estimated from word length, so cues drift by a few frames. It is good enough for building the scenes and checking timing before spending credits.

The voice settings are in `video.config.json → voice.settings`. A stability of 0.35, a style of 0.35 and a speed of 1.04 give a lively read for a demo. Raise the stability for a calmer one. Changing the settings regenerates every clip.

## Professional Voice Clones

A Professional Voice Clone (PVC) only speaks once it has finished training on the model in `voice.model`. Until then, `npm run voice` stops with a message saying so.

- **Adding samples to a trained PVC wipes its training and its verification.** Generation then fails with `voice_not_fine_tuned`. Calling `POST /v1/voices/pvc/{id}/train` through the API returns `ok` but starts nothing. The owner has to verify the voice again (read the captcha aloud) and press Train in the ElevenLabs app.
- `node scripts/wait-for-voice.mjs` checks every five minutes and exits once training is done. Training takes about 25 minutes for half an hour of samples.
- The clip cache key includes a fingerprint of the voice's samples, so a retrained voice regenerates every clip.

## Pronunciation

Put product names, acronyms and anything else the voice gets wrong in `video.config.json → voice.sayAs`, for example `{ "written": "CSV", "spoken": "C-S-V" }` or `{ "written": "Nginx", "spoken": "engine X" }`. The voice says the spoken form, while the captions and cues keep the written one.

## Fixing a take

Listen to every new clip in `public/audio/voice/` before rendering, and have the user listen too. ElevenLabs varies from take to take. When one comes out wrong (a misread word, odd stress, flat energy), `npm run voice -- --reroll=title,outro` generates just those scenes again.

Speech-to-text helps catch misread words, but it can't judge pronunciation. It hears a mispronounced brand name as correct and a good take as wrong. To choose between takes of a name, have someone listen, or compare the word's sound against takes the user has already approved.

ElevenLabs sometimes adds a stray breath or "sk" after a clip's last word. `npm run mix` cuts these automatically. If one gets through, `npm run mix -- --stems` writes the voice, the sound effects and the music to separate files for checking.

## Music

By default, `npm run mix` synthesizes a quiet pad that ducks under the voice. `node scripts/music.mjs` composes a track with ElevenLabs Music (the plan needs Music access) into `public/audio/music.mp3`, which replaces the pad on the next mix. Any licensed track saved at that path works too.
