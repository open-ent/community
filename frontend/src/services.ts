/**
 * Services d'une communauté (accueil, blog, documents, cours/wiki, forum) : chaque service actif a une page dédiée
 * dans le site de la communauté. Port de `model/apps.ts` + `model/website.ts` (AngularJS) : création de la ressource
 * de l'application voisine, ajout de la page, puis partage de la ressource avec les groupes de la communauté.
 */
import { jsonRequest, putForm } from './api';

export type ServiceName = 'home' | 'blog' | 'documents' | 'wiki' | 'forum';

export interface ServiceDef {
  name: ServiceName;
  mandatory?: boolean;
  /** Droit d'action (workflow) nécessaire pour créer la ressource du service. */
  workflow: string;
  template: string;
}

export const SERVICES: ServiceDef[] = [
  { name: 'home', mandatory: true, workflow: 'net.atos.entng.community.controllers.CommunityController|create', template: 'message' },
  { name: 'blog', workflow: 'org.entcore.blog.controllers.BlogController|create', template: 'articles' },
  { name: 'documents', workflow: 'org.entcore.workspace.controllers.WorkspaceController|addDocument', template: 'documents' },
  { name: 'wiki', workflow: 'net.atos.entng.wiki.controllers.WikiController|createWiki', template: 'wiki' },
  { name: 'forum', workflow: 'net.atos.entng.forum.controllers.ForumController|createCategory', template: 'forum' },
];

/** Services proposés à l'utilisateur : ceux dont il a le droit de créer la ressource (l'accueil est toujours là). */
export function availableServices(workflows: Set<string>): ServiceDef[] {
  return SERVICES.filter((s) => s.mandatory || workflows.has(s.workflow));
}

/** Droits d'action de l'utilisateur (`authorizedActions` de la session). */
export async function getWorkflows(): Promise<Set<string>> {
  const me = await jsonRequest<{ authorizedActions?: Array<{ name: string }> }>('GET', '/auth/oauth2/userinfo');
  return new Set((me?.authorizedActions ?? []).map((a) => a.name));
}

/** Source d'une page : le « sniplet » de l'application qui affiche le service. */
export interface PageSource {
  application: string;
  template: string;
  source: unknown;
}
export interface CommunityPage {
  title: string;
  titleLink: string;
  source?: PageSource;
  [extra: string]: unknown;
}

/** Textes injectés dans les ressources créées (traduits par l'appelant). */
export interface ServiceTexts {
  blogTitle: string;
  blogFirstPostTitle: string;
  blogFirstPostContent: string;
  wikiTitle: string;
  wikiHomeTitle: string;
  wikiHomeContent: string;
  forumCategory: string;
  forumSubject: string;
  forumFirstMessage: string;
  /** Titre de la page de chaque service (nom traduit du service). */
  titles: Record<ServiceName, string>;
}

/** Textes des ressources créées, traduits : `t` est la fonction i18n, `name` le nom de la communauté (remplace `{0}`). */
export function buildTexts(t: (key: string) => string, name: string): ServiceTexts {
  const withName = (s: string) => s.replace(/\{0\}/g, name);
  return {
    blogTitle: `${t('community.services.blog.pretitle')} ${name}`,
    blogFirstPostTitle: t('community.services.blog.firstpost.title'),
    blogFirstPostContent: t('community.services.blog.firstpost.content'),
    wikiTitle: `${t('community.services.wiki.pretitle')} ${name}`,
    wikiHomeTitle: t('community.services.wiki.homepage.title'),
    wikiHomeContent: t('community.services.wiki.homepage.content'),
    forumCategory: withName(t('community.services.forum.category.title')),
    forumSubject: t('community.services.forum.subject.title'),
    forumFirstMessage: withName(t('community.services.forum.first.message')),
    titles: {
      home: t('community.services.home.name'),
      blog: t('community.services.blog.name'),
      documents: t('community.services.documents.name'),
      wiki: t('community.services.wiki.name'),
      forum: t('community.services.forum.name'),
    },
  };
}

export interface CommunityContext {
  name: string;
  description?: string;
  icon?: string;
  homeMessage: string;
}

/** Crée la ressource de l'application voisine et renvoie la source de la page du service. */
export async function generateSource(service: ServiceName, ctx: CommunityContext, tx: ServiceTexts): Promise<PageSource> {
  switch (service) {
    case 'home':
      return { application: 'community', template: 'message', source: { content: ctx.homeMessage } };
    case 'documents':
      return { application: 'workspace', template: 'documents', source: { documents: [] } };
    case 'blog': {
      const blog = await jsonRequest<{ _id: string }>('POST', '/blog', {
        title: tx.blogTitle,
        thumbnail: ctx.icon || '',
        description: ctx.description || '',
        'comment-type': 'IMMEDIATE',
      });
      const post = await jsonRequest<{ _id: string }>('POST', `/blog/post/${blog._id}`, { title: tx.blogFirstPostTitle, content: tx.blogFirstPostContent });
      await jsonRequest('PUT', `/blog/post/publish/${blog._id}/${post._id}`, {});
      return { application: 'blog', template: 'articles', source: { _id: blog._id } };
    }
    case 'wiki': {
      const wiki = await jsonRequest<{ _id: string }>('POST', '/wiki', { title: tx.wikiTitle });
      await jsonRequest('POST', `/wiki/${wiki._id}/page`, { isIndex: true, isVisible: true, title: tx.wikiHomeTitle, content: tx.wikiHomeContent });
      return { application: 'wiki', template: 'wiki', source: { _id: wiki._id } };
    }
    case 'forum': {
      const category = await jsonRequest<{ _id: string }>('POST', '/forum/categories', { name: tx.forumCategory });
      const subject = await jsonRequest<{ _id: string }>('POST', `/forum/category/${category._id}/subjects`, { title: tx.forumSubject });
      await jsonRequest('POST', `/forum/category/${category._id}/subject/${subject._id}/messages`, { content: tx.forumFirstMessage });
      return { application: 'forum', template: 'forum', source: { _id: category._id } };
    }
  }
}

