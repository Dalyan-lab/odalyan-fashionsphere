# Reconfigurer Facebook et Instagram — procédure complète

Ce document sert à reconstruire les applications Meta après la suppression de
l'application Facebook (août 2026). Il rassemble **tous les pièges rencontrés lors
de la première configuration**, pour ne pas les redécouvrir un par un.

> Facebook et Instagram sont **deux applications distinctes**, avec des clés
> distinctes. Instagram n'est pas un module de l'application Facebook.
> TikTok n'est pas concerné par ce document.

---

## Étape 0 — Débloquer le compte développeur (préalable obligatoire)

Rien n'est possible tant que `developers.facebook.com` refuse l'accès.

1. **Se connecter avec le profil Facebook PERSONNEL**, jamais avec le profil
   professionnel « FashionSphere Odalyan ». L'espace développeur refuse les
   profils de Page — c'est ce qui provoque « Vous ne pouvez pas accéder à ce service ».
   Pour basculer : facebook.com → photo de profil → **Changer de profil**.
2. Vérifier les restrictions sur **facebook.com/accountquality**.
3. Vérifier que **l'authentification à deux facteurs est activée** : Meta l'exige
   pour tout compte développeur.
4. Si le compte reste bloqué, utiliser le lien **« envoyer une demande d'assistance »**
   de la page d'erreur. Compter quelques jours.

---

## Étape 1 — Recréer l'application Facebook

### Création

- Type d'application : partir des cas d'usage **« Tout gérer sur votre Page »**
  et **« Gérer les contenus Instagram »**. On obtient une application
  **« Facebook Login for Business »** (FBLB).
- **Plateforme : Web uniquement.** Cocher Android ou iOS exige des signatures
  de paquet inutiles ici.

### Réglages généraux (Paramètres → Général)

- **Domaines de l'app** : ajouter `odalyanapi-production.up.railway.app`.
  Ce champ est distinct des URI de redirection, et son oubli fait échouer la connexion.

### URI de redirection OAuth

Exactement, sans variante :

```
https://odalyanapi-production.up.railway.app/api/social/oauth/callback/Facebook
```

### Configuration de connexion — le piège principal

FBLB **refuse les permissions passées en `scope`** dans l'URL (erreur « Invalid Scopes »).
Les permissions viennent d'une **Configuration de connexion**, identifiée par un
`config_id` que le code envoie à la place du `scope`.

Créer une configuration de type **jeton utilisateur** avec ces permissions :

| Permission | Pourquoi |
|---|---|
| `pages_show_list` | lister les Pages administrées |
| `pages_manage_posts` | publier sur la Page |
| `pages_read_engagement` | lire j'aime, commentaires, partages |
| `read_insights` | lire les impressions et la portée (statistiques) |

Noter l'**identifiant de la configuration** : c'est le futur `META_CONFIG_ID`.

### Pièges à connaître

- **Ne jamais faire `fb_exchange_token`** sur un jeton FBLB : il perd l'accès aux
  Pages détenues par un business. Le code en tient déjà compte.
- `/me/accounts` renvoie `{"data":[]}` pour une Page détenue par un business.
  Le code contourne déjà cela en lisant `granular_scopes[].target_ids` via
  `debug_token`. Rien à faire, mais ne pas s'inquiéter de voir une liste vide.

---

## Étape 2 — Recréer l'application Instagram

Application **séparée**, de type **« Instagram API with Instagram login »**
(et non via Facebook Login).

### URI de redirection

```
https://odalyanapi-production.up.railway.app/api/social/oauth/callback/Instagram
```

### Permissions

- `instagram_business_basic`
- `instagram_business_content_publish`
- `instagram_business_manage_insights` (statistiques)

### Compte de test — piège

Le compte Instagram doit être **professionnel**, et il doit être ajouté via
**Rôles → « Testeur Instagram »**, puis **l'invitation doit être acceptée depuis
le compte Instagram lui-même**. L'ajouter seulement via « Ajouter un compte »
produit l'erreur « Rôle de développeur insuffisant ».

---

## Étape 3 — Reporter les clés dans Railway

Projet **`dynamic-rebirth`** → service **`@odalyan/api`** → onglet **Variables**.

| Variable | Provenance |
|---|---|
| `META_APP_ID` | application Facebook |
| `META_APP_SECRET` | application Facebook |
| `META_CONFIG_ID` | identifiant de la configuration de connexion |
| `INSTAGRAM_APP_ID` | application Instagram (≠ META_APP_ID) |
| `INSTAGRAM_APP_SECRET` | application Instagram |

> Modifier une variable redémarre le service. Attendre que le déploiement
> repasse au vert avant de tester.

---

## Étape 4 — Reconnecter et vérifier

1. Sur le site → **Publications** → connecter Facebook, puis Instagram.
2. Les deux doivent afficher le badge **« Réel »**.
3. **Pilotage social** → créer une publication de test avec une image ou une
   vidéo, la programmer quelques minutes plus tard.
4. Vérifier dans **Calendrier → Liste** : le statut doit passer à « Publiée »,
   avec une étiquette ✅ par réseau.
5. Cliquer sur **🔄 Actualiser** dans Performances. Les réseaux mettent une à
   deux heures avant de remonter leurs premiers chiffres.

---

## En cas de changement de nom de domaine

Si le site passe sur `fashodalyansp.com`, **toutes les URI de redirection
ci-dessus changent**, chez Facebook, Instagram **et** TikTok. Il faut aussi
mettre à jour `WEB_ORIGIN` et `API_PUBLIC_URL` dans Railway, puis reconnecter
les trois comptes et régénérer les QR codes de la page Partage.

À faire en une seule opération, jamais en même temps qu'autre chose.
