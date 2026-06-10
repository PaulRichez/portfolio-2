'use strict';

/**
 * Système de fichiers virtuel du portfolio.
 * Génère un arbre + le contenu de chaque fichier depuis les données Strapi
 * (me + experiences + projects). Consommé par le front (explorer + éditeur)
 * ET, à terme, par les tools de l'assistant IA.
 *
 * Réutilise le générateur du CV PDF (`buildLines` + `linesToText`) pour que
 * `cv/paul-richez.ts` soit identique au PDF.
 */
const { buildLines, linesToText, bucketSkills, langLabel } = require('./cv-document');

type FileLanguage = 'markdown' | 'typescript' | 'json' | 'dotenv' | 'pdf' | 'text';
interface VfsFile { path: string; language: FileLanguage; content: string; }
interface VfsNode { name: string; path: string; type: 'dir' | 'file'; children?: VfsNode[]; }

const CACHE_TTL = 5 * 60 * 1000;
let cache: { at: number; payload: { tree: VfsNode[]; files: VfsFile[] } } | null = null;

/* ---- Helpers ---- */
const slugify = (s: string) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';

const yearOf = (d: string) => {
  if (!d) return '';
  const n = new Date(d).getFullYear();
  return isNaN(n) ? String(d).slice(0, 4) : String(n);
};
const period = (s: string, e: string) => {
  const sy = yearOf(s); if (!sy) return '';
  return e ? (yearOf(e) === sy ? sy : `${sy} → ${yearOf(e)}`) : `${sy} → aujourd'hui`;
};
const descList = (d: any): string[] =>
  Array.isArray(d) ? d.filter(Boolean) : (d ? [d] : []);
const strip = (u: string) => (u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
const httpify = (u: string) => (!u ? '' : (u.startsWith('http') ? u : `https://${u}`));

function languageOf(path: string): FileLanguage {
  if (path.endsWith('.md')) return 'markdown';
  if (path.endsWith('.ts')) return 'typescript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.pdf')) return 'pdf';
  if (path.endsWith('.env') || path.startsWith('.env')) return 'dotenv';
  return 'text';
}

/* ---- Générateurs de contenu ---- */
function readmeMd(me: any, cvUrl: string): string {
  const name = `${me.firstName || ''} ${me.lastName || ''}`.trim();
  return `# 👋 ${name}

**${me.postName || 'Développeur'}**${me.city ? ` — ${me.city}, France` : ''}

Bienvenue dans mon portfolio, présenté comme mon outil de travail quotidien : un éditeur de code.

## 🧭 Comment naviguer

- **Explorateur** (à gauche) : parcourez mes projets, mon expérience et mes compétences comme des fichiers.
- **Assistant IA** (à droite) : posez vos questions, il lira les fichiers pour vous.
- **Thème** : icône palette dans la barre de gauche — clair, sombre ou auto.

## ⚡ Raccourcis

| | |
|---|---|
| 📄 **CV** | [Télécharger le PDF](${cvUrl}) — ou ouvrez \`cv/paul-richez.ts\` |
| 🚀 **Projets** | dossier \`projects/\` |
| 💼 **Parcours** | dossier \`experience/\` |
| ✉️ **Contact** | [${me.email}](mailto:${me.email}) — ou \`contact.md\` |

---

*Site généré depuis mes données Strapi — chaque fichier de l'explorateur est réel.*
`;
}

function contactMd(me: any): string {
  const rows: string[] = [];
  if (me.email) rows.push(`| Email | [${me.email}](mailto:${me.email}) |`);
  if (me.github) rows.push(`| GitHub | [${strip(me.github)}](${httpify(me.github)}) |`);
  if (me.linkedin) rows.push(`| LinkedIn | [${strip(me.linkedin)}](${httpify(me.linkedin)}) |`);
  if (me.website) rows.push(`| Site | [${strip(me.website)}](${httpify(me.website)}) |`);
  return `# ✉️ Contact

| Canal | Lien |
|---|---|
${rows.join('\n')}

📍 ${me.city || 'France'}
`;
}

const ENV_CONTENT = `# ⚠️ Ne jamais committer ce fichier
API_KEY=hunter2
HIRE_ME=true
COFFEE_LEVEL=critical
BUGS_PRODUCED=0        # citation needed
IMPOSTER_SYNDROME=false
`;

function skillsJson(me: any): string {
  const out: Record<string, any> = {};
  for (const { key, vals } of bucketSkills(me.coding_skills || [])) out[key] = vals;
  const langs: Record<string, string> = {};
  (me.languages || []).forEach((l: any) => { if (l?.name) langs[l.name.toLowerCase()] = langLabel(l.value); });
  if (Object.keys(langs).length) out.languages = langs;
  return JSON.stringify(out, null, 2);
}

