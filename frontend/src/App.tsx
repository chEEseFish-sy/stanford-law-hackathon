import { useEffect, useMemo, useState } from 'react';

type ViewMode = 'front' | 'back';
type CharacterVariant =
  | 'judge'
  | 'plaintiffCounsel'
  | 'plaintiff'
  | 'clerk'
  | 'defendant'
  | 'defenseCounsel'
  | 'spectatorBrown'
  | 'spectatorDark'
  | 'spectatorBlonde'
  | 'spectatorGray'
  | 'spectatorOrange'
  | 'spectatorPurple';

interface Actor {
  id: string;
  name: string;
  title: string;
  variant: CharacterVariant;
  dialogue: string;
  x: number;
  y: number;
  scale: number;
  delay: number;
  view: ViewMode;
  player?: boolean;
}

const leadActors: Actor[] = [
  {
    id: 'judge',
    name: 'Judge Hawthorne',
    title: 'Chief Judge',
    variant: 'judge',
    dialogue: 'Court is now in session. Present your strongest argument.',
    x: 50,
    y: 18.5,
    scale: 1.2,
    delay: 0,
    view: 'front',
  },
  {
    id: 'plaintiff-counsel',
    name: 'Elena Hart',
    title: 'Plaintiff Counsel',
    variant: 'plaintiffCounsel',
    dialogue: 'The evidence trail is clear, and the timeline favors our case.',
    x: 22.7,
    y: 29.8,
    scale: 1.03,
    delay: 180,
    view: 'front',
  },
  {
    id: 'plaintiff',
    name: 'Martin Vale',
    title: 'Plaintiff',
    variant: 'plaintiff',
    dialogue: 'I only want the truth to be heard in this courtroom.',
    x: 31.8,
    y: 30.4,
    scale: 1.02,
    delay: 340,
    view: 'front',
  },
  {
    id: 'clerk',
    name: 'Mira Stone',
    title: 'Court Clerk',
    variant: 'clerk',
    dialogue: 'The docket is ready, and the witness notes are in order.',
    x: 67.8,
    y: 29.4,
    scale: 1,
    delay: 120,
    view: 'front',
  },
  {
    id: 'defendant',
    name: 'Nora Wren',
    title: 'Defendant',
    variant: 'defendant',
    dialogue: 'I trust my counsel. There is more to this story than they know.',
    x: 76.8,
    y: 29.8,
    scale: 1.02,
    delay: 260,
    view: 'front',
  },
  {
    id: 'defense-counsel',
    name: 'Adrian Cole',
    title: 'Defense Counsel',
    variant: 'defenseCounsel',
    dialogue: 'I am ready to challenge every contradiction in this courtroom.',
    x: 86,
    y: 29.7,
    scale: 1.04,
    delay: 420,
    view: 'front',
    player: true,
  },
];

