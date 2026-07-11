export function SoftPageHero({
  eyebrow,
  title,
  accent,
  description,
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  description: string;
}) {
  return (
    <section className="relative overflow-hidden bg-[#F0F4FF] px-5 py-9 text-center md:px-8 md:py-11 lg:px-10">
      <BackgroundSketches />
      <div className="relative z-10 mx-auto max-w-5xl">
        {eyebrow ? <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#4F9CF9]">{eyebrow}</p> : null}
        <h1 className={`mx-auto max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-normal text-[#0F1C35] md:text-[3.25rem] lg:text-[3.65rem] ${eyebrow ? "mt-3" : ""}`}>
          {title}
          {accent ? (
            <>
              <br />
              <span className="bg-gradient-to-r from-[#2563EB] to-[#6366F1] bg-clip-text text-transparent">
                {accent}
              </span>
            </>
          ) : null}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#536C99] md:text-base">{description}</p>
      </div>
    </section>
  );
}

function BackgroundSketches() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-70">
      <svg className="absolute -left-16 top-2 -rotate-12 text-[#9EB3DD]/22" width="210" height="270" viewBox="0 0 220 280" fill="none">
        <rect x="8" y="8" width="204" height="264" rx="14" stroke="currentColor" strokeWidth="5" />
        <path d="M160 8L212 60H160V8Z" stroke="currentColor" strokeWidth="4" />
        <path d="M32 84H130M32 112H172M32 138H158M32 180H120M32 208H172M32 234H142" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      </svg>
      <svg className="absolute right-12 top-8 rotate-12 text-[#9EB3DD]/24" width="210" height="150" viewBox="0 0 210 150" fill="none">
        <rect x="7" y="7" width="196" height="136" rx="14" stroke="currentColor" strokeWidth="5" />
        <path d="M7 25L105 86L203 25M7 143L72 84M203 143L138 84" stroke="currentColor" strokeWidth="4" />
      </svg>
      <svg className="absolute right-8 bottom-5 rotate-6 text-[#9EB3DD]/18" width="190" height="160" viewBox="0 0 190 160" fill="none">
        <rect x="8" y="50" width="174" height="102" rx="14" stroke="currentColor" strokeWidth="5" />
        <path d="M66 50V32C66 19 76 12 90 12H104C118 12 128 19 128 32V50M8 92H182" stroke="currentColor" strokeWidth="5" />
        <rect x="84" y="84" width="28" height="18" rx="5" stroke="currentColor" strokeWidth="4" />
      </svg>
      <svg className="absolute bottom-4 left-10 -rotate-6 text-[#9EB3DD]/18" width="140" height="170" viewBox="0 0 140 170" fill="none">
        <rect x="7" y="7" width="126" height="156" rx="12" stroke="currentColor" strokeWidth="5" />
        <path d="M98 7L133 42H98V7Z" stroke="currentColor" strokeWidth="4" />
        <path d="M28 62H86M28 82H110M28 104H94M28 128H104" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      </svg>
    </div>
  );
}
