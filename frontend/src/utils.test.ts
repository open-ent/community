import { describe, expect, it } from 'vitest';

import { byLabel, highestRole, plural, roleLabel } from './utils';

describe('byLabel', () => {
  it('trie par clé, insensible casse/accents', () => {
    const arr = [{ name: 'Éveil' }, { name: 'anglais' }, { name: 'Biologie' }];
    expect(byLabel(arr, (x) => x.name).map((x) => x.name)).toEqual(['anglais', 'Biologie', 'Éveil']);
  });
  it('ne mute pas la source', () => {
    const src = [{ name: 'b' }, { name: 'a' }];
    byLabel(src, (x) => x.name);
    expect(src.map((x) => x.name)).toEqual(['b', 'a']);
  });
});

describe('highestRole', () => {
  it('renvoie le rôle le plus élevé', () => {
    expect(highestRole(['read', 'manager'])).toBe('Gestionnaire');
    expect(highestRole(['read', 'contrib'])).toBe('Contributeur');
    expect(highestRole(['read'])).toBe('Lecteur');
  });
  it('gère l’absence de rôle', () => {
    expect(highestRole([])).toBe('');
    expect(highestRole(undefined)).toBe('');
  });
});

describe('plural', () => {
  it('accorde le pluriel', () => {
    expect(plural(1, 'groupe', 'groupes')).toBe('1 groupe');
    expect(plural(3, 'groupe', 'groupes')).toBe('3 groupes');
    expect(plural(0, 'groupe', 'groupes')).toBe('0 groupe');
  });
});

describe('roleLabel', () => {
  it('traduit les rôles de communauté', () => {
    expect(roleLabel('manager')).toBe('Gestionnaire');
    expect(roleLabel('contrib')).toBe('Contributeur');
    expect(roleLabel('read')).toBe('Lecteur');
  });
  it('retombe sur la valeur brute si rôle inconnu', () => {
    expect(roleLabel('other')).toBe('other');
  });
});
