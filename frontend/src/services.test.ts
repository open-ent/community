import { describe, expect, it } from 'vitest';

import { actionsForRole, availableServices, buildTexts, mergePages, servicesToCreate, SERVICES } from './services';

describe('availableServices', () => {
  it("propose l'accueil toujours, les autres selon les droits", () => {
    const wf = new Set(['org.entcore.blog.controllers.BlogController|create']);
    expect(availableServices(wf).map((s) => s.name)).toEqual(['home', 'blog']);
    expect(availableServices(new Set()).map((s) => s.name)).toEqual(['home']);
  });
});

describe('mergePages / servicesToCreate', () => {
  const page = (n: string) => ({ title: n, titleLink: n });
  it('crée uniquement les services actifs sans page', () => {
    expect(servicesToCreate([page('home')], ['home', 'blog', 'wiki'])).toEqual(['blog', 'wiki']);
  });
  it('retire la page d\'un service désactivé, garde les pages libres, ajoute les nouvelles', () => {
    const existing = [page('home'), page('blog'), page('ma-page-libre')];
    const out = mergePages(existing, ['home', 'forum'], { forum: page('forum') });
    expect(out.map((p) => p.titleLink)).toEqual(['home', 'ma-page-libre', 'forum']);
  });
  it('liste les 5 services dans l\'ordre historique', () => {
    expect(SERVICES.map((s) => s.name)).toEqual(['home', 'blog', 'documents', 'wiki', 'forum']);
  });
});

describe('actionsForRole', () => {
  const actions = [
    { name: ['blog.read'], displayName: 'blog.read' },
    { name: ['blog.contrib'], displayName: 'blog.contrib' },
    { name: ['blog.manager'], displayName: 'blog.manager' },
  ];
  const config = { read: { requires: [] }, contrib: { requires: ['read'] }, manager: { requires: ['read', 'contrib'] } };
  it('lecteur : lecture seule', () => expect(actionsForRole('read', config, actions)).toEqual(['blog.read']));
  it('contributeur : lecture + contribution', () => expect(actionsForRole('contrib', config, actions).sort()).toEqual(['blog.contrib', 'blog.read']));
  it('gestionnaire : tout', () => expect(actionsForRole('manager', config, actions)).toHaveLength(3));
});

describe('buildTexts', () => {
  it('insère le nom de la communauté', () => {
    const t = (k: string) => (k.includes('forum.category') ? 'Forum de {0}' : k);
    const tx = buildTexts(t, 'Club');
    expect(tx.forumCategory).toBe('Forum de Club');
    expect(tx.blogTitle).toContain('Club');
    expect(tx.titles.blog).toBe('community.services.blog.name');
  });
});
