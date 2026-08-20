/**
 * Base de données factice, en mémoire, pour les tests de la couche métier.
 *
 * Volontairement minimale : elle n'imite pas Prisma, elle rejoue les appels
 * précis que font les services testés. Une émulation générale d'ORM serait
 * longue à écrire, fausse par endroits, et donnerait de faux verts.
 *
 * Ce qu'elle permet de vérifier : les droits et les enchaînements — un vendeur
 * qui tranche le remboursement d'un autre, une commande remboursée deux fois,
 * un versement préparé sans coordonnées. Ce qu'elle ne vérifie pas : le SQL
 * réel, les contraintes d'unicité et les transactions de la base.
 */

type Row = Record<string, unknown>;

/**
 * Copie détachée d'une ligne.
 *
 * Une vraie base renvoie un instantané : modifier la ligne ensuite ne change
 * pas l'objet déjà lu. Sans cette copie, un service qui compare l'état d'avant
 * à celui d'après comparerait la même référence à elle-même — et le test
 * passerait à côté du bogue au lieu de le révéler.
 */
function snapshot<T>(row: T): T {
  return row && typeof row === 'object' ? ({ ...(row as object) } as T) : row;
}

export interface CallLog {
  model: string;
  method: string;
  args: unknown;
}

/** Applique un filtre `where` plat, suffisant pour les cas testés. */
function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      const cond = expected as Row;
      if ('in' in cond) return (cond.in as unknown[]).includes(actual);
      if ('not' in cond) return actual !== cond.not;
      // Les conditions de date (`lte`, `gt`) ne sont pas interprétées : les
      // tests qui en dépendent passent par les modules purs déjà couverts.
      return true;
    }
    return actual === expected;
  });
}

export interface FakeDb {
  [model: string]: Row[];
}

/**
 * Construit un faux client Prisma sur des tableaux en mémoire.
 *
 * `calls` conserve la trace de chaque appel, ce qui permet de vérifier non
 * seulement le résultat mais **ce que le service a réellement écrit**.
 */
export function makeFakePrisma(db: FakeDb) {
  const calls: CallLog[] = [];

  const model = (name: string) => {
    const rows = () => (db[name] ??= []);
    return {
      findUnique: (args: { where: Row }) => {
        calls.push({ model: name, method: 'findUnique', args });
        return Promise.resolve(snapshot(rows().find((r) => matches(r, args.where))) ?? null);
      },
      findFirst: (args: { where?: Row }) => {
        calls.push({ model: name, method: 'findFirst', args });
        return Promise.resolve(snapshot(rows().find((r) => matches(r, args.where))) ?? null);
      },
      findMany: (args?: { where?: Row }) => {
        calls.push({ model: name, method: 'findMany', args });
        return Promise.resolve(rows().filter((r) => matches(r, args?.where)).map(snapshot));
      },
      create: (args: { data: Row }) => {
        calls.push({ model: name, method: 'create', args });
        const row = { id: `${name}-${rows().length + 1}`, ...args.data };
        rows().push(row);
        return Promise.resolve(snapshot(row));
      },
      update: (args: { where: Row; data: Row }) => {
        calls.push({ model: name, method: 'update', args });
        const row = rows().find((r) => matches(r, args.where));
        if (!row) return Promise.reject(new Error(`${name} introuvable`));
        Object.assign(row, args.data);
        return Promise.resolve(snapshot(row));
      },
      updateMany: (args: { where: Row; data: Row }) => {
        calls.push({ model: name, method: 'updateMany', args });
        const hit = rows().filter((r) => matches(r, args.where));
        hit.forEach((r) => Object.assign(r, args.data));
        return Promise.resolve({ count: hit.length });
      },
      /**
       * Somme et compte sur les lignes filtrées. Seul `_sum` est interprété :
       * c'est le seul agrégat dont dépendent les services testés, et en
       * simuler d'autres donnerait l'illusion d'une couverture inexistante.
       */
      aggregate: (args: { where?: Row; _sum?: Record<string, boolean> }) => {
        calls.push({ model: name, method: 'aggregate', args });
        const hit = rows().filter((r) => matches(r, args?.where));
        const _sum: Record<string, number> = {};
        for (const champ of Object.keys(args?._sum ?? {})) {
          _sum[champ] = hit.reduce((t, r) => t + Number(r[champ] ?? 0), 0);
        }
        return Promise.resolve({ _sum, _count: hit.length });
      },
      groupBy: (args: { by: string[]; where?: Row; _sum?: Record<string, boolean> }) => {
        calls.push({ model: name, method: 'groupBy', args });
        const hit = rows().filter((r) => matches(r, args?.where));
        const groupes = new Map<string, Row[]>();
        for (const r of hit) {
          const cle = args.by.map((b) => String(r[b])).join('|');
          groupes.set(cle, [...(groupes.get(cle) ?? []), r]);
        }
        return Promise.resolve(
          [...groupes.entries()].map(([cle, lignes]) => {
            const sortie: Row = {};
            args.by.forEach((b, i) => (sortie[b] = cle.split('|')[i]));
            const _sum: Record<string, number> = {};
            for (const champ of Object.keys(args?._sum ?? {})) {
              _sum[champ] = lignes.reduce((t, r) => t + Number(r[champ] ?? 0), 0);
            }
            return { ...sortie, _sum, _count: lignes.length };
          }),
        );
      },
      delete: (args: { where: Row }) => {
        calls.push({ model: name, method: 'delete', args });
        const i = rows().findIndex((r) => matches(r, args.where));
        if (i < 0) return Promise.reject(new Error(`${name} introuvable`));
        return Promise.resolve(rows().splice(i, 1)[0]);
      },
    };
  };

  const client: Record<string, unknown> = {
    // Exposé sur l'objet lui-même, sinon le proxy prendrait `calls` pour un
    // nom de modèle et renverrait un faux dépôt vide.
    calls,
    // La transaction reçoit le PROXY, pas l'objet nu : sans cela `tx.order`
    // ne déclencherait pas la création à la demande du modèle.
    $transaction: (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => unknown)(proxy)
        : Promise.all(arg as Promise<unknown>[]),
  };

  // Les modèles sont créés à la demande : chaque test ne peuple que ce dont il
  // a besoin, sans avoir à décrire tout le schéma.
  const proxy = new Proxy(client, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === 'then') return undefined; // ne pas se faire prendre pour une promesse
      const m = model(prop);
      target[prop] = m;
      return m;
    },
  });

  return proxy as unknown as { calls: CallLog[] } & Record<string, never>;
}

/** Journal des appels d'un faux client, pour les assertions. */
export function callsOf(prisma: unknown): CallLog[] {
  return (prisma as { calls?: CallLog[] }).calls ?? [];
}

/** Messagerie factice : enregistre les envois au lieu de les effectuer. */
export function makeFakeMail() {
  const sent: { kind: string; to: string; info: unknown }[] = [];
  const record = (kind: string) => (to: string, info: unknown) => {
    sent.push({ kind, to, info });
    return Promise.resolve(true);
  };
  return {
    sent,
    enabled: true,
    sendRefundRequested: record('refundRequested'),
    sendRefundDecision: record('refundDecision'),
    sendOrderStatusUpdate: record('orderStatus'),
  };
}
