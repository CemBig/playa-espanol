// Pronunciation coach: native TTS playback + speech-recognition scoring, with a
// record-and-compare fallback for browsers where SpeechRecognition is unavailable or
// refuses to work (notably Safari/iOS, where support varies by version).

let cachedVoices = [];
let unlocked = false;

function refreshVoices() {
  if (!("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices();
  if (voices.length) cachedVoices = voices;
}

// Voices populate asynchronously; grab them at boot so speak() can pick a Spanish one
// on the very first call instead of only after the settings page has been opened.
export function initSpeech() {
  if (!("speechSynthesis" in window)) return;
  refreshVoices();
  speechSynthesis.onvoiceschanged = refreshVoices;

  // iOS/Safari only allow speech synthesis that originates from a user gesture. Speaking a
  // silent utterance on the first tap unlocks it for later programmatic calls.
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    try {
      const u = new SpeechSynthesisUtterance("");
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
    refreshVoices();
  };
  document.addEventListener("touchend", unlock, { once: true, passive: true });
  document.addEventListener("click", unlock, { once: true });
}

export async function getSpanishVoices() {
  refreshVoices();
  return cachedVoices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("es"));
}

export function speak(text, { rate = 0.85, voiceURI = null } = {}) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve(false);
      return;
    }
    try {
      speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "es-ES";
      utter.rate = rate;
      const chosen =
        cachedVoices.find((v) => v.voiceURI === voiceURI) ||
        cachedVoices.find((v) => v.lang && v.lang.toLowerCase().startsWith("es"));
      if (chosen) utter.voice = chosen;
      utter.onend = () => resolve(true);
      utter.onerror = () => resolve(false);
      speechSynthesis.speak(utter);
    } catch {
      resolve(false);
    }
  });
}

const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition || null;

export function supportsRecognition() {
  return !!SpeechRecognitionImpl;
}

export function supportsRecording() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

// Errors that mean "this browser will never do recognition" — the caller should switch
// permanently to the shadowing fallback rather than asking the user to try again.
export const FATAL_RECOGNITION_ERRORS = new Set(["unsupported", "service-not-allowed", "language-not-supported"]);

// Listens once and resolves with the recognized transcript, or rejects with an Error whose
// message is one of: unsupported, not-allowed, no-speech, network, timeout, aborted...
export function listenOnce({ lang = "es-ES", timeoutMs = 7000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!SpeechRecognitionImpl) {
      reject(new Error("unsupported"));
      return;
    }
    const rec = new SpeechRecognitionImpl();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    let settled = false;

    const done = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
      fn(arg);
    };

    const timer = setTimeout(() => done(reject, new Error("timeout")), timeoutMs);

    rec.onresult = (event) => done(resolve, event.results[0][0].transcript);
    rec.onerror = (event) => done(reject, new Error(event.error || "recognition-error"));
    rec.onend = () => done(reject, new Error("no-speech"));

    try {
      rec.start();
    } catch (e) {
      done(reject, e instanceof Error ? e : new Error("start-failed"));
    }
  });
}

// Fallback for browsers without usable SpeechRecognition: record a short clip the
// user can play back next to the model audio and self-assess (shadowing technique).
export async function recordClip(maxMs = 4000) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let recorder;
  try {
    recorder = new MediaRecorder(stream);
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    throw e;
  }
  const chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const stopped = new Promise((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || "audio/webm" })));
    };
  });

  recorder.start();
  const stopTimer = setTimeout(() => recorder.state !== "inactive" && recorder.stop(), maxMs);

  return {
    stopNow: () => {
      clearTimeout(stopTimer);
      if (recorder.state !== "inactive") recorder.stop();
    },
    result: stopped
  };
}
