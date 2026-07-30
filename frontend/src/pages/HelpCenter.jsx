import {
  BookOpen, Rocket, Clapperboard, ListTree, Braces, ShieldCheck, FlaskConical,
  Server, PlayCircle, LayoutDashboard, Keyboard, Info,
} from 'lucide-react'

const EYEBROW = {
  fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)',
}

const SECTIONS = [
  { id: 'getting-started', icon: Rocket,        title: 'Getting Started',      tint: 'var(--blue)' },
  { id: 'building-scenes', icon: Clapperboard,   title: 'Building a Scene',     tint: 'var(--lime)' },
  { id: 'frames',          icon: ListTree,       title: 'Adding Frames',        tint: 'var(--blue)' },
  { id: 'variables',       icon: Braces,         title: 'Variables & Extractors', tint: 'var(--peach)' },
  { id: 'assertions',      icon: ShieldCheck,    title: 'Assertions',           tint: 'var(--lime)' },
  { id: 'testing',         icon: FlaskConical,   title: 'Testing a Frame',      tint: 'var(--blue)' },
  { id: 'runners',         icon: Server,         title: 'Runners',              tint: 'var(--warning)' },
  { id: 'runs',            icon: PlayCircle,     title: 'Runs & Results',       tint: 'var(--success)' },
  { id: 'dashboard',       icon: LayoutDashboard, title: 'Dashboard & Alerts',  tint: 'var(--blue)' },
  { id: 'shortcuts',       icon: Keyboard,       title: 'Keyboard Shortcuts',   tint: 'var(--text-muted)' },
]

function Code({ children }) {
  return (
    <code style={{
      fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--lime)',
      background: 'var(--bg)', border: '1px solid var(--border-bright)',
      borderRadius: 4, padding: '1px 6px',
    }}>
      {children}
    </code>
  )
}

function Section({ id, icon, title, tint, children }) {
  const Icon = icon
  return (
    <section id={id} className="card" style={{ scrollMarginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon size={14} style={{ color: tint }} />
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text)' }}>{title}</h2>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </section>
  )
}

function SubHeading({ children }) {
  return <div style={{ ...EYEBROW, marginTop: 4 }}>{children}</div>
}

function Steps({ items }) {
  return (
    <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ol>
  )
}

function List({ items }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}

function Tip({ children, variant = 'info' }) {
  return (
    <div className={`alert alert--${variant}`}>
      <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </div>
  )
}

function StatusLegend({ items }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map(({ color, label, desc }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700, color: 'var(--text)', minWidth: 78 }}>{label}</span>
          <span style={{ color: 'var(--text-muted)' }}>{desc}</span>
        </div>
      ))}
    </div>
  )
}