function experienceMd(e: any): string {
  const name = e.business || e.title || 'Expérience';
  const lines: string[] = [`# ${name} — ${e.title || ''}`.trim(), ''];
  const meta = [period(e.startDate, e.endDate), e.businessWebsite ? `[${strip(e.businessWebsite)}](${httpify(e.businessWebsite)})` : '']
    .filter(Boolean).join(' · ');
  if (meta) lines.push(`**${meta}**`, '');
  const desc = descList(e.descriptions);
  desc.forEach((d) => lines.push(`- ${String(d).replace(/\.$/, '')}`));
  return lines.join('\n') + '\n';
}

function educationMd(d: any): string {
  const school = d.description || d.title || 'Formation';
  const lines: string[] = [`# 🎓 ${school}`, ''];
  if (d.title && d.title !== school) lines.push(`**${d.title}**`, '');
  const p = period(d.startDate, d.endDate);
  if (p) lines.push(p);
  return lines.join('\n') + '\n';
}

function projectMd(p: any): string {
  const lines: string[] = [`# ${p.title || 'Projet'}`, ''];
  if (p.image) lines.push(`![${p.title || ''}](${p.image})`, '');
  if (p.description) lines.push(String(p.description).trim(), '');
  const techs = (p.codings || []).map((c: any) => c.name).filter(Boolean);
  if (techs.length) lines.push('## Stack', '', techs.join(' · '), '');
  const links: string[] = [];
  if (p.link_demo) links.push(`- [🔗 Démo](${httpify(p.link_demo)})`);
  if (p.github_link) links.push(`- [💻 Code source](${httpify(p.github_link)})`);
  if (p.link_npm) links.push(`- [📦 npm](${httpify(p.link_npm)})`);
  if (links.length) lines.push('## Liens', '', ...links, '');
  return lines.join('\n');
}

/* ---- Arbre ---- */
function buildTree(paths: string[]): VfsNode[] {
  const root: VfsNode[] = [];
  for (const full of paths) {
    const parts = full.split('/');
    let level = root;
    let prefix = '';
    parts.forEach((part, i) => {
      prefix = prefix ? `${prefix}/${part}` : part;
      if (i === parts.length - 1) {
        level.push({ name: part, path: full, type: 'file' });
      } else {
        let dir = level.find((n) => n.type === 'dir' && n.name === part);
        if (!dir) { dir = { name: part, path: prefix, type: 'dir', children: [] }; level.push(dir); }
        level = dir.children!;
      }
    });
  }
  sortLevel(root);
  return root;
}
function sortLevel(nodes: VfsNode[]): void {
  nodes.sort((a, b) =>
    a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : a.name.localeCompare(b.name));
  nodes.forEach((n) => n.children && sortLevel(n.children));
}

/* ---- Service ---- */
export default ({ strapi }: { strapi: any }) => ({

  async getVfs(force = false) {
    const now = Date.now();
    if (!force && cache && now - cache.at < CACHE_TTL) return cache.payload;

    // me peut être null si le single type n'est pas encore seedé (premier start) → {}.
    const me: any = (await strapi.service('api::me.cv').getCvData()) || {};
    const projects: any[] = (await strapi.entityService.findMany('api::project.project', {
      populate: { codings: true },
      sort: { ranking: 'asc' },
    })) || [];

    const base = strapi.config.get('server.url', '') || 'http://localhost:1337';
    const cvUrl = `${base}/api/me/cv`;
    const files: VfsFile[] = [];
    const add = (path: string, content: string) =>
      files.push({ path, language: languageOf(path), content });

    add('README.md', readmeMd(me, cvUrl));
    add('contact.md', contactMd(me));
    add('.env', ENV_CONTENT);
    add('skills.json', skillsJson(me));
    add('cv/paul-richez.ts', linesToText(buildLines(me)));
    add('cv/cv.pdf', ''); // rendu via iframe côté front

    const usedExp = new Set<string>();
    (me.experiences || []).forEach((e: any) => {
      let slug = slugify(e.business || e.title);
      while (usedExp.has(slug)) slug += '-1';
      usedExp.add(slug);
      add(`experience/${slug}.md`, experienceMd(e));
    });

    const usedProj = new Set<string>();
    (projects || []).forEach((p: any) => {
      let slug = slugify(p.title);
      while (usedProj.has(slug)) slug += '-1';
      usedProj.add(slug);
      add(`projects/${slug}.md`, projectMd(p));
    });

    const usedEdu = new Set<string>();
    (me.diplomas || []).filter(Boolean).forEach((d: any) => {
      let slug = slugify(d.description || d.title);
      while (usedEdu.has(slug)) slug += '-1';
      usedEdu.add(slug);
      add(`education/${slug}.md`, educationMd(d));
    });

    const payload = { tree: buildTree(files.map((f) => f.path)), files };
    cache = { at: now, payload };
    return payload;
  },
});
