'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Mic, Send, Square, Volume2, VolumeX, Headphones, Sparkles } from 'lucide-react';

// Same tokens as AdminShell
const INK = '#172A29';
const INK_SOFT = '#6B7C7A';
const TEAL = '#064E4A';
const GOLD = '#C49A45';
const WASH = '#F5EFE0';
const LINE = '#E7DCC5';
const PAPER = '#FFFDF5';

const LANGS = [
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'हिन्दी' },
  { code: 'ml-IN', label: 'മലയാളം' },
  { code: 'ta-IN', label: 'தமிழ்' },
];

const SUGGESTIONS = [
  'How were sales last week vs the week before?',
  'Which sizes are about to sell out?',
  'Do we have a backlog of unshipped orders?',
  'Is COD hurting us? Check returns and cancellations.',
];

// Markdown styling for assistant replies
const md = {
  p: ({ node, ...p }) => <p className="mb-2 last:mb-0" {...p} />,
  ul: ({ node, ...p }) => <ul className="list-disc pl-5 mb-2 space-y-0.5" {...p} />,
  ol: ({ node, ...p }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5" {...p} />,
  strong: ({ node, ...p }) => <strong style={{ color: TEAL }} {...p} />,
  table: ({ node, ...p }) => (
    <div className="overflow-x-auto my-2">
      <table className="text-xs border-collapse" {...p} />
    </div>
  ),
  th: ({ node, ...p }) => (
    <th className="text-left px-2 py-1 font-medium" style={{ borderBottom: `1px solid ${LINE}` }} {...p} />
  ),
  td: ({ node, ...p }) => <td className="px-2 py-1" style={{ borderBottom: `1px solid ${LINE}` }} {...p} />,
};

// ---------- speech helpers ----------
function cleanForSpeech(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/₹\s?([\d,.]+)/g, '$1 rupees')
    .replace(/[*_`#>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Chrome cuts off long utterances, so speak in sentence-sized chunks.
function chunkText(text, max = 180) {
  const sentences = text.match(/[^.!?।]+[.!?।]*\s*/g) || [text];
  const out = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + s).length > max && cur) {
      out.push(cur);
      cur = s;
    } else cur += s;
  }
  if (cur) out.push(cur);
  return out;
}

function Chip({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
      style={{
        borderRadius: 4,
        border: `1px solid ${active ? TEAL : LINE}`,
        background: active ? TEAL : PAPER,
        color: active ? PAPER : INK_SOFT,
      }}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

export default function CofounderPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [lang, setLang] = useState('ta-IN');
  const [micSupported, setMicSupported] = useState(false);
  const [notice, setNotice] = useState('');

  // Refs hold the latest values for callbacks fired by the speech APIs.
  const messagesRef = useRef([]);
  const loadingRef = useRef(false);
  const recogRef = useRef(null);
  const sendRef = useRef(() => {});
  const bottomRef = useRef(null);
  const langRef = useRef(lang);
  const speakRef = useRef(speakReplies);
  const handsFreeRef = useRef(handsFree);
  langRef.current = lang;
  speakRef.current = speakReplies;
  handsFreeRef.current = handsFree;

  useEffect(() => {
    setMicSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
    const synth = window.speechSynthesis;
    const load = () => synth?.getVoices();
    load();
    synth?.addEventListener?.('voiceschanged', load);
    return () => {
      synth?.removeEventListener?.('voiceschanged', load);
      synth?.cancel();
      if (recogRef.current) {
        recogRef.current._cancelled = true;
        recogRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  // ---------- text to speech ----------
  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text, onDone) => {
    const synth = window.speechSynthesis;
    if (!synth) return onDone?.();
    synth.cancel();
    const parts = chunkText(cleanForSpeech(text));
    if (!parts.length) return onDone?.();

    const code = langRef.current;
    const voices = synth.getVoices();
    const voice =
      voices.find((v) => v.lang === code) ||
      voices.find((v) => v.lang.startsWith(code.split('-')[0]));

    setSpeaking(true);
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = code;
      if (voice) u.voice = voice;
      if (i === parts.length - 1) {
        u.onend = () => {
          setSpeaking(false);
          onDone?.();
        };
        u.onerror = (e) => {
          setSpeaking(false);
          // "interrupted"/"canceled" = the user pressed stop; don't re-open the mic
          if (e.error !== 'interrupted' && e.error !== 'canceled') onDone?.();
        };
      }
      synth.speak(u);
    });
  }, []);

  // ---------- speech to text ----------
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || loadingRef.current) return;

    window.speechSynthesis?.cancel();
    setSpeaking(false);
    if (recogRef.current) {
      recogRef.current._cancelled = true;
      recogRef.current.abort();
    }

    const r = new SR();
    r.lang = langRef.current;
    r.interimResults = true;
    r.continuous = false;
    let finalText = '';
    let interimText = '';

    r.onstart = () => {
      setListening(true);
      setNotice('');
    };
    r.onresult = (ev) => {
      interimText = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalText += t;
        else interimText += t;
      }
      setInput((finalText + interimText).trim());
    };
    r.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        setNotice('Microphone blocked. Allow mic access in your browser (the site must be on HTTPS).');
        handsFreeRef.current = false;
        setHandsFree(false);
      } else if (ev.error !== 'no-speech' && ev.error !== 'aborted') {
        setNotice(`Voice input error: ${ev.error}`);
      }
    };
    r.onend = () => {
      if (r._cancelled) return;
      setListening(false);
      recogRef.current = null;
      const text = (finalText || interimText).trim();
      if (text) {
        sendRef.current(text);
      } else if (handsFreeRef.current) {
        // Nothing heard: pause hands-free instead of looping on an open mic.
        handsFreeRef.current = false;
        setHandsFree(false);
        setNotice("Hands-free paused: I didn't hear anything.");
      }
    };

    recogRef.current = r;
    try {
      r.start();
    } catch {
      /* already started */
    }
  }, []);

  const stopListening = useCallback(() => {
    const r = recogRef.current;
    if (r) {
      r._cancelled = true;
      r.abort();
    }
    recogRef.current = null;
    setListening(false);
  }, []);

  // ---------- send to the agent ----------
  const send = useCallback(
    async (raw) => {
      const text = (raw || '').trim();
      if (!text || loadingRef.current) return;

      window.speechSynthesis?.cancel();
      setSpeaking(false);

      const next = [...messagesRef.current, { role: 'user', content: text }];
      messagesRef.current = next;
      setMessages(next);
      setInput('');
      setNotice('');
      loadingRef.current = true;
      setLoading(true);

      try {
        const res = await fetch('/api/cofounder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: next, voice: speakRef.current, lang: langRef.current }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.reply) {
          throw new Error(
            res.status === 401 || res.status === 403
              ? 'Your admin session expired. Please log in again.'
              : data.error || 'Something went wrong. Please try again.'
          );
        }

        const withReply = [...messagesRef.current, { role: 'assistant', content: data.reply }];
        messagesRef.current = withReply;
        setMessages(withReply);

        if (speakRef.current) {
          speak(data.reply, () => {
            if (handsFreeRef.current) startListening();
          });
        }
      } catch (err) {
        setNotice(err.message);
        handsFreeRef.current = false;
        setHandsFree(false);
        // Remove the failed question so a retry keeps the conversation valid.
        messagesRef.current = messagesRef.current.slice(0, -1);
        setMessages(messagesRef.current);
        setInput(text);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [speak, startListening]
  );
  sendRef.current = send;

  // ---------- UI handlers ----------
  function onMicClick() {
    if (listening) recogRef.current?.stop(); // stop and send what was heard
    else startListening();
  }

  function toggleSpeak() {
    if (speakReplies) {
      stopSpeaking();
      if (handsFree) {
        handsFreeRef.current = false;
        setHandsFree(false);
        stopListening();
      }
    }
    setSpeakReplies(!speakReplies);
  }

  function toggleHandsFree() {
    if (handsFree) {
      handsFreeRef.current = false;
      setHandsFree(false);
      stopListening();
      stopSpeaking();
    } else {
      handsFreeRef.current = true;
      speakRef.current = true;
      setHandsFree(true);
      setSpeakReplies(true);
      startListening();
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const status = listening ? 'Listening…' : loading ? 'Thinking…' : speaking ? 'Speaking…' : '';

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 7rem)', minHeight: 420 }}>
      {/* Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 pb-3"
        style={{ borderBottom: `1px solid ${LINE}` }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={18} style={{ color: GOLD }} />
          <h1 className="text-lg font-medium" style={{ color: TEAL }}>
            AI Cofounder
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            aria-label="Voice language"
            className="px-2 py-1.5 text-xs outline-none"
            style={{ border: `1px solid ${LINE}`, borderRadius: 4, background: PAPER, color: INK }}
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <Chip
            active={speakReplies}
            onClick={toggleSpeak}
            icon={speakReplies ? Volume2 : VolumeX}
            label="Speak replies"
          />
          {micSupported && (
            <Chip active={handsFree} onClick={toggleHandsFree} icon={Headphones} label="Hands-free" />
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.length === 0 && (
          <div className="pt-6 text-center">
            <p className="text-sm mb-4" style={{ color: INK_SOFT }}>
              Ask about sales, stock, orders, coupons or reviews. Type, or tap the mic and speak.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="px-3 py-2 text-xs text-left"
                  style={{ border: `1px solid ${LINE}`, borderRadius: 4, background: WASH, color: INK }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          const mine = m.role === 'user';
          return (
            <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[88%] px-3.5 py-2.5 text-sm"
                style={{
                  borderRadius: 6,
                  background: mine ? TEAL : '#fff',
                  color: mine ? PAPER : INK,
                  border: mine ? 'none' : `1px solid ${LINE}`,
                }}
              >
                {mine ? (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                ) : (
                  <>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
                      {m.content}
                    </ReactMarkdown>
                    <button
                      type="button"
                      onClick={() => speak(m.content)}
                      aria-label="Read this aloud"
                      className="mt-1 flex items-center gap-1 text-[11px]"
                      style={{ color: INK_SOFT }}
                    >
                      <Volume2 size={12} /> Listen
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div
              className="px-3.5 py-2.5 text-sm animate-pulse"
              style={{ borderRadius: 6, background: '#fff', border: `1px solid ${LINE}`, color: INK_SOFT }}
            >
              Checking your store data…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-3" style={{ borderTop: `1px solid ${LINE}` }}>
        {(notice || status) && (
          <div className="text-xs mb-2" style={{ color: notice ? '#A33' : INK_SOFT }}>
            {notice || status}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={listening ? 'Listening…' : 'Ask about sales, stock, orders…'}
            className="flex-1 resize-none px-3 py-2.5 text-base sm:text-sm outline-none"
            style={{ border: `1px solid ${LINE}`, borderRadius: 4, background: '#fff', color: INK, maxHeight: 120 }}
          />

          {speaking && (
            <button
              type="button"
              onClick={stopSpeaking}
              aria-label="Stop speaking"
              className="p-2.5"
              style={{ borderRadius: 4, border: `1px solid ${LINE}`, background: PAPER, color: INK }}
            >
              <Square size={18} />
            </button>
          )}

          {micSupported && (
            <button
              type="button"
              onClick={onMicClick}
              disabled={loading}
              aria-label={listening ? 'Stop listening' : 'Start voice input'}
              className={`p-2.5 ${listening ? 'animate-pulse' : ''}`}
              style={{
                borderRadius: 4,
                border: `1px solid ${listening ? GOLD : LINE}`,
                background: listening ? GOLD : PAPER,
                color: listening ? INK : TEAL,
                opacity: loading ? 0.5 : 1,
              }}
            >
              <Mic size={18} />
            </button>
          )}

          <button
            type="button"
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            aria-label="Send"
            className="p-2.5"
            style={{
              borderRadius: 4,
              background: TEAL,
              color: PAPER,
              opacity: loading || !input.trim() ? 0.5 : 1,
            }}
          >
            <Send size={18} />
          </button>
        </div>
        {!micSupported && (
          <p className="text-[11px] mt-2" style={{ color: INK_SOFT }}>
            Voice input isn't supported in this browser. Use Chrome, Edge or Safari for the mic.
          </p>
        )}
      </div>
    </div>
  );
}