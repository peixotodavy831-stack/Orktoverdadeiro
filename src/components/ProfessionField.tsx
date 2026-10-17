import { useEffect, useRef, useState } from 'react';

const professions = [
  ['Oficina', 'Oficina Mecânica'],
  ['Serviços Gerais', 'Serviços Gerais'],
  ['Advogado', 'Advogado'],
  ['Arquiteto', 'Arquiteto'],
  ['Consultor', 'Consultor'],
  ['Designer', 'Designer'],
  ['Eletricista', 'Eletricista'],
  ['Manutenção', 'Manutenção'],
  ['Marcenaria', 'Marcenaria'],
  ['Construção', 'Construção & Reformas'],
] as const;

const otherProfession = '__other__';
const controlClass = 'w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus-visible:outline-2 focus-visible:outline-orange-500 focus-visible:outline-offset-2';
const labelClass = 'block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1';

export default function ProfessionField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [isCustom, setIsCustom] = useState(() => !professions.some(([profession]) => profession === value));
  const lastValue = useRef(value);

  useEffect(() => {
    // Profile hydration may replace the initial value. Typing a known word in
    // a longer custom profession must not hide the field mid-entry.
    if (value !== lastValue.current) setIsCustom(!professions.some(([profession]) => profession === value));
    lastValue.current = value;
  }, [value]);

  const updateValue = (nextValue: string) => {
    lastValue.current = nextValue;
    onChange(nextValue);
  };

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="onboard-profession" className={labelClass}>Sua profissão / atuação *</label>
        <select id="onboard-profession" value={isCustom ? otherProfession : value} onChange={event => {
          const custom = event.target.value === otherProfession;
          setIsCustom(custom);
          updateValue(custom ? '' : event.target.value);
        }} className={controlClass} required>
          {professions.map(([profession, label]) => <option key={profession} value={profession}>{label}</option>)}
          <option value={otherProfession}>Outros</option>
        </select>
      </div>
      {isCustom && <div>
        <label htmlFor="onboard-custom-profession" className={labelClass}>Qual é sua profissão ou atuação? *</label>
        <input id="onboard-custom-profession" name="customProfession" type="text" value={value} onChange={event => updateValue(event.target.value)} maxLength={100} required placeholder="Ex.: Fotógrafo" className={controlClass} />
      </div>}
    </div>
  );
}
