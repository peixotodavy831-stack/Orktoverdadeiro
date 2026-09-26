import * as React from 'react';
import { AlertCircle, ArrowUp, Bot, CheckCircle2, Gauge, Mic, Paperclip, Sparkles, Square, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Attachment {
  id: string;
  file: File;
  url: string;
  name: string;
}

export interface WiaPromptMeta {
  agent: string;
  effort: string;
  attachments: File[];
  inputMode: 'text' | 'voice' | 'mixed';
}

export interface PromptInputProps {
  onSubmit?: (value: string, meta: WiaPromptMeta) => void | boolean | Promise<void | boolean>;
  placeholder?: string;
  className?: string;
  agents?: string[];
  efforts?: string[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  maxAttachments?: number;
  disabled?: boolean;
  status?: 'idle' | 'sending' | 'sent' | 'error';
}

function MorphingText({ text }: { text: string }) {
  const spanRef = React.useRef<HTMLSpanElement>(null);
  const [width, setWidth] = React.useState<number>();

  React.useEffect(() => {
    setWidth(spanRef.current?.offsetWidth);
  }, [text]);

  return (
    <span className="relative inline-flex overflow-hidden transition-[width] duration-300" style={{ width }}>
      <span ref={spanRef} className="invisible whitespace-nowrap px-0.5">{text}</span>
      <span key={text} className="absolute inset-0 animate-in fade-in zoom-in-95 whitespace-nowrap duration-200">{text}</span>
    </span>
  );
}

function AttachmentPreview({ attachment, onRemove, onOpen }: { attachment: Attachment; onRemove: () => void; onOpen: () => void }) {
  return (
    <div className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800">
      <button type="button" onClick={onOpen} className="h-full w-full" aria-label={`Visualizar ${attachment.name}`}>
        <img src={attachment.url} alt={attachment.name} className="h-full w-full object-cover" />
      </button>
      <button
        type="button"
        onClick={event => { event.stopPropagation(); onRemove(); }}
        className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/80 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
        aria-label={`Remover ${attachment.name}`}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

export const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(function PromptInput(
  {
    onSubmit,
    placeholder = 'Digite uma mensagem...',
    className,
    agents = ['Humano', 'Hunter', 'Orça', 'Recupera', 'Cobra'],
    efforts = ['Rápido', 'Equilibrado', 'Profundo'],
    defaultValue = '',
    value: controlledValue,
    onChange,
    maxAttachments = 6,
    disabled = false,
    status = 'idle',
  },
  forwardedRef,
) {
  const [localValue, setLocalValue] = React.useState(defaultValue);
  const [expanded, setExpanded] = React.useState(false);
  const [agent, setAgent] = React.useState(agents[0]);
  const [agentMenuOpen, setAgentMenuOpen] = React.useState(false);
  const [effortIndex, setEffortIndex] = React.useState(1);
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [preview, setPreview] = React.useState<Attachment | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [usedVoice, setUsedVoice] = React.useState(false);
  const [audioBars, setAudioBars] = React.useState([0.25, 0.5, 0.8, 0.45, 0.3]);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const frameRef = React.useRef<number | null>(null);
  const recognitionRef = React.useRef<any>(null);
  const attachmentsRef = React.useRef<Attachment[]>([]);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : localValue;
  const hasContent = Boolean(value.trim() || attachments.length);

  React.useImperativeHandle(forwardedRef, () => containerRef.current as HTMLDivElement);

  React.useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const setValue = React.useCallback((next: string) => {
    if (!isControlled) setLocalValue(next);
    onChange?.(next);
  }, [isControlled, onChange]);

  const stopRecording = React.useCallback(() => {
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setRecording(false);
    setAudioBars([0.25, 0.5, 0.8, 0.45, 0.3]);
  }, []);

  React.useEffect(() => () => {
    stopRecording();
    attachmentsRef.current.forEach(item => URL.revokeObjectURL(item.url));
  }, [stopRecording]);

  React.useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = '0px';
    element.style.height = `${Math.min(Math.max(element.scrollHeight, 46), 144)}px`;
  }, [value, expanded]);

  const startRecording = async () => {
    setExpanded(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setRecording(true);
      setUsedVoice(true);

      const context = new AudioContext();
      audioContextRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 64;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const updateBars = () => {
        analyser.getByteFrequencyData(data);
        setAudioBars([0, 1, 2, 3, 4].map(index => Math.max(0.12, data[index * 3] / 255)));
        frameRef.current = requestAnimationFrame(updateBars);
      };
      updateBars();

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.continuous = true;
        recognition.interimResults = true;
        const base = value;
        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results).map((result: any) => result[0].transcript).join(' ');
          setValue(`${base}${base ? ' ' : ''}${transcript}`.trim());
        };
        recognition.onend = stopRecording;
        recognition.onerror = stopRecording;
        recognitionRef.current = recognition;
        recognition.start();
      }
    } catch {
      stopRecording();
    }
  };

  const submit = async () => {
    if (!hasContent || disabled || status === 'sending') return;
    const result = await onSubmit?.(value.trim(), {
      agent,
      effort: efforts[effortIndex],
      attachments: attachments.map(item => item.file),
      inputMode: usedVoice ? (attachments.length ? 'mixed' : 'voice') : 'text',
    });
    if (result === false) return;
    attachments.forEach(item => URL.revokeObjectURL(item.url));
    setAttachments([]);
    setValue('');
    setUsedVoice(false);
    setExpanded(false);
    setAgentMenuOpen(false);
  };

  const addFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter(file => file.type.startsWith('image/'));
    const available = Math.max(0, maxAttachments - attachments.length);
    const next = files.slice(0, available).map(file => ({
      id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      url: URL.createObjectURL(file),
      name: file.name,
    }));
    setAttachments(current => [...current, ...next]);
    setExpanded(true);
    event.target.value = '';
  };

  return (
    <>
      <div
        ref={containerRef}
        className={cn('relative w-full transition-[max-width] duration-300', expanded ? 'max-w-2xl' : 'max-w-lg', className)}
        onBlur={event => {
          if (containerRef.current?.contains(event.relatedTarget as Node)) return;
          if (!hasContent && !recording) setExpanded(false);
          setAgentMenuOpen(false);
        }}
      >
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={addFiles} />

        {attachments.length > 0 && (
          <div className="mx-4 flex gap-2 overflow-x-auto rounded-t-xl border border-b-0 border-zinc-700 bg-zinc-900 px-3 pb-3 pt-3">
            {attachments.map(item => (
              <AttachmentPreview
                key={item.id}
                attachment={item}
                onOpen={() => setPreview(item)}
                onRemove={() => {
                  URL.revokeObjectURL(item.url);
                  setAttachments(current => current.filter(entry => entry.id !== item.id));
                }}
              />
            ))}
          </div>
        )}

        <div className={cn(
          'relative overflow-visible border border-zinc-700 bg-[#151618] shadow-lg shadow-black/20 transition-all duration-300 focus-within:border-[#FF8A00]/60',
          expanded ? 'rounded-2xl' : 'rounded-full',
        )}>
          {!expanded ? (
            <button type="button" onClick={() => { setExpanded(true); requestAnimationFrame(() => textareaRef.current?.focus()); }} className="flex h-12 w-full items-center gap-3 px-3 text-left text-sm text-zinc-500">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF8A00]/10 text-[#FF8A00]">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate">{placeholder}</span>
              <span className="rounded-full border border-[#FF8A00]/20 bg-[#FF8A00]/5 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#FF8A00]">WIA</span>
            </button>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 px-4 pt-3 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                <Sparkles className="h-3.5 w-3.5 text-[#FF8A00]" />
                <span>WIA ativa</span>
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                <span className="font-medium normal-case tracking-normal text-zinc-600">assistência com controle humano</span>
              </div>
              <textarea
                ref={textareaRef}
                value={value}
                onChange={event => setValue(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(); }
                  if (event.key === 'Escape' && !hasContent) setExpanded(false);
                }}
                placeholder={placeholder}
                disabled={disabled || recording}
                rows={1}
                className="block min-h-20 w-full resize-none bg-transparent px-4 pb-16 pt-2 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-500 disabled:opacity-60"
                aria-label="Mensagem para a WIA"
              />
            </>
          )}

          {expanded && (
            <div className="absolute bottom-2 left-2 right-2 flex h-11 items-center gap-1">
              <div className="relative">
                <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => setAgentMenuOpen(open => !open)} className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white">
                  <Bot className="h-3.5 w-3.5 text-[#FF8A00]" /> <MorphingText text={agent} />
                </button>
                {agentMenuOpen && (
                  <div className="absolute bottom-10 left-0 z-50 w-40 rounded-xl border border-zinc-700 bg-[#111214] p-1.5 shadow-2xl">
                    {agents.map(item => (
                      <button key={item} type="button" onMouseDown={event => event.preventDefault()} onClick={() => { setAgent(item); setAgentMenuOpen(false); }} className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors', item === agent ? 'bg-[#FF8A00]/10 text-[#FF8A00]' : 'text-zinc-400 hover:bg-white/5 hover:text-white')}>
                        <Bot className="h-3.5 w-3.5" /> {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => setEffortIndex(index => (index + 1) % efforts.length)} className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">
                <Gauge className="h-3.5 w-3.5" /> <MorphingText text={efforts[effortIndex]} />
              </button>

              <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => fileInputRef.current?.click()} disabled={attachments.length >= maxAttachments} className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30" aria-label="Adicionar imagem">
                <Paperclip className="h-4 w-4" />
              </button>
            </div>
          )}

          {recording && (
            <div className="absolute bottom-4 right-14 flex h-6 items-center gap-1" aria-label="Gravando áudio">
              {audioBars.map((bar, index) => <span key={index} className="w-1 rounded-full bg-[#FF8A00] transition-[height]" style={{ height: `${Math.max(4, bar * 22)}px` }} />)}
            </div>
          )}

          <button
            type="button"
            onClick={() => recording ? stopRecording() : hasContent ? void submit() : void startRecording()}
            disabled={disabled || status === 'sending'}
            className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#FF8A00] text-black transition-colors hover:bg-[#ff9d2e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF8A00] disabled:bg-zinc-700 disabled:text-zinc-500"
            aria-label={recording ? 'Parar gravação' : hasContent ? 'Enviar mensagem' : 'Usar voz'}
          >
            {status === 'sending' ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-500 border-t-black" /> : status === 'sent' ? <CheckCircle2 className="h-4 w-4" /> : status === 'error' ? <AlertCircle className="h-4 w-4" /> : recording ? <Square className="h-3 w-3 fill-current" /> : hasContent ? <ArrowUp className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setPreview(null)}>
          <img src={preview.url} alt={preview.name} className="max-h-[80vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl" onClick={event => event.stopPropagation()} />
          <button type="button" onClick={() => setPreview(null)} className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-zinc-300" aria-label="Fechar visualização"><X className="h-4 w-4" /></button>
        </div>
      )}
    </>
  );
});

PromptInput.displayName = 'PromptInput';