const galleryActors: Actor[] = [
  { id: 'g1', name: 'Elias', title: 'Gallery', variant: 'spectatorPurple', dialogue: 'This trial feels historic already.', x: 9.5, y: 60.5, scale: 0.94, delay: 80, view: 'back' },
  { id: 'g2', name: 'Jonah', title: 'Gallery', variant: 'spectatorDark', dialogue: 'Everyone went quiet the moment the judge spoke.', x: 16, y: 60.2, scale: 0.94, delay: 200, view: 'back' },
  { id: 'g3', name: 'Lena', title: 'Gallery', variant: 'spectatorDark', dialogue: 'The plaintiff seems confident today.', x: 23, y: 60.5, scale: 0.94, delay: 140, view: 'back' },
  { id: 'g4', name: 'Rowan', title: 'Gallery', variant: 'spectatorBrown', dialogue: 'The defense counsel looks ready for a surprise.', x: 30.2, y: 60.4, scale: 0.94, delay: 320, view: 'back' },
  { id: 'g5', name: 'Mason', title: 'Gallery', variant: 'spectatorBrown', dialogue: 'I can feel the tension from the back row.', x: 37.2, y: 60.6, scale: 0.94, delay: 260, view: 'back' },
  { id: 'g6', name: 'Ivy', title: 'Gallery', variant: 'spectatorOrange', dialogue: 'One strong objection could change everything.', x: 44.5, y: 60.8, scale: 0.94, delay: 380, view: 'back' },
  { id: 'g7', name: 'Theo', title: 'Gallery', variant: 'spectatorDark', dialogue: 'The center aisle gives the whole room a grand feeling.', x: 58.4, y: 60.5, scale: 0.94, delay: 300, view: 'back' },
  { id: 'g8', name: 'Ruby', title: 'Gallery', variant: 'spectatorPurple', dialogue: 'Even the jury benches are leaning in.', x: 65.4, y: 60.2, scale: 0.94, delay: 210, view: 'back' },
  { id: 'g9', name: 'Finn', title: 'Gallery', variant: 'spectatorOrange', dialogue: 'This is the busiest courtroom in town.', x: 72.2, y: 60.5, scale: 0.94, delay: 160, view: 'back' },
  { id: 'g10', name: 'Hazel', title: 'Gallery', variant: 'spectatorGray', dialogue: 'The judge always notices nervous witnesses.', x: 79.2, y: 60.2, scale: 0.94, delay: 280, view: 'back' },
  { id: 'g11', name: 'Caleb', title: 'Gallery', variant: 'spectatorBrown', dialogue: 'The gallery has never been this packed before.', x: 86.2, y: 60.4, scale: 0.94, delay: 340, view: 'back' },
  { id: 'g12', name: 'Mara', title: 'Gallery', variant: 'spectatorGray', dialogue: 'Everyone wants to hear the next testimony.', x: 93.1, y: 60.6, scale: 0.94, delay: 120, view: 'back' },
  { id: 'g13', name: 'Owen', title: 'Gallery', variant: 'spectatorBlonde', dialogue: 'The wooden benches creak every time someone shifts.', x: 8.8, y: 72.8, scale: 0.94, delay: 180, view: 'back' },
  { id: 'g14', name: 'Piper', title: 'Gallery', variant: 'spectatorOrange', dialogue: 'The defense table looks like it is planning three moves ahead.', x: 16.1, y: 72.6, scale: 0.94, delay: 250, view: 'back' },
  { id: 'g15', name: 'Iris', title: 'Gallery', variant: 'spectatorPurple', dialogue: 'I came early just to get this seat.', x: 23.4, y: 72.8, scale: 0.94, delay: 120, view: 'back' },
  { id: 'g16', name: 'Beck', title: 'Gallery', variant: 'spectatorBlonde', dialogue: 'The plaintiff and defendant both look determined.', x: 31, y: 72.7, scale: 0.94, delay: 360, view: 'back' },
  { id: 'g17', name: 'Sage', title: 'Gallery', variant: 'spectatorDark', dialogue: 'The courtroom light makes every wood panel glow.', x: 38.8, y: 72.8, scale: 0.94, delay: 210, view: 'back' },
  { id: 'g18', name: 'Nell', title: 'Gallery', variant: 'spectatorGray', dialogue: 'I expect the clerk will reveal something crucial soon.', x: 46.4, y: 72.9, scale: 0.94, delay: 300, view: 'back' },
  { id: 'g19', name: 'Reed', title: 'Gallery', variant: 'spectatorDark', dialogue: 'No one is leaving before the verdict today.', x: 59, y: 72.8, scale: 0.94, delay: 220, view: 'back' },
  { id: 'g20', name: 'Cora', title: 'Gallery', variant: 'spectatorBrown', dialogue: 'The courtroom hum settles the moment evidence appears.', x: 66, y: 72.6, scale: 0.94, delay: 100, view: 'back' },
  { id: 'g21', name: 'Tessa', title: 'Gallery', variant: 'spectatorOrange', dialogue: 'That red carpet makes the entire room feel ceremonial.', x: 73.1, y: 72.8, scale: 0.94, delay: 340, view: 'back' },
  { id: 'g22', name: 'Grant', title: 'Gallery', variant: 'spectatorBrown', dialogue: 'I have been watching the defense counsel take notes all morning.', x: 80.1, y: 72.8, scale: 0.94, delay: 280, view: 'back' },
  { id: 'g23', name: 'Willa', title: 'Gallery', variant: 'spectatorGray', dialogue: 'It feels like one objection could turn the room upside down.', x: 87.5, y: 72.8, scale: 0.94, delay: 150, view: 'back' },
  { id: 'g24', name: 'Eden', title: 'Gallery', variant: 'spectatorGray', dialogue: 'The whole gallery is watching the judge for a hint.', x: 94.2, y: 72.7, scale: 0.94, delay: 260, view: 'back' },
];

