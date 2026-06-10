'use strict';

/**
 * CV PDF — thème "éditeur de code" (VS Code dark).
 *
 * Rendu : fenêtre macOS (feux tricolores) + onglet `paul-richez.ts`, gouttière
 * de numéros de ligne, le CV présenté comme un objet TypeScript avec coloration
 * syntaxique, avatar flottant en haut à droite, barre de statut style IDE.
 *
 * Module PUR (aucune dépendance Strapi). Police code = Courier (monospace
 * intégré, dispo partout au runtime, encodage WinAnsi → pas de flèches/—).
 * Pas de letterSpacing (bug react-pdf). Liens cliquables stylés comme strings.
 *
 * Objectif : tenir sur UNE page. Contenu condensé (comment d'en-tête par
 * expérience + descriptions jointes qui exploitent la largeur) au lieu d'une
 * puce par ligne.
 */
const path = require('path');
const fs = require('fs');
const React = require('react');
const {
  Document, Page, View, Text, Link, Image, Font, StyleSheet,
} = require('@react-pdf/renderer');

const h = React.createElement;

/* ---- Police UI (chrome). Le code reste en Courier. ---- */
let UIFONT = 'Helvetica';
try {
  const pmuDir = path.dirname(require.resolve('pdfmake-unicode/package.json'));
  const fdir = path.join(pmuDir, 'src', 'fonts', 'Arial GEO');
  Font.register({
    family: 'Roboto',
    fonts: [
      { src: path.join(fdir, 'Roboto-Regular.ttf'), fontWeight: 400 },
      { src: path.join(fdir, 'Roboto-Medium.ttf'), fontWeight: 500 },
      { src: path.join(fdir, 'Roboto-Medium.ttf'), fontWeight: 700 },
    ],
  });
  UIFONT = 'Roboto';
} catch (e) {
  console.warn('CV: police Roboto introuvable, fallback Helvetica —', (e as Error).message);
}
try { Font.registerHyphenationCallback((w: string) => [w]); } catch (e) { /* noop */ }

const MONO = 'Courier';

/* ---- Couleurs ---- */
// Thème clair "Light+" de VS Code.
const UI = {
  desktop: '#dfe1e4', editor: '#ffffff', titlebar: '#e4e4e4', tabbar: '#f3f3f3',
  border: '#c8c8c8', accent: '#007acc', muted: '#5a5a5a', gutter: '#a3a3a3',
};
const COL: Record<string, string> = {
  kw: '#0000ff', var: '#001080', type: '#267f99', key: '#0451a5',
  str: '#a31515', num: '#098658', punc: '#000000', com: '#008000',
};

const S = StyleSheet.create({
  page: { backgroundColor: UI.desktop, padding: 16 },
  // overflow hidden : les enfants (titlebar/statusbar) sont clippés par le radius
  // du parent — pas de radius propre, sinon liserés/crénelage aux coins.
  win: {
    flex: 1, backgroundColor: UI.editor, borderRadius: 8,
    borderWidth: 1, borderColor: UI.border, position: 'relative', overflow: 'hidden',
  },

  titlebar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: UI.titlebar,
    height: 24, paddingHorizontal: 12,
  },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 7 },
  winTitle: { flex: 1, textAlign: 'center', color: UI.muted, fontSize: 8, fontFamily: UIFONT },
  winTitleSpacer: { width: 46 },

  tabbar: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: UI.tabbar, height: 26 },
  tab: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: UI.editor,
    paddingHorizontal: 12, borderTopWidth: 2, borderTopColor: UI.accent,
  },
  tabInactive: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: UI.tabbar,
    paddingHorizontal: 12, borderTopWidth: 2, borderTopColor: 'transparent',
  },
  tsIcon: { width: 13, height: 13, borderRadius: 2, backgroundColor: '#3178c6', alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  tsIconTxt: { color: '#ffffff', fontSize: 6, fontFamily: UIFONT, fontWeight: 700 },
  tabTxt: { color: '#d4d4d4', fontSize: 8, fontFamily: UIFONT },
  tabTxtInactive: { color: '#6e7681', fontSize: 8, fontFamily: UIFONT },
  tabClose: { color: UI.muted, fontSize: 9, marginLeft: 10 },

  editor: { flex: 1, paddingTop: 10, paddingBottom: 8, paddingRight: 16, backgroundColor: UI.editor },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  gutter: { width: 30, textAlign: 'right', paddingRight: 12, color: UI.gutter, fontSize: 7, fontFamily: MONO, lineHeight: 1.33 },
  code: { flex: 1, fontSize: 7.5, fontFamily: MONO, color: COL.punc, lineHeight: 1.33 },

  statusbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: UI.accent, height: 17, paddingHorizontal: 12,
  },
  stTxt: { color: '#ffffff', fontSize: 6.8, fontFamily: UIFONT },

  // Photo pré-détourée en PNG transparent (sharp) : aucun clip react-pdf,
  // l'anti-aliasing est dans l'image → bord net.
  avatarImg: { position: 'absolute', top: 58, right: 22, width: 64, height: 64 },
  avatar: { position: 'absolute', top: 58, right: 22, width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: UI.accent, objectFit: 'cover' },
  avatarBox: { position: 'absolute', top: 58, right: 22, width: 64, height: 64, borderRadius: 32, backgroundColor: '#e8e8e8', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: UI.accent },
  avatarTxt: { color: '#3a3a3a', fontSize: 21, fontFamily: UIFONT, fontWeight: 700 },
});

