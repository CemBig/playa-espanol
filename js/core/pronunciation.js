// Pronunciation coach: native TTS playback + speech-recognition scoring, with a
// record-and-compare fallback for browsers where SpeechRecognition is unreliable
// (notably Safari/iOS, where support is inconsistent across versions).

let cachedVoices = [];
function loadVoices() {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    if (voices.length) {
      cachedVoices = voices;
      resolve(voices);
      return;
    }
    speechSynthesis.onvoiceschanged = () => {
      cachedVoices = speechSynthesis.getVoices();
      resolve(cachedVoices);
    };
  });
}

export async function getSpanishVoices() {
  const voices = cachedVoices.length ? cachedVoices : await loadVoices();
  return voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("es"));
}

export function speak(text, { rate = 0.85, voiceURI = null } = {}) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve(false);
      return;
    }
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "es-ES";
    utter.rate = rate;
    const voice = cachedVoices.find((v) => v.voiceURI === voiceURI);
    if (voice) utter.voice = voice;
    utter.onend = () => resolve(true);
    utter.onerror = () => resolve(false);
    speechSynthesis.speak(utter);
  });
}

const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition || null;

export function supportsRecognition() {
  return !!SpeechRecognitionImpl;
}

export function supportsRecording() {
  return !!(navigator.mediaDevices && window.MediaRecorder);
}

// Listens once and resolves with the recognized transcript, or rejects with an Error.
// Common rejection reasons: "not-allowed" (mic permission denied), "no-speech", "network".
export function listenOnce({ lang = "es-ES", timeoutMs = 6000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!SpeechRecognitionImpl) {
      reject(new Error("unsupported"));
      return;
    }
    const rec = new SpeechRecognitionImpl();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      rec.stop();
      reject(new Error("timeout"));
    }, timeoutMs);

    rec.onresult = (event) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(event.results[0][0].transcript);
    };
    rec.onerror = (event) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(event.error || "recognition-error"));
    };
    rec.onend = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error("no-speech"));
    };
    try {
      rec.start();
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

// Fallback for browsers without usable SpeechRecognition: record a short clip the
// user can play back next to the model audio and self-assess (shadowing technique).
export async function recordClip(maxMs = 4000) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);

  const stopped = new Promise((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: "audio/webm" });
      resolve(URL.createObjectURL(blob));
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
