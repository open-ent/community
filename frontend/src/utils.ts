/** Fonctions pures du module Communautés, testables. */

/** Tri par libellé FR insensible casse/accents (sur un champ donné). */
export function byLabel<T>(items: T[], key: (t: T) => string): T[] {
  return [...items].sort((a, b) => key(a).localeCompare(key(b), 'fr', { sensitivity: 'base' }));
}

/** Rôle le plus élevé de l'utilisateur dans une communauté (manager > contrib > read). */
export function highestRole(types?: string[]): string {
  if (!types || types.length === 0) return '';
  if (types.includes('manager')) return 'Gestionnaire';
  if (types.includes('contrib')) return 'Contributeur';
  if (types.includes('read')) return 'Lecteur';
  return types[0];
}

/** Comptage « N élément(s) » avec accord du pluriel. */
export function plural(n: number, singulier: string, pluriel: string): string {
  return `${n} ${n > 1 ? pluriel : singulier}`;
}

/** Libellé FR d'un rôle de communauté (read/contrib/manager). */
export function roleLabel(type: string): string {
  switch (type) {
    case 'manager':
      return 'Gestionnaire';
    case 'contrib':
      return 'Contributeur';
    case 'read':
      return 'Lecteur';
    default:
      return type;
  }
}