/* ---- Helpers données ---- */
function calcAge(birth: string) {
  if (!birth) return null;
  const t = new Date(); const b = new Date(birth);
  if (isNaN(b.getTime())) return null;
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a;
}
function yearOf(d: string) {
  if (!d) return '';
  const n = new Date(d).getFullYear();
  return isNaN(n) ? String(d).slice(0, 4) : String(n);
}
function dateRange(start: string, end: string) {
  const sy = yearOf(start);
  if (!sy) return '';
  if (!end) return `${sy} - now`;
  const ey = yearOf(end);
  return sy === ey ? sy : `${sy} - ${ey}`;
}
export function langLabel(v: number) {
  if (v == null) return 'notions';
  if (v >= 95) return 'natif'; if (v >= 85) return 'courant'; if (v >= 70) return 'avancé';
  if (v >= 50) return 'intermédiaire'; if (v >= 30) return 'notions'; return 'débutant';
}
// Regroupe les compétences en familles compactes (front / back / ai / tools / legacy).
export function bucketSkills(skills: any[]) {
  const map: Record<string, string> = {
    frontend_languages: 'frontend', frontend_frameworks: 'frontend', frontend_libraries: 'frontend',
    backend: 'backend', databases: 'tools', devops_tools: 'tools', tools: 'tools',
    ai: 'ai', other_languages: 'legacy',
  };
  const order = ['frontend', 'backend', 'ai', 'tools', 'legacy'];
  const out: Record<string, string[]> = {};
  skills.forEach((s) => {
    const cat = s.coding?.category || 'tools';
    const k = map[cat] || 'tools';
    const n = s.coding?.name;
    if (n) (out[k] = out[k] || []).push(n);
  });
  return order.filter((k) => out[k]).map((k) => ({ key: k, vals: out[k] }));
}
const httpify = (u: string) => (!u ? u : (u.startsWith('http') ? u : `https://${u}`));
const strip = (u: string) => (u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
const initials = (me: any) => `${(me.firstName || ' ')[0]}${(me.lastName || ' ')[0]}`.toUpperCase();
function joinDesc(e: any) {
  const arr = Array.isArray(e.descriptions) ? e.descriptions : (e.descriptions ? [e.descriptions] : []);
  return arr.filter(Boolean).map((d: any) => String(d).replace(/\.$/, '')).join(' · ');
}

/* ---- Construction des lignes de code ---- */
export type Span = { t: string; c: string; href?: string };
export type CodeLine = { indent: number; spans: Span[] };

export function buildLines(me: any): CodeLine[] {
  const lines: CodeLine[] = [];
  const sp = (t: string, c = 'punc'): Span => ({ t, c });
  const str = (t: string): Span => ({ t: `"${t}"`, c: 'str' });
  const lnk = (t: string, href: string): Span => ({ t: `"${t}"`, c: 'str', href });
  const push = (indent: number, ...spans: Span[]) => lines.push({ indent, spans });
  const blank = () => lines.push({ indent: 0, spans: [] });
  const kv = (indent: number, key: string, val: Span) =>
    push(indent, sp(key, 'key'), sp(': '), val, sp(','));

  const name = `${me.firstName || ''} ${me.lastName || ''}`.trim();
  const role = me.postName || 'Développeur';
  const age = calcAge(me.birthDay);

  /* en-tête commentaire */
  push(0, sp('/**', 'com'));
  push(0, sp(` * ${name} · ${role}`, 'com'));
  const sub = [me.city, age ? `${age} ans` : null].filter(Boolean).join(' · ');
  if (sub) push(0, sp(` * ${sub}`, 'com'));
  if (me.website) push(0, sp(` * @see ${strip(me.website)}`, 'com'));
  push(0, sp(' */', 'com'));
  blank();

  push(0, sp('const ', 'kw'), sp('paul', 'var'), sp(': '), sp('Developer', 'type'), sp(' = '), sp('{'));

  kv(1, 'name', str(name));
  kv(1, 'role', str(role));
  if (me.city) kv(1, 'location', str(me.city));
  if (age) push(1, sp('age', 'key'), sp(': '), sp(String(age), 'num'), sp(','));
  blank();

  /* contact */
  push(1, sp('contact', 'key'), sp(': '), sp('{'));
  if (me.email) kv(2, 'email', lnk(me.email, `mailto:${me.email}`));
  if (me.phoneNumber) kv(2, 'phone', str(me.phoneNumber));
  if (me.github) kv(2, 'github', lnk(strip(me.github), httpify(me.github)));
  if (me.linkedin) kv(2, 'linkedin', lnk(strip(me.linkedin), httpify(me.linkedin)));
  if (me.website) kv(2, 'website', lnk(strip(me.website), httpify(me.website)));
  push(1, sp('},'));
  blank();

  /* experience — 2 lignes par poste : commentaire + descriptions jointes */
  const exps = (me.experiences || []).filter(Boolean);
  if (exps.length) {
    push(1, sp('experience', 'key'), sp(': '), sp('['));
    exps.forEach((e: any) => {
      const head = `// ${dateRange(e.startDate, e.endDate)} · ${e.business || ''} · ${e.title || ''}`;
      push(2, sp(head, 'com'));
      const desc = joinDesc(e);
      if (desc) push(2, str(desc), sp(','));
    });
    push(1, sp('],'));
    blank();
  }

  /* skills — familles regroupées, arrays qui exploitent la largeur */
  const buckets = bucketSkills(me.coding_skills || []);
  if (buckets.length) {
    push(1, sp('skills', 'key'), sp(': '), sp('{'));
    buckets.forEach(({ key, vals }) => {
      const spans: Span[] = [sp(key, 'key'), sp(': '), sp('[')];
      vals.forEach((n, idx) => { spans.push(str(n)); if (idx < vals.length - 1) spans.push(sp(', ')); });
      spans.push(sp('],'));
      push(2, ...spans);
    });
    push(1, sp('},'));
    blank();
  }

  /* education */
  const dips = (me.diplomas || []).filter(Boolean);
  if (dips.length) {
    push(1, sp('education', 'key'), sp(': '), sp('['));
    dips.forEach((d: any) => {
      const label = [yearOf(d.endDate || d.startDate), d.title, d.description]
        .filter(Boolean).join(' · ');
      push(2, str(label), sp(','));
    });
    push(1, sp('],'));
    blank();
  }

  /* languages */
  const langs = (me.languages || []).filter(Boolean);
  if (langs.length) {
    const spans: Span[] = [sp('languages', 'key'), sp(': '), sp('[')];
    langs.forEach((l: any, idx: number) => {
      spans.push(str(`${l.name} (${langLabel(l.value)})`));
      if (idx < langs.length - 1) spans.push(sp(', '));
    });
    spans.push(sp('],'));
    push(1, ...spans);
  }

  push(0, sp('};'));
  blank();
  push(0, sp('export default', 'kw'), sp(' paul'), sp(';'),
    sp('   // ', 'com'), sp('disponible · open to work', 'com'));

  return lines;
}

/** Rend les lignes en texte brut (2 espaces d'indentation) — pour le fichier `cv/paul-richez.ts` du VFS. */
export function linesToText(lines: CodeLine[]): string {
  return lines.map((l) => '  '.repeat(l.indent) + l.spans.map((s) => s.t).join('')).join('\n');
}

/* ---- Rendu ---- */
function renderLine(ln: CodeLine, i: number) {
  const codeChildren = ln.spans.length
    ? ln.spans.map((s, j) => (s.href
      ? h(Link, { key: j, src: s.href, style: { color: COL[s.c] || s.c, textDecoration: 'none' } }, s.t)
      : h(Text, { key: j, style: { color: COL[s.c] || s.c } }, s.t)))
    : ' ';
  return h(View, { key: i, style: S.row },
    h(Text, { style: S.gutter }, String(i + 1)),
    h(Text, { style: [S.code, { marginLeft: ln.indent * 13 }] }, codeChildren),
  );
}

function Avatar(me: any) {
  // Photo pré-traitée (ronde + anneau, PNG transparent) — voir prepareCvPhoto().
  if (me._photoPng) {
    return h(Image, { style: S.avatarImg, src: { data: me._photoPng, format: 'png' } });
  }
  // Fallback sans sharp : clip react-pdf (bord moins net).
  if (me._photoSrc) {
    try {
      const data = fs.readFileSync(me._photoSrc);
      const lower = String(me._photoSrc).toLowerCase();
      const format = lower.endsWith('.png') ? 'png' : 'jpg';
      return h(Image, { style: S.avatar, src: { data, format } });
    } catch (e) { /* illisible → initiales */ }
  }
  return h(View, { style: S.avatarBox }, h(Text, { style: S.avatarTxt }, initials(me)));
}

/**
 * Détoure la photo en cercle haute résolution (512px) avec anneau accent,
 * anti-aliasing inclus dans le PNG. Retourne un Buffer PNG, ou null si
 * sharp indisponible / photo illisible (l'appelant retombe sur _photoSrc).
 */
export async function prepareCvPhoto(srcPath: string) {
  if (!srcPath) return null;
  try {
    const sharp = require('sharp');
    const size = 320; const c = size / 2; const ring = 10; const pad = 6; // marge transparente : l'anneau ne touche pas le bord du canvas
    const R = c - pad;
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${c}" cy="${c}" r="${R}" fill="#fff"/></svg>`);
    const ringSvg = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${c}" cy="${c}" r="${R - ring / 2}" fill="none" stroke="${UI.accent}" stroke-width="${ring}"/></svg>`);
    const square = await sharp(srcPath).resize(size, size, { fit: 'cover' }).png().toBuffer();
    return await sharp(square)
      .composite([{ input: mask, blend: 'dest-in' }, { input: ringSvg }])
      .png()
      .toBuffer();
  } catch (e) {
    console.warn('CV: détourage photo impossible —', (e as Error).message);
    return null;
  }
}

function TitleBar() {
  return h(View, { style: S.titlebar },
    h(View, { style: [S.dot, { backgroundColor: '#ff5f56' }] }),
    h(View, { style: [S.dot, { backgroundColor: '#ffbd2e' }] }),
    h(View, { style: [S.dot, { backgroundColor: '#27c93f', marginRight: 0 }] }),
    h(Text, { style: S.winTitle }, 'paul-richez.ts — Visual Studio Code'),
    h(View, { style: S.winTitleSpacer }),
  );
}

function TabBar() {
  return h(View, { style: S.tabbar },
    h(View, { style: S.tab },
      h(View, { style: S.tsIcon }, h(Text, { style: S.tsIconTxt }, 'TS')),
      h(Text, { style: S.tabTxt }, 'paul-richez.ts'),
      h(Text, { style: S.tabClose }, '×'),
    ),
    h(View, { style: S.tabInactive },
      h(Text, { style: S.tabTxtInactive }, 'README.md'),
      h(Text, { style: S.tabClose }, '×'),
    ),
  );
}

function StatusBar(lineCount: number) {
  return h(View, { style: S.statusbar },
    h(Text, { style: S.stTxt }, 'main • disponible'),
    h(Text, { style: S.stTxt }, `Ln ${lineCount}, Col 1   Spaces: 2   UTF-8   LF   TypeScript`),
  );
}

/* ---- Document ---- */
export function buildCvDocument(me: any) {
  if (!me) throw new Error('Données CV manquantes');
  const fullName = `${me.firstName || ''} ${me.lastName || ''}`.trim();
  const lines = buildLines(me);

  return h(Document, { title: `${fullName} — CV`, author: fullName, creator: fullName },
    h(Page, { size: 'A4', style: S.page },
      h(View, { style: S.win },
        TitleBar(),
        TabBar(),
        h(View, { style: S.editor }, lines.map(renderLine)),
        StatusBar(lines.length),
        Avatar(me),
      ),
    ),
  );
}
