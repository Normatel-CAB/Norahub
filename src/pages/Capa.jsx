import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Building2, ChevronRight } from 'lucide-react';

const PULL = 6; // deslocamento máximo do botão magnético, em px

function useMagneticGlow(comEfeito) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !comEfeito) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    let agendado = false;
    let mx = 0, my = 0, dx = 0, dy = 0;

    const pintar = () => {
      agendado = false;
      el.style.setProperty('--gx', `${mx}px`);
      el.style.setProperty('--gy', `${my}px`);
      el.style.setProperty('--dx', `${dx}px`);
      el.style.setProperty('--dy', `${dy}px`);
    };
    const agendar = () => {
      if (!agendado) { agendado = true; requestAnimationFrame(pintar); }
    };
    const aoMover = (e) => {
      const r = el.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      dx = ((mx - r.width / 2) / (r.width / 2)) * PULL;
      dy = ((my - r.height / 2) / (r.height / 2)) * PULL;
      agendar();
    };
    const aoEntrar = () => el.style.setProperty('--glow', '1');
    const aoSair = () => {
      el.style.setProperty('--glow', '0');
      dx = 0; dy = 0;
      agendar();
    };

    el.addEventListener('mousemove', aoMover, { passive: true });
    el.addEventListener('mouseenter', aoEntrar);
    el.addEventListener('mouseleave', aoSair);
    return () => {
      el.removeEventListener('mousemove', aoMover);
      el.removeEventListener('mouseenter', aoEntrar);
      el.removeEventListener('mouseleave', aoSair);
    };
  }, [comEfeito]);

  return ref;
}

function Capa() {
  const navigate = useNavigate();
  const btnRef = useMagneticGlow(true);

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden relative transition-colors duration-200" style={{ background: 'var(--bg-deep)' }}>
      {/* Fundo decorativo — halos estáticos + grade sutil (seção 6 do design system) */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(900px 520px at 12% -8%,   var(--halo-1), transparent 62%),
              radial-gradient(800px 500px at 88% 4%,    var(--halo-2), transparent 60%),
              radial-gradient(1100px 700px at 60% 108%, var(--halo-3), transparent 66%),
              var(--bg)`,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(var(--grid) 1px, transparent 1px),
                              linear-gradient(90deg, var(--grid) 1px, transparent 1px)`,
            backgroundSize: '104px 104px',
            maskImage: 'linear-gradient(180deg, #000 0%, transparent 78%)',
            WebkitMaskImage: 'linear-gradient(180deg, #000 0%, transparent 78%)',
          }}
        />
      </div>

      <header
        className="relative w-full flex items-center justify-center py-4 sm:py-5 md:py-8 px-2 sm:px-4 md:px-8 min-h-[56px] sm:min-h-[64px] md:h-24 border-b z-20 backdrop-blur-md"
        style={{ background: 'rgba(9, 22, 11, 0.6)', borderColor: 'var(--hairline)' }}
      >
        <button
          onClick={() => navigate('/login')}
          className="absolute left-2 sm:left-4 md:left-8 flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-semibold text-xs sm:text-sm"
          style={{ color: 'var(--txt-dim)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--brand-lite)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--txt-dim)'; }}
        >
          <LogIn size={18} className="sm:w-5 sm:h-5" /> <span className="hidden sm:inline">Login</span>
        </button>

        <img
          src="/img/Normatel Engenharia_BRANCO.png"
          alt="Normatel Engenharia"
          className="h-7 sm:h-9 md:h-11 w-auto object-contain drop-shadow-lg"
        />
      </header>

      <main className="flex-grow flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 relative z-10">
        <div className="text-center mb-10 sm:mb-14 px-2 max-w-2xl">
          <div className="nt-chip mb-4">Portal Integrado</div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-4 sm:mb-6 leading-tight" style={{ color: 'var(--txt)' }}>
            Bem-vindo ao{' '}
            <span className="bg-gradient-to-r from-[var(--brand-lite)] to-[var(--brand-deep)] bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(90deg, var(--brand-lite), var(--brand))' }}>
              NoraHub
            </span>
          </h1>
          <p className="text-sm sm:text-base md:text-lg leading-relaxed" style={{ color: 'var(--txt-dim)' }}>
            Acesso exclusivo para colaboradores Normatel. Faça login com sua conta
            Microsoft pra acessar todos os aplicativos da sua área.
          </p>
        </div>

        <div className="nt-glass nt-beam-host w-full max-w-sm sm:max-w-md rounded-3xl overflow-hidden">
          <span className="nt-beam" aria-hidden />
          <div className="nt-beam-content relative p-8 sm:p-10 flex flex-col items-center text-center gap-6">
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center border"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}
            >
              <Building2 size={44} className="sm:w-12 sm:h-12" style={{ color: 'var(--brand-lite)' }} />
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-1" style={{ color: 'var(--txt)' }}>Sou Normatel</h2>
              <p className="text-sm" style={{ color: 'var(--txt-faint)' }}>
                Gestão de compras, projetos e solicitações internas.
              </p>
            </div>

            <button
              ref={btnRef}
              onClick={() => navigate('/login')}
              className="nt-glow-btn w-full inline-flex items-center justify-center gap-2 font-semibold text-white px-6 py-3.5 rounded-xl text-sm sm:text-base"
              style={{ background: 'linear-gradient(90deg, var(--brand-lite), var(--brand), var(--brand-deep))' }}
            >
              <span className="nt-glow-btn-sheen" aria-hidden />
              <span className="relative z-[1] inline-flex items-center gap-2">
                Fazer Login <ChevronRight size={18} />
              </span>
            </button>
          </div>
        </div>
      </main>

      <footer
        className="w-full py-4 sm:py-6 text-center text-xs shrink-0 border-t z-20 px-2 backdrop-blur-md"
        style={{ background: 'rgba(9, 22, 11, 0.6)', borderColor: 'var(--hairline)', color: 'var(--txt-faint)' }}
      >
        <p>&copy; {new Date().getFullYear()} Normatel Engenharia</p>
      </footer>
    </div>
  );
}

export default Capa;
