import { useState } from 'react';
import { X, Briefcase, Users, LayoutGrid, ChevronRight, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const STEPS = [
  {
    Icon: Briefcase,
    title: 'Crie seu primeiro projeto',
    description:
      'Projetos organizam seu trabalho em bases de dados. Cada base pode ter múltiplos cards com links, documentos, formulários e muito mais.',
  },
  {
    Icon: LayoutGrid,
    title: 'Adicione cards ao projeto',
    description:
      'Cards são atalhos para recursos. Adicione links externos, pastas de documentos, formulários personalizados, relatórios e dashboards.',
  },
  {
    Icon: Users,
    title: 'Gerencie sua equipe',
    description:
      'No painel Admin ou Gerência, adicione usuários, atribua cargos e defina quais projetos cada membro pode acessar.',
  },
];

const KEY = 'norahub_onboarding_v1';

export function Onboarding({ onCreateProject }) {
  const { userProfile } = useAuth();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(KEY) === 'true'
  );
  const [step, setStep] = useState(0);

  if (dismissed) return null;

  const primeiroNome = userProfile?.nome?.split(' ')[0] ?? 'Usuário';
  const { Icon, title, description } = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const dismiss = () => {
    localStorage.setItem(KEY, 'true');
    setDismissed(true);
  };

  const next = () => {
    if (isLast) { dismiss(); onCreateProject?.(); }
    else setStep(s => s + 1);
  };

  return (
    <div className="mb-6 relative bg-gradient-to-r from-[#57B952]/10 via-transparent to-blue-500/10 border border-[#57B952]/20 rounded-2xl p-5 overflow-hidden">
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-[#57B952]/5 rounded-full pointer-events-none" />
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/10 transition-colors"
        title="Dispensar"
      >
        <X size={14} />
      </button>

      <div className="flex items-start gap-4 pr-8">
        <div className="w-11 h-11 rounded-xl bg-[#57B952]/20 border border-[#57B952]/30 flex items-center justify-center flex-shrink-0">
          <Icon size={20} className="text-[#57B952]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-[#57B952] font-semibold uppercase tracking-widest mb-1">
            Bem-vindo, {primeiroNome} · Passo {step + 1}/{STEPS.length}
          </p>
          <h3 className="font-bold text-white text-sm mb-1">{title}</h3>
          <p className="text-xs text-gray-400 mb-3 leading-relaxed">{description}</p>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all ${
                    i < step
                      ? 'w-4 bg-[#57B952]'
                      : i === step
                      ? 'w-6 bg-[#57B952]'
                      : 'w-4 bg-white/20'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="flex items-center gap-1 text-xs font-semibold text-[#57B952] hover:text-green-300 transition-colors"
            >
              {isLast ? (
                <><Check size={13} /> Criar primeiro projeto</>
              ) : (
                <>Próximo <ChevronRight size={13} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
