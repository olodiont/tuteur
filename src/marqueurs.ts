import type { TypeAide } from './notions';

export type Evenement =
  | { notion: { nom: string; langage: string; type: TypeAide } }
  | { revision: { id: string; reussie: boolean } };

export const PREFIXE = '@@TUTEUR ';

/**
 * Retire du flux du modèle les lignes `@@TUTEUR {json}` et les convertit en événements.
 * Le reste du texte est rendu au plus tôt : seule une ligne qui pourrait encore
 * devenir un marqueur est retenue jusqu'à sa fin.
 */
export class FiltreMarqueurs {
  private tampon = '';
  /** Vrai quand la ligne en cours ne peut plus être un marqueur : on la laisse passer. */
  private ligneLibre = false;
  private readonly liste: Evenement[] = [];

  get evenements(): Evenement[] {
    return [...this.liste];
  }

  pousser(fragment: string): string {
    let sortie = '';
    for (const car of fragment) {
      if (this.ligneLibre) {
        sortie += car;
        if (car === '\n') this.ligneLibre = false;
        continue;
      }
      this.tampon += car;
      if (car === '\n') {
        sortie += this.traiterLigne(this.tampon);
        this.tampon = '';
      } else if (!this.peutEtreMarqueur(this.tampon)) {
        sortie += this.tampon;
        this.tampon = '';
        this.ligneLibre = true;
      }
    }
    return sortie;
  }

  terminer(): string {
    const reste = this.tampon;
    this.tampon = '';
    this.ligneLibre = false;
    return reste ? this.traiterLigne(reste) : '';
  }

  private peutEtreMarqueur(debut: string): boolean {
    const t = debut.trimStart();
    return t.length < PREFIXE.length ? PREFIXE.startsWith(t) : t.startsWith(PREFIXE);
  }

  private traiterLigne(ligne: string): string {
    if (!ligne.trimStart().startsWith(PREFIXE)) return ligne;
    const t = ligne.trim();
    const evenement = analyser(t.slice(PREFIXE.length));
    if (evenement) this.liste.push(evenement);
    return '';
  }
}

function analyser(json: string): Evenement | null {
  try {
    const d = JSON.parse(json);
    if (d?.notion && typeof d.notion.nom === 'string' && typeof d.notion.langage === 'string') {
      const type: TypeAide = ['rappel', 'mini-cours', 'indice'].includes(d.notion.type)
        ? d.notion.type
        : 'indice';
      return { notion: { nom: d.notion.nom, langage: d.notion.langage, type } };
    }
    if (d?.revision && typeof d.revision.id === 'string' && typeof d.revision.reussie === 'boolean') {
      return { revision: { id: d.revision.id, reussie: d.revision.reussie } };
    }
  } catch {
    // JSON invalide : la ligne est retirée, sans événement.
  }
  return null;
}