/**
 * Pages résultantes quand `active` est la liste des services voulus : on garde les pages existantes des services
 * encore actifs, on retire celles des services désactivés, et on ajoute (via `fresh`) les nouvelles.
 * Les pages qui ne correspondent à aucun service (ex. pages libres) sont conservées telles quelles.
 */
export function mergePages(existing: CommunityPage[], active: ServiceName[], fresh: Partial<Record<ServiceName, CommunityPage>>): CommunityPage[] {
  const known = new Set<string>(SERVICES.map((s) => s.name));
  const kept = existing.filter((p) => !known.has(p.titleLink) || active.includes(p.titleLink as ServiceName));
  const have = new Set(kept.map((p) => p.titleLink));
  const added = SERVICES.map((s) => s.name).filter((n) => active.includes(n) && !have.has(n)).map((n) => fresh[n]).filter((p): p is CommunityPage => !!p);
  return [...kept, ...added];
}

/** Services à créer : actifs et sans page. */
export function servicesToCreate(existing: CommunityPage[], active: ServiceName[]): ServiceName[] {
  const have = new Set(existing.map((p) => p.titleLink));
  return SERVICES.map((s) => s.name).filter((n) => active.includes(n) && !have.has(n));
}

/** Les applications dont la ressource est partagée avec les groupes de la communauté. */
const SHARED_APPS: Partial<Record<ServiceName, string>> = { blog: 'blog', wiki: 'wiki', forum: 'forum' };

export interface ShareConfig {
  [bundle: string]: { requires?: string[] };
}

/**
 * Actions de partage de l'application voisine à donner à un rôle de communauté. Reprend `Behaviours.copyRights` :
 * le rôle (read / contrib / manager) et ses prérequis, puis toutes les actions dont le groupe porte ce nom.
 * Ex. `contrib` sur un blog → actions « read » + « contrib » (+ celles requises par la config).
 */
export function actionsForRole(role: string, config: ShareConfig, actions: Array<{ name: string[]; displayName: string }>): string[] {
  const bundles = new Set<string>([role, ...(config[role]?.requires ?? [])]);
  const out = new Set<string>();
  for (const a of actions) {
    const last = a.displayName.split('.').pop() ?? '';
    if ([...bundles].some((b) => last.includes(b))) a.name.forEach((n) => out.add(n));
  }
  return [...out];
}

/** Partage les ressources créées (blog, wiki, forum) avec les groupes read / contrib / manager de la communauté. */
export async function shareWithGroups(sources: PageSource[], groups: Array<{ id: string; type: string }>): Promise<void> {
  const config = await jsonRequest<ShareConfig>('GET', '/infra/public/json/sharing-rights.json');
  for (const src of sources) {
    const app = SHARED_APPS[(SERVICES.find((s) => s.template === src.template)?.name ?? 'home') as ServiceName];
    const id = (src.source as { _id?: string } | undefined)?._id;
    if (!app || !id) continue;
    const share = await jsonRequest<{ actions: Array<{ name: string[]; displayName: string }> }>('GET', `/${app}/share/json/${id}`);
    // Un appel par groupe sur `share/json` en formulaire (comme l'AngularJS) : le lot `share/resource` ignorait le groupe
    // gestionnaire, dont le créateur fait partie, et `share/json` refuse le JSON.
    for (const g of groups) {
      await putForm(`/${app}/share/json/${id}`, { groupId: g.id, actions: actionsForRole(g.type, config, share.actions ?? []) });
    }
  }
}

/**
 * Applique les services voulus à une communauté : crée les ressources manquantes, met à jour les pages du site et
 * partage les nouvelles ressources avec les groupes. Renvoie les pages enregistrées.
 */
export async function applyServices(params: {
  pageId: string;
  active: ServiceName[];
  context: CommunityContext;
  texts: ServiceTexts;
  groups: Array<{ id: string; type: string }>;
}): Promise<CommunityPage[]> {
  const site = await jsonRequest<{ pages?: CommunityPage[] }>('GET', `/community/pages/${params.pageId}`);
  const existing = site?.pages ?? [];
  const fresh: Partial<Record<ServiceName, CommunityPage>> = {};
  const sources: PageSource[] = [];
  for (const name of servicesToCreate(existing, params.active)) {
    const source = await generateSource(name, params.context, params.texts);
    fresh[name] = { title: params.texts.titles[name], titleLink: name, source };
    sources.push(source);
  }
  const pages = mergePages(existing, params.active, fresh);
  await jsonRequest('PUT', `/community/pages/${params.pageId}`, { pages });
  await shareWithGroups(sources, params.groups);
  return pages;
}
