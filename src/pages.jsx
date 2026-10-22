export function CoverPage() {
  return (
    <div className="cover">
      <div className="cover__spine" />
      <div className="cover__frame">
        <div className="cover__top">A Portfolio</div>
        <h1 className="cover__title">Ramsha<br />Iqbal</h1>
        <div className="cover__rule" />
        <p className="cover__sub">Software Engineer · Builder of things</p>
        <div className="cover__monogram">RI</div>
        <div className="cover__bottom">
          <span>Vol. I</span>
          <span>·</span>
          <span>2026 Edition</span>
        </div>
      </div>
      <div className="cover__hint">turn the page →</div>
    </div>
  )
}

export function TableOfContentsPage({ onJump }) {
  const entries = [
    { num: 'I',   title: 'About the Author', page: '3',  jump: 4 },
    { num: 'II',  title: 'Experience',       page: '5',  jump: 6 },
    { num: 'III', title: 'Projects',         page: '7',  jump: 8 },
    { num: 'IV',  title: 'Skills',           page: '13', jump: 14 },
    { num: 'V',   title: 'Education',        page: '15', jump: 16 },
    { num: 'VI',  title: 'Contact',          page: '17', jump: 18 },
  ]
  return (
    <div className="toc">
      <div className="kicker">— Front matter —</div>
      <h2 className="toc__title">Table of Contents</h2>
      <ul className="toc__list">
        {entries.map((e) => (
          <li key={e.num}>
            <button className="toc__row" onClick={() => onJump?.(e.jump)}>
              <span className="toc__num">{e.num}.</span>
              <span className="toc__name">{e.title}</span>
              <span className="toc__dots" />
              <span className="toc__page">{e.page}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="toc__quote">
        <em>"We read to know we are not alone."</em>
        <span>— C.S. Lewis</span>
      </div>
    </div>
  )
}

export function AboutPage() {
  return (
    <div className="prose">
      <p className="prose__lead">
        <span className="dropcap">H</span>
        i, I'm Ramsha — a software engineer who likes building things that
        feel obvious to use and quiet to maintain. Most of my favorite work
        sits somewhere between a clean API and a careful UI.
      </p>
      <p>
        I'm drawn to problems where small details compound: a faster feedback
        loop, a clearer error message, a default that means most people
        never have to open the settings. I think the best software gets out
        of the way.
      </p>
      <p>
        Outside of work I read, sketch out side projects in notebooks before
        they earn a repo, and keep a running list of things I want to
        understand more deeply.
      </p>
      <div className="signature">— Ramsha</div>
      <aside className="margin-note">
        <strong>Currently:</strong><br />
        Software Engineer
        <br /><br />
        <strong>Reach me at:</strong><br />
        ramshaiqbal4@gmail.com
      </aside>
    </div>
  )
}

export function ExperiencePage() {
  const roles = [
    {
      where: 'Company name',
      role: 'Your role',
      when: '2025 — Present',
      bullets: [
        'A short, specific bullet about something you owned end-to-end.',
        'A bullet that names a measurable result if you have one.',
      ],
    },
    {
      where: 'Earlier role',
      role: 'Your role',
      when: '20XX — 2025',
      bullets: [
        'A bullet about the kind of work you did and the stack.',
        'A bullet about something you learned or shipped.',
      ],
    },
  ]
  return (
    <div className="prose">
      <ul className="timeline">
        {roles.map((r) => (
          <li key={r.where}>
            <div className="timeline__head">
              <span className="timeline__where">{r.where}</span>
              <span className="timeline__when">{r.when}</span>
            </div>
            <div className="timeline__role">{r.role}</div>
            <ul className="timeline__bullets">
              {r.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ProjectPage({ project }) {
  return (
    <div className="prose project">
      <div className="project__head">
        <span className="project__num">№ {project.n}</span>
        <span className="project__year">{project.year}</span>
      </div>
      <h3 className="project__title">{project.title}</h3>
      <div className="project__stack">
        {project.stack.map((s, i) => <span key={`${s}-${i}`} className="tag">{s}</span>)}
      </div>
      <div className="project__sec">
        <span className="project__label">¶ Problem</span>
        <p>{project.problem}</p>
      </div>
      <div className="project__sec">
        <span className="project__label">¶ What I built</span>
        <p>{project.built}</p>
      </div>
      <div className="project__sec">
        <span className="project__label">¶ Outcome</span>
        <p>{project.outcome}</p>
      </div>
      <div className="project__links">
        {project.links.map((l) => (
          <a key={l.label} href={l.href} className="link">▸ {l.label}</a>
        ))}
      </div>
    </div>
  )
}

export function SkillsPage() {
  const groups = [
    {
      name: 'Languages',
      items: [
        { k: 'Python',     v: 90 },
        { k: 'TypeScript', v: 85 },
        { k: 'JavaScript', v: 90 },
        { k: 'Go',         v: 60 },
        { k: 'SQL',        v: 80 },
      ],
    },
    {
      name: 'Frameworks',
      items: [
        { k: 'React / Next.js',   v: 90 },
        { k: 'FastAPI / Node',    v: 85 },
        { k: 'PostgreSQL',        v: 75 },
        { k: 'Tailwind',          v: 85 },
      ],
    },
  ]
  return (
    <div className="prose skills">
      {groups.map((g) => (
        <div key={g.name} className="skills__group">
          <h4 className="skills__name">{g.name}</h4>
          <ul className="skills__list">
            {g.items.map((it) => (
              <li key={it.k}>
                <span className="skills__k">{it.k}</span>
                <span className="skills__bar" aria-hidden>
                  <span className="skills__fill" style={{ width: `${it.v}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <aside className="margin-note margin-note--right">
        <strong>Currently learning:</strong><br />
        — Rust<br />
        — Distributed systems<br />
        — Better writing
      </aside>
    </div>
  )
}

export function EducationPage() {
  return (
    <div className="prose">
      <div className="edu">
        <div className="edu__head">
          <span className="edu__where">Your University</span>
          <span className="edu__when">20XX — 20XX</span>
        </div>
        <div className="edu__role">Your degree, your major</div>
        <p>
          A short paragraph about what you studied, what you focused on, and
          what shaped how you think about engineering today.
        </p>
      </div>

      <div className="edu">
        <div className="edu__head">
          <span className="edu__where">Reading list (always open)</span>
          <span className="edu__when">ongoing</span>
        </div>
        <ul className="reading">
          <li><em>Designing Data-Intensive Applications</em> — Kleppmann</li>
          <li><em>The Pragmatic Programmer</em> — Hunt &amp; Thomas</li>
          <li><em>A Philosophy of Software Design</em> — Ousterhout</li>
        </ul>
      </div>
    </div>
  )
}

export function ContactPage() {
  const links = [
    { k: 'Email',    v: 'ramshaiqbal4@gmail.com', href: 'mailto:ramshaiqbal4@gmail.com' },
    { k: 'LinkedIn', v: '/in/ramshaiqbal',        href: '#' },
    { k: 'GitHub',   v: '@ramshaiqbal',           href: '#' },
    { k: 'Twitter',  v: '@ramshaiqbal',           href: '#' },
  ]
  return (
    <div className="prose contact">
      <p className="prose__lead">
        <span className="dropcap">G</span>
        et in touch — I'm easiest to reach by email, but I read everything
        eventually.
      </p>
      <ul className="contact__list">
        {links.map((l) => (
          <li key={l.k}>
            <span className="contact__k">{l.k}</span>
            <a className="contact__v" href={l.href}>{l.v}</a>
          </li>
        ))}
      </ul>
      <div className="signature">— Ramsha</div>
    </div>
  )
}

export function EndPage() {
  return (
    <div className="end">
      <div className="end__ornament">✦ ✦ ✦</div>
      <h2 className="end__title">The End</h2>
      <p className="end__sub">
        Thank you for reading. <br />
        Turn back, or close the book.
      </p>
      <div className="end__small">© 2026 · Ramsha Iqbal</div>
    </div>
  )
}
