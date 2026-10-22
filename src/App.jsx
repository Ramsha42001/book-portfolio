import { useRef, useState, useEffect, forwardRef } from 'react'
import HTMLFlipBook from 'react-pageflip'
import {
  CoverPage,
  TableOfContentsPage,
  AboutPage,
  ExperiencePage,
  ProjectPage,
  SkillsPage,
  EducationPage,
  ContactPage,
  EndPage,
} from './pages.jsx'
import AmbientScene from './AmbientScene.jsx'
import Room from './Room.jsx'
import './App.css'

const Page = forwardRef(function Page({ children, side = 'right', number }, ref) {
  return (
    <div className={`page page--${side}`} ref={ref}>
      <div className="page__inner">
        <div className="page__content">{children}</div>
        <div className="page__footer">
          {side === 'left' ? (
            <>
              <span className="page__num">{number}</span>
              <span className="page__chapter">Ramsha Iqbal · Vol. I</span>
            </>
          ) : (
            <>
              <span className="page__chapter">Ramsha Iqbal · Vol. I</span>
              <span className="page__num">{number}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
})

const sections = [
  { name: 'Cover', page: 0 },
  { name: 'Contents', page: 2 },
  { name: 'About', page: 4 },
  { name: 'Experience', page: 6 },
  { name: 'Projects', page: 8 },
  { name: 'Skills', page: 14 },
  { name: 'Education', page: 16 },
  { name: 'Contact', page: 18 },
]

export default function App() {
  const bookRef = useRef(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [dimensions, setDimensions] = useState({ width: 550, height: 720 })
  const [pulse, setPulse] = useState(false)
  const pulseTimer = useRef(null)
  const [view, setView] = useState('room')
  const [fading, setFading] = useState(false)

  function switchView(next) {
    setFading(true)
    setTimeout(() => {
      setView(next)
      setTimeout(() => setFading(false), 80)
    }, 450)
  }

  function handleFlip(e) {
    setCurrentPage(e.data)
    // ambient scene listens for this to kick up dust
    window.dispatchEvent(new Event('bookflip'))
    setPulse(true)
    clearTimeout(pulseTimer.current)
    pulseTimer.current = setTimeout(() => setPulse(false), 700)
  }

  useEffect(() => {
    function updateSize() {
      const maxW = Math.min(window.innerWidth - 80, 1200)
      const maxH = window.innerHeight - 120
      // book is two pages wide; aspect ratio of single page ~ 0.72
      let pageW = Math.min(maxW / 2, 600)
      let pageH = pageW / 0.72
      if (pageH > maxH) {
        pageH = maxH
        pageW = pageH * 0.72
      }
      setDimensions({ width: Math.floor(pageW), height: Math.floor(pageH) })
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (!bookRef.current) return
      const api = bookRef.current.pageFlip()
      if (!api) return
      if (e.key === 'ArrowRight') api.flipNext()
      if (e.key === 'ArrowLeft') api.flipPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const goTo = (p) => bookRef.current?.pageFlip()?.flip(p)
  const next = () => bookRef.current?.pageFlip()?.flipNext()
  const prev = () => bookRef.current?.pageFlip()?.flipPrev()

  // When showCover is true, pages 0 (front cover) and last (back cover) show as a single page.
  // HTMLFlipBook places them on the right/left half of the spread — we shift the whole book
  // so the single visible page is centered on screen.
  const onCover = currentPage === 0
  const onBackCover = totalPages > 0 && currentPage >= totalPages - 1
  const bookShift = onCover
    ? -dimensions.width / 2
    : onBackCover
    ? dimensions.width / 2
    : 0

  if (view === 'room') {
    return (
      <>
        <Room onOpen={() => switchView('book')} />
        <div className={`fade${fading ? ' fade--on' : ''}`} />
      </>
    )
  }

  return (
    <div className={`stage${pulse ? ' stage--pulse' : ''}`}>
      <button className="room-return" onClick={() => switchView('room')}>
        ⟵ back to the room
      </button>
      <div className={`fade${fading ? ' fade--on' : ''}`} />
      <AmbientScene />
      <div className="ribbons-wrap" style={{ width: dimensions.width * 2 + 20 }}>
        <div className="ribbons">
          {sections.map((s, i) => (
            <button
              key={s.name}
              className="ribbon"
              style={{ '--ribbon-color': ribbonColors[i % ribbonColors.length] }}
              onClick={() => goTo(s.page)}
              title={`Go to ${s.name}`}
            >
              <span>{s.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        className="book-wrap"
        style={{
          width: dimensions.width * 2 + 20,
          transform: `translateX(${bookShift}px)`,
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="book-shadow" />
        <HTMLFlipBook
          width={dimensions.width}
          height={dimensions.height}
          size="fixed"
          minWidth={300}
          maxWidth={700}
          minHeight={400}
          maxHeight={900}
          drawShadow={true}
          flippingTime={800}
          usePortrait={false}
          startZIndex={0}
          autoSize={false}
          maxShadowOpacity={0.4}
          showCover={true}
          mobileScrollSupport={false}
          ref={bookRef}
          className="book"
          onFlip={handleFlip}
          onInit={(e) => setTotalPages(e.object.getPageCount())}
        >
          {/* Cover (front) */}
          <Page side="right" number=""><CoverPage /></Page>

          {/* Inside cover */}
          <Page side="left" number=""><BlankPage /></Page>
          <Page side="right" number="i"><TableOfContentsPage onJump={goTo} /></Page>

          {/* About */}
          <Page side="left" number="2"><AboutLeftPage /></Page>
          <Page side="right" number="3"><AboutPage /></Page>

          {/* Experience */}
          <Page side="left" number="4"><ChapterIntro num="II" title="Experience" subtitle="A working life, in chapters" /></Page>
          <Page side="right" number="5"><ExperiencePage /></Page>

          {/* Projects */}
          <Page side="left" number="6"><ChapterIntro num="III" title="Projects" subtitle="Selected works" /></Page>
          <Page side="right" number="7"><ProjectPage project={projectsList[0]} /></Page>
          <Page side="left" number="8"><ProjectPage project={projectsList[1]} /></Page>
          <Page side="right" number="9"><ProjectPage project={projectsList[2]} /></Page>
          <Page side="left" number="10"><ProjectPage project={projectsList[3]} /></Page>
          <Page side="right" number="11"><ProjectPage project={projectsList[4]} /></Page>

          {/* Skills */}
          <Page side="left" number="12"><ChapterIntro num="IV" title="Skills" subtitle="Tools of the trade" /></Page>
          <Page side="right" number="13"><SkillsPage /></Page>

          {/* Education */}
          <Page side="left" number="14"><ChapterIntro num="V" title="Education" subtitle="Where it all began" /></Page>
          <Page side="right" number="15"><EducationPage /></Page>

          {/* Contact */}
          <Page side="left" number="16"><ChapterIntro num="VI" title="Contact" subtitle="Send word" /></Page>
          <Page side="right" number="17"><ContactPage /></Page>

          {/* Back cover */}
          <Page side="left" number=""><EndPage /></Page>
          <Page side="right" number=""><BackCoverPage /></Page>
        </HTMLFlipBook>
      </div>

      <div className="controls">
        <button className="ctrl" onClick={prev} aria-label="Previous page">◀</button>
        <div className="pager">
          {currentPage + 1} <span>/</span> {totalPages || '—'}
        </div>
        <button className="ctrl" onClick={next} aria-label="Next page">▶</button>
      </div>

      <div className="hint">use ← → arrow keys, click page corners, or tap a ribbon</div>
    </div>
  )
}

const ribbonColors = ['#8b2e2e', '#3a5a3a', '#2e4a8b', '#8b6b2e', '#5a2e8b', '#2e7a8b', '#8b2e6b', '#4a4a4a']

function BlankPage() {
  return <div className="blank" />
}

function AboutLeftPage() {
  return (
    <div className="chapter-intro">
      <div className="chapter-num">Chapter I</div>
      <h1 className="chapter-title">About<br />the Author</h1>
      <div className="ornament">✦</div>
      <p className="chapter-sub">A short introduction, before we begin.</p>
    </div>
  )
}

function ChapterIntro({ num, title, subtitle }) {
  return (
    <div className="chapter-intro">
      <div className="chapter-num">Chapter {num}</div>
      <h1 className="chapter-title">{title}</h1>
      <div className="ornament">✦</div>
      <p className="chapter-sub">{subtitle}</p>
    </div>
  )
}

function BackCoverPage() {
  return (
    <div className="cover back-cover">
      <div className="cover__spine" />
      <div className="cover__frame">
        <div className="cover__monogram">VR</div>
        <div className="cover__line">— fin —</div>
        <p className="cover__tag">Thank you for reading.</p>
      </div>
    </div>
  )
}

const projectsList = [
  {
    chapter: 'III',
    n: '01',
    title: 'Project One — Title here',
    year: '2025 · Present',
    stack: ['Tech', 'Tech', 'Tech'],
    problem:
      'Describe the problem you were trying to solve. One or two sentences.',
    built:
      'Describe what you built and the interesting parts of how you built it.',
    outcome:
      'Describe the outcome — users, impact, metrics, or what you learned.',
    links: [
      { label: 'Live demo', href: '#' },
      { label: 'GitHub', href: '#' },
    ],
  },
  {
    chapter: 'III',
    n: '02',
    title: 'Project Two — Title here',
    year: '2025',
    stack: ['Tech', 'Tech'],
    problem: 'Describe the problem. Keep it short and specific.',
    built: 'Describe what you built.',
    outcome: 'Describe the outcome.',
    links: [{ label: 'GitHub', href: '#' }],
  },
  {
    chapter: 'III',
    n: '03',
    title: 'Project Three — Title here',
    year: '2024',
    stack: ['Tech', 'Tech'],
    problem: 'Describe the problem.',
    built: 'Describe what you built.',
    outcome: 'Describe the outcome.',
    links: [{ label: 'GitHub', href: '#' }],
  },
  {
    chapter: 'III',
    n: '04',
    title: 'Project Four — Title here',
    year: '2024',
    stack: ['Tech', 'Tech'],
    problem: 'Describe the problem.',
    built: 'Describe what you built.',
    outcome: 'Describe the outcome.',
    links: [{ label: 'GitHub', href: '#' }],
  },
  {
    chapter: 'III',
    n: '05',
    title: '… and assorted side quests',
    year: 'ongoing',
    stack: ['Various'],
    problem: 'Curiosity rarely respects sprint boundaries.',
    built:
      'Small experiments — weekend projects, tinkering, and things that never made it to v1 but taught me a lot.',
    outcome: 'Each one taught me something I now use elsewhere.',
    links: [{ label: 'GitHub', href: '#' }],
  },
]
