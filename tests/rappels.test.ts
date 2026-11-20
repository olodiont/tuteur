import { describe, expect, test } from 'vitest';
import { ajouterAide, BaseNotions, enregistrerRevision } from '../src/notions';
import { formaterListeNotions, ligneRappel, notionsRappelRestantes, selectionRappel } from '../src/rappels';

const AUJ = '2026-11-20';

function baseAvec(noms: string[], le = '2026-11-10'): BaseNotions {
  let base: BaseNotions = { notions: [] };
  for (const nom of noms) base = ajouterAide(base, { nom, langage: 'java', type: 'rappel' }, le);
  return base;
}

describe('ligneRappel', () => {
  test('annonce le nombre de notions dues', () => {
    const r = ligneRappel(baseAvec(['for', 'HashMap']), AUJ);
    expect(r?.texte).toContain('2 notions à revoir');
    expect(r?.texte).toContain('@tuteur /rappel');
    expect(r?.base.dernierRappelAffiche).toBe(AUJ);
  });

  test('accord au singulier', () => {
    expect(ligneRappel(baseAvec(['for']), AUJ)?.texte).toContain('1 notion à revoir');
  });

  test('au plus une fois par jour', () => {
    const r = ligneRappel(baseAvec(['for']), AUJ)!;
    expect(ligneRappel(r.base, AUJ)).toBeNull();
    expect(ligneRappel(r.base, '2026-11-21')).not.toBeNull();
  });

  test('rien à revoir : null', () => {
    expect(ligneRappel(baseAvec(['for'], AUJ), AUJ)).toBeNull();
    expect(ligneRappel({ notions: [] }, AUJ)).toBeNull();
  });
});

describe('selectionRappel', () => {
  test('au plus 3 notions', () => {
    expect(selectionRappel(baseAvec(['a', 'b', 'c', 'd', 'e']), AUJ)).toHaveLength(3);
  });
});

describe('formaterListeNotions', () => {
  test('base vide', () => {
    expect(formaterListeNotions({ notions: [] }, AUJ)).toBe("Aucune notion enregistrée pour l'instant.");
  });

  test('tableau, notions dues en premier', () => {
    let base = ajouterAide({ notions: [] }, { nom: 'Plus tard', langage: 'java', type: 'rappel' }, AUJ);
    base = ajouterAide(base, { nom: 'Due', langage: 'java', type: 'rappel' }, '2026-11-01');
    const t = formaterListeNotions(base, AUJ);
    expect(t).toContain('| Notion | Langage | Aides | Prochaine révision |');
    expect(t.indexOf('Due')).toBeLessThan(t.indexOf('Plus tard'));
  });
});

describe('I1 : notions gelées de la session de rappel', () => {
  test('ne garde que les notions gelées encore dues', () => {
    let base = baseAvec(['a', 'b', 'c', 'd']);
    const ids = ['java-a', 'java-b', 'java-c'];
    base = enregistrerRevision(base, 'java-a', true, AUJ);
    expect(notionsRappelRestantes(base, ids, AUJ).map((n) => n.id)).toEqual(['java-b', 'java-c']);
  });

  test('toutes révisées : liste vide', () => {
    let base = baseAvec(['a']);
    base = enregistrerRevision(base, 'java-a', false, AUJ);
    expect(notionsRappelRestantes(base, ['java-a'], AUJ)).toEqual([]);
  });
});