const allActors = [...leadActors, ...galleryActors];

const initialDialogue = {
  speaker: 'Adrian Cole',
  title: 'Defense Counsel',
  text: 'Select any character in the courtroom to inspect their role and hear a short line of dialogue.',
};

export default function App() {
  const [activeId, setActiveId] = useState<string>('defense-counsel');
  const [dialogue, setDialogue] = useState(initialDialogue);
  const [typedText, setTypedText] = useState('');

  const activeActor = useMemo(
    () => allActors.find((actor) => actor.id === activeId) ?? leadActors[5],
    [activeId],
  );

  useEffect(() => {
    setTypedText('');
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedText(dialogue.text.slice(0, index));
      if (index >= dialogue.text.length) {
        window.clearInterval(timer);
      }
    }, 22);

    return () => window.clearInterval(timer);
  }, [dialogue]);

  const handleInteract = (actor: Actor) => {
    setActiveId(actor.id);
    setDialogue({
      speaker: actor.name,
      title: actor.title,
      text: actor.dialogue,
    });
  };

  return (
    <main className="screen">
      <div className="app-window scene-enter">
        <header className="window-topbar">
          <div className="brand-area">
            <div className="brand-icon">⚖</div>
            <span className="brand-text">Stardew Courtroom</span>
          </div>
          <div className="window-title">Web</div>
          <div className="top-actions">
            <button className="top-tab" type="button">
              Court
            </button>
            <button className="top-tab" type="button">
              Evidence
            </button>
            <button className="top-close" type="button" aria-label="Close panel">
              ×
            </button>
          </div>
        </header>

        <section className="window-stage">
          <aside className="floating-panel left-panel">
            <div className="floating-icon">☰</div>
            <div>
              <div className="floating-title">Defense</div>
              <div className="floating-subtitle">Active Role</div>
            </div>
          </aside>

          <aside className="floating-panel right-panel">
            <div className="profile-avatar">A</div>
            <div>
              <div className="floating-title">Adrian Cole</div>
              <div className="floating-subtitle">Player Counsel</div>
            </div>
          </aside>

          <div className="courtroom-scene">
            <div className="scene-glow" />
            <div className="scene-walls" />
            <div className="side-column left" />
            <div className="side-column right" />
            <div className="frame frame-left-1" />
            <div className="frame frame-left-2" />
            <div className="frame frame-right-1" />
            <div className="frame frame-right-2" />
            <div className="seal" />
            <div className="flag">
              <div className="flag-pole" />
              <div className="flag-cloth" />
            </div>
            <div className="judge-bench">
              <div className="bench-surface" />
              <div className="bench-front">
                <div className="bench-emblem" />
              </div>
              <div className="bench-trim" />
            </div>
            <div className="trial-desk plaintiff-desk">
              <div className="desk-surface" />
              <div className="desk-front">
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="trial-desk defense-desk">
              <div className="desk-surface" />
              <div className="desk-front">
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="podium" />
            <div className="wood-rail left-rail" />
            <div className="wood-rail right-rail" />
            <div className="gallery-bench left-top" />
            <div className="gallery-bench left-bottom" />
            <div className="gallery-bench right-top" />
            <div className="gallery-bench right-bottom" />
            <div className="center-carpet" />
            {allActors.map((actor) => (
              <PixelActor
                key={actor.id}
                actor={actor}
                active={actor.id === activeId}
                onInteract={handleInteract}
              />
            ))}
          </div>

          <section className="dialogue-panel">
            <div className="dialogue-meta">
              <div className="dialogue-speaker">{dialogue.speaker}</div>
              <div className="dialogue-role">{dialogue.title}</div>
            </div>
            <p className="dialogue-text">{typedText}</p>
            <div className="dialogue-hint">Click another character to continue</div>
            <div className="active-pill">
              <span className="active-pill-label">Current focus</span>
              <span className="active-pill-value">{activeActor.name}</span>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function PixelActor({
  actor,
  active,
  onInteract,
}: {
  actor: Actor;
  active: boolean;
  onInteract: (actor: Actor) => void;
}) {
  const palette = getVariantPalette(actor.variant);

  const style = {
    left: `${actor.x}%`,
    top: `${actor.y}%`,
    '--actor-scale': String(actor.scale),
    '--actor-delay': `${actor.delay}ms`,
    '--skin': palette.skin,
    '--hair': palette.hair,
    '--outfit': palette.outfit,
    '--accent': palette.accent,
    '--shirt': palette.shirt,
  } as React.CSSProperties;

  return (
    <button
      className={`pixel-actor ${actor.view} ${active ? 'is-active' : ''}`}
      type="button"
      style={style}
      onClick={() => onInteract(actor)}
    >
      {active ? <div className="actor-alert">!</div> : null}
      <div className="actor-nameplate">
        <span>{actor.name}</span>
      </div>
      <div className="actor-sprite">
        <div className="actor-shadow" />
        <div className={`actor-head ${actor.variant === 'judge' ? 'judge-head' : ''}`}>
          <div className={`actor-hair ${actor.variant === 'judge' ? 'judge-wig' : ''}`} />
          {actor.view === 'front' ? (
            <div className="actor-face">
              <span className="eye left" />
              <span className="eye right" />
              <span className="blush left" />
              <span className="blush right" />
            </div>
          ) : null}
        </div>
        <div className={`actor-body ${actor.variant === 'judge' ? 'judge-body' : ''}`}>
          <div className="actor-shirt" />
          {actor.variant === 'judge' ? (
            <>
              <div className="robe-band left" />
              <div className="robe-band right" />
            </>
          ) : (
            <>
              <div className="lapel left" />
              <div className="lapel right" />
              <div className="actor-tie" />
            </>
          )}
        </div>
        {actor.player ? <div className="player-indicator" /> : null}
      </div>
    </button>
  );
}

function getVariantPalette(variant: CharacterVariant) {
  switch (variant) {
    case 'judge':
      return {
        skin: '#d8b49a',
        hair: '#e9e5df',
        outfit: '#2f2345',
        accent: '#d9a23a',
        shirt: '#ede6d8',
      };
    case 'plaintiffCounsel':
      return {
        skin: '#f3c6a1',
        hair: '#ff9d42',
        outfit: '#3f86c9',
        accent: '#f0d274',
        shirt: '#f8f5f0',
      };
    case 'plaintiff':
      return {
        skin: '#d0a48f',
        hair: '#5a3427',
        outfit: '#5b4b74',
        accent: '#d24a43',
        shirt: '#f8f5f0',
      };
    case 'clerk':
      return {
        skin: '#e2ba94',
        hair: '#7a4335',
        outfit: '#7f8ca8',
        accent: '#d9b14f',
        shirt: '#f8f5f0',
      };
    case 'defendant':
      return {
        skin: '#c79a86',
        hair: '#352133',
        outfit: '#524071',
        accent: '#a15577',
        shirt: '#f8f5f0',
      };
    case 'defenseCounsel':
      return {
        skin: '#efc39f',
        hair: '#f0b54f',
        outfit: '#365ba6',
        accent: '#cf3238',
        shirt: '#f8f5f0',
      };
    case 'spectatorBlonde':
      return {
        skin: '#efc39f',
        hair: '#f3d06f',
        outfit: '#d6862b',
        accent: '#f3d06f',
        shirt: '#ecdcc9',
      };
    case 'spectatorOrange':
      return {
        skin: '#d6a48a',
        hair: '#ef7f2d',
        outfit: '#a9562b',
        accent: '#ef7f2d',
        shirt: '#ecdcc9',
      };
    case 'spectatorGray':
      return {
        skin: '#d3b19a',
        hair: '#e7e1dc',
        outfit: '#7e6a58',
        accent: '#c7b099',
        shirt: '#ecdcc9',
      };
    case 'spectatorPurple':
      return {
        skin: '#c49386',
        hair: '#5b3c6e',
        outfit: '#6f4b6d',
        accent: '#8b71a0',
        shirt: '#ecdcc9',
      };
    case 'spectatorDark':
      return {
        skin: '#a97862',
        hair: '#1f1d28',
        outfit: '#303449',
        accent: '#61708b',
        shirt: '#ecdcc9',
      };
    default:
      return {
        skin: '#c79775',
        hair: '#7d4b2d',
        outfit: '#8d5b2a',
        accent: '#c48a34',
        shirt: '#ecdcc9',
      };
  }
}