export default function HelpCenter() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Help Center</h1>
          <p className="page-subtitle">Guides for building scenes, running the fleet, and reading results</p>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 210px) 1fr', gap: 16, alignItems: 'start' }}>

          {/* ── TOC ── */}
          <nav
            className="card"
            style={{ position: 'sticky', top: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}
          >
            <div style={{ ...EYEBROW, padding: '2px 8px 8px' }}>On this page</div>
            {SECTIONS.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6,
                  fontSize: 12, color: 'var(--text-dim)', textDecoration: 'none',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-raised)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <s.icon size={13} style={{ color: s.tint, flexShrink: 0 }} />
                {s.title}
              </a>
            ))}
          </nav>

          {/* ── Content ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <Section id="getting-started" icon={BookOpen} title="What is TestFleet?" tint="var(--blue)">
              <p style={{ margin: 0 }}>
                TestFleet runs synthetic checks against your APIs on a schedule, from wherever your <b>runners</b> are
                deployed. Each check is a <b>Scene</b> — an ordered pipeline of HTTP requests called <b>Frames</b> — and every
                run is executed by one or more registered runners and reported back here.
              </p>
              <SubHeading>Quick start</SubHeading>
              <Steps items={[
                <>Register at least one runner (<i>Runners → New Runner</i>) and start its process with the issued key/secret.</>,
                <>Create a scene (<i>Scenes → New Scene</i>) with a name, a run frequency, and a pass threshold.</>,
                <>Add one or more frames — each one is a single HTTP request, run in order.</>,
                <>Optionally add extractors (pull values out of a response) and assertions (validate a response).</>,
                <>Save the frames, then use <i>Run now</i> to trigger an immediate run instead of waiting for the schedule.</>,
                <>Check the <i>Runs</i> tab or the Dashboard to see results as they come in.</>,
              ]} />
            </Section>

            <Section id="building-scenes" icon={Clapperboard} title="Building a Scene" tint="var(--lime)">
              <p style={{ margin: 0 }}>A scene is created with:</p>
              <List items={[
                <><b>Name / Description</b> — what this scene is checking.</>,
                <><b>Frequency</b> — how often it runs on its own, from every minute up to every 24 hours.</>,
                <><b>Timeout</b> — how long (in minutes) a run is allowed to take before it's considered overdue.</>,
                <><b>Pass Threshold</b> — how many of the runners that picked up a run need to pass for the whole run to
                  count as <i>passed</i>: <Code>All runners</Code>, <Code>Majority</Code> (≥50%), or <Code>Any runner</Code> (at least one).</>,
              ]} />
              <Tip>
                Toggling a scene disabled stops it from being scheduled, but doesn't touch its history — past runs stay visible.
                A scene that's enabled with zero enabled frames is flagged on its page since it will never actually run.
              </Tip>
            </Section>

            <Section id="frames" icon={ListTree} title="Adding Frames" tint="var(--blue)">
              <p style={{ margin: 0 }}>
                Each frame is one HTTP request: <b>Method</b>, <b>URL</b>, optional <b>Headers</b> and <b>Request Body</b>
                (for POST/PUT/PATCH), and a per-frame timeout. Frames run top to bottom — drag the <Code>⠿</Code> handle
                to reorder. If a frame's assertions fail, the run stops there and later frames don't execute.
              </p>
              <SubHeading>Staged vs. saved</SubHeading>
              <p style={{ margin: 0 }}>
                Clicking <i>Add Frame</i> opens a draft and <i>Stage Frame</i> moves it into a pending list — nothing is
                written to the scene until you click <i>Save N Frames</i>. Staged frames survive switching between the
                Frames/Runs/Settings tabs, but if you try to navigate elsewhere with staged frames or an in-progress draft,
                you'll be prompted to save or discard them first rather than losing them silently.
              </p>
            </Section>

            <Section id="variables" icon={Braces} title="Variables & Extractors" tint="var(--peach)">
              <p style={{ margin: 0 }}>
                Reference a variable anywhere a request field accepts one with <Code>{'${variableName}'}</Code>. Variables
                come from two places:
              </p>
              <List items={[
                <><b>Scene variables</b> — fixed values (e.g. a base URL or API key) seeded before frame 1 runs. Edit them
                  from the scene's Frames tab.</>,
                <><b>Extractors</b> — pull a value out of an earlier frame's response so a later frame can use it (e.g. a
                  token from a login call).</>,
              ]} />
              <SubHeading>Extractor source format</SubHeading>
              <p style={{ margin: 0 }}>
                For a <Code>json</Code> extractor or assertion, <i>Source</i> takes the friendly dot-path form rooted at the
                response body — click the <Code>?</Code> next to the Source column header for a reminder:
              </p>
              <div className="code-box"><code>res.body.data.items[0].id</code></div>
              <p style={{ margin: 0 }}>For a <Code>header</Code> extractor, Source is just the header name, e.g. <Code>Content-Type</Code>.</p>
            </Section>

            <Section id="assertions" icon={ShieldCheck} title="Assertions" tint="var(--lime)">
              <p style={{ margin: 0 }}>
                Assertions validate a frame's response. Three types are available: <Code>status</Code> (the HTTP status
                code), <Code>json</Code> (a value from the response body), and <Code>header</Code> (a response header).
                Pick an operator — <Code>=</Code>, <Code>≠</Code>, <Code>&gt;</Code>, <Code>≥</Code>, <Code>&lt;</Code>,
                <Code>≤</Code>, or <Code>contains</Code> (not available for <Code>status</Code>) — and an expected value.
              </p>
              <Tip variant="warning">
                A failed assertion stops the scene at that frame — treat early frames (login, setup) as gatekeepers and
                keep their assertions strict.
              </Tip>
            </Section>

            <Section id="testing" icon={FlaskConical} title="Testing a Frame" tint="var(--blue)">
              <p style={{ margin: 0 }}>
                While editing a frame, use <i>Test Frame</i> to fire the request immediately using whatever scene
                variables are already known — this is the fastest way to check a URL, inspect the real response shape, and
                pick out extractor/assertion paths before saving. Variables from a frame that hasn't run yet obviously
                can't be resolved, so the panel tells you which ones it skipped.
              </p>
            </Section>

            <Section id="runners" icon={Server} title="Runners" tint="var(--warning)">
              <p style={{ margin: 0 }}>
                A runner is a process that executes scenes and reports results back. Register one from
                <i> Runners → New Runner</i> — you'll get an API key and secret shown <b>once</b>; save them immediately
                and configure your runner process with them.
              </p>
              <SubHeading>Status</SubHeading>
              <StatusLegend items={[
                { color: 'var(--lime)', label: 'Active', desc: 'Enabled and has sent a heartbeat recently.' },
                { color: 'var(--error)', label: 'Unresponsive', desc: "Enabled, but hasn't heartbeated recently — likely crashed, network-partitioned, or misconfigured. Computed live, not something you set." },
                { color: 'var(--text-muted)', label: 'Disabled', desc: 'Manually turned off — excluded from scheduling until re-enabled.' },
              ]} />
              <Tip variant="warning">
                Give every runner its own key/secret. Two runners sharing credentials get flagged with a "shared creds"
                warning since it makes their individual metrics and identity unreliable.
              </Tip>
            </Section>

            <Section id="runs" icon={PlayCircle} title="Runs & Results" tint="var(--success)">
              <p style={{ margin: 0 }}>Each run aggregates one report per runner that was expected to pick it up:</p>
              <StatusLegend items={[
                { color: 'var(--blue)', label: 'Pending', desc: "Still in flight — not every expected runner has reported and the scene's timeout hasn't passed yet." },
                { color: 'var(--success)', label: 'Passed', desc: 'Enough runners passed to clear the pass threshold.' },
                { color: 'var(--error)', label: 'Failed', desc: "Every expected runner reported, but not enough passed to clear the threshold." },
                { color: 'var(--peach)', label: 'Error', desc: "An individual runner's request/setup itself errored out (distinct from a failed assertion)." },
                { color: 'var(--warning)', label: 'Incomplete', desc: "The timeout passed without every expected runner reporting — a runner likely dropped mid-run or never picked up the job. Different from Failed: it means missing data, not a bad response." },
              ]} />
              <p style={{ margin: 0 }}>
                Open a run from the scene's Runs tab or the global Runs page to see the per-runner breakdown, timing, and
                the full request/response for each frame.
              </p>
            </Section>

            <Section id="dashboard" icon={LayoutDashboard} title="Dashboard & Alerts" tint="var(--blue)">
              <p style={{ margin: 0 }}>
                The Dashboard summarizes fleet health at a glance: runners active vs. total, scenes whose last run failed
                or errored, and runners flagged for sharing credentials. The same runner/scene counts follow you around
                the app in the top strip next to the search bar.
              </p>
            </Section>

            <Section id="shortcuts" icon={Keyboard} title="Keyboard Shortcuts" tint="var(--text-muted)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', border: '1px solid var(--border-bright)', borderRadius: 4, padding: '2px 7px' }}>⌘K</kbd>
                <span>Open the Jump to… command palette — search scenes, runners, and pages by name from anywhere.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', border: '1px solid var(--border-bright)', borderRadius: 4, padding: '2px 7px' }}>Esc</kbd>
                <span>Close the command palette or any open dialog.</span>
              </div>
            </Section>

          </div>
        </div>
      </div>
    </>
  )
}
