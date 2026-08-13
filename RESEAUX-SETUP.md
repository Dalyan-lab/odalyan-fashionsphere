# Activer YouTube, Pinterest et LinkedIn

Les deux providers de publication sont écrits et déployés. Il ne reste qu'à créer
les accès chez chaque plateforme et à renseigner les clés dans Railway.

> Adresses de redirection : elles doivent être **exactement** celles indiquées,
> majuscules comprises. Une différence d'un caractère et la connexion échoue.

---

## YouTube

Bonne nouvelle : le projet Google Cloud qui sert déjà à la **connexion Google**
peut être réutilisé. Les clés sont reprises automatiquement si aucune clé
dédiée n'est fournie.

### 1. Activer l'API

[console.cloud.google.com](https://console.cloud.google.com) → ton projet →
**API et services** → **Bibliothèque** → chercher **« YouTube Data API v3 »** → **Activer**.

> **L'interface a changé.** Ce qui s'appelait « Écran de consentement OAuth »
> et « Identifiants » se trouve désormais sous **Google Auth Platform**, avec
> des noms différents :
>
> | Ce qu'on cherche | Ancien nom | Nouveau menu |
> |---|---|---|
> | Champs d'application (scopes) | Écran de consentement | **Accès aux données** |
> | Identifiants OAuth / redirections | Identifiants | **Clients** |
> | Utilisateurs test | Écran de consentement | **Audience** |

### 2. Déclarer les autorisations

**Google Auth Platform** → **Accès aux données** → ajouter ou supprimer des
champs d'application → ajouter :

```
https://www.googleapis.com/auth/youtube.upload
https://www.googleapis.com/auth/youtube.readonly
```

Ils n'apparaissent dans la liste **que si l'étape 1 a été faite** : sans API
activée, Google ne propose pas ses champs d'application.

Le premier est classé **sensible**. Tant que l'application n'est pas vérifiée,
deux conséquences :

- seuls les comptes déclarés dans **Audience → Utilisateurs test** peuvent se
  connecter — y ajouter son adresse Gmail ;
- **les vidéos envoyées restent privées**, quoi qu'on demande.

### 3. Adresse de redirection

**Google Auth Platform** → **Clients** → ouvrir le client OAuth (le même que
celui de la connexion Google) → dans **URI de redirection autorisés**, ajouter :

```
https://api.fashodalyansp.com/api/social/oauth/callback/YouTube
```

### 4. Variables Railway

Rien à ajouter si tu réutilises les clés de la connexion Google
(`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, déjà présentes).

Pour utiliser un projet Google distinct, renseigner à la place :

| Variable | Valeur |
|---|---|
| `YOUTUBE_CLIENT_ID` | ID client du projet dédié |
| `YOUTUBE_CLIENT_SECRET` | Secret correspondant |

Après la vérification Google, pour publier en public :

| Variable | Valeur |
|---|---|
| `YOUTUBE_PRIVACY_STATUS` | `public` |

### À savoir

- YouTube **exige une vidéo** : une publication sans vidéo est refusée.
- Le titre est déduit de la **première ligne** de la légende (100 caractères max),
  le reste devient la description.
- Le jeton d'accès expire au bout d'**une heure**, mais il se renouvelle tout seul
  grâce au jeton de rafraîchissement. Aucune reconnexion manuelle nécessaire —
  contrairement à TikTok.
- Statistiques remontées : vues, j'aime, commentaires. Les partages ne sont pas
  exposés par l'API.

---

## Pinterest

### 0. Compte professionnel obligatoire

L'espace développeur **refuse les comptes personnels** : « Désolé, ceci est votre
compte personnel ». C'est l'inverse de TikTok et Meta, dont les espaces
développeurs refusent au contraire les comptes pro — ne pas s'y perdre.

Créer un profil professionnel sur [business.pinterest.com](https://business.pinterest.com)
(gratuit, rattaché à l'identifiant existant), ou convertir le compte actuel.
Le compte professionnel donne aussi accès aux statistiques Pinterest.

Avant de continuer : vérifier l'adresse e-mail, accepter les conditions
développeur, et **créer au moins un tableau** — une épingle ne peut pas exister
sans tableau.

### 1. Créer l'application

[developers.pinterest.com](https://developers.pinterest.com) → **My apps** →
créer une application.

L'accès **Trial** suffit pour publier sur ton propre compte. L'accès Standard
n'est nécessaire que pour publier au nom d'autres utilisateurs.

### 2. Adresse de redirection

Dans les réglages de l'application, ajouter :

```
https://api.fashodalyansp.com/api/social/oauth/callback/Pinterest
```

### 3. Autorisations

```
boards:read, pins:read, pins:write, user_accounts:read
```

### 4. Variables Railway

| Variable | Valeur |
|---|---|
| `PINTEREST_APP_ID` | identifiant de l'app |
| `PINTEREST_APP_SECRET` | secret de l'app |

### À savoir

- **Créer au moins un tableau** sur le compte Pinterest **avant** de le connecter.
  Une épingle ne peut pas exister hors d'un tableau : la plateforme mémorise le
  premier tableau du compte au moment de la connexion et y dépose les épingles.
- Pinterest **publie des images**. Une publication contenant seulement une vidéo
  est refusée avec un message explicite — ajouter une image, ou retirer Pinterest
  de la sélection.
- L'image doit être accessible publiquement : Pinterest la télécharge lui-même
  depuis son URL. C'est le cas des médias de la plateforme (stockage R2).
- Statistiques remontées : impressions et enregistrements. Les j'aime et
  commentaires ne sont pas exposés par l'API.

---

## LinkedIn

Remplace X, dont le niveau d'API permettant de publier est payant (~100 $/mois).
LinkedIn publie **du texte et des images sur votre profil**.

### 1. Créer l'application

[developer.linkedin.com](https://developer.linkedin.com) → **My apps** → créer une
application. Elle doit être rattachée à une **Page LinkedIn** — si vous n'en avez
pas, créez-en une, c'est gratuit et immédiat.

### 2. Ajouter le produit

Onglet **Products** → demander **« Share on LinkedIn »**. L'accès est
automatique, sans validation manuelle.

> Ne pas demander « Community Management API » : elle sert à publier au nom
> d'une Page d'entreprise et exige une validation longue. Le produit
> « Share on LinkedIn » suffit pour publier sur votre profil.

### 3. Adresse de redirection

Onglet **Auth** → **Authorized redirect URLs** → ajouter :

```
https://api.fashodalyansp.com/api/social/oauth/callback/LinkedIn
```

### 4. Vérifier les autorisations

Toujours dans **Auth**, la section des scopes OAuth doit contenir :

```
openid, profile, w_member_social
```

Les deux premiers servent uniquement à récupérer votre identifiant de membre,
indispensable pour signer la publication. Le troisième publie.

### 5. Variables Railway

| Variable | Valeur |
|---|---|
| `LINKEDIN_CLIENT_ID` | Client ID de l'app |
| `LINKEDIN_CLIENT_SECRET` | Client Secret de l'app |
| `LINKEDIN_API_VERSION` | *(optionnel)* version de l'API, par défaut `202405` |

### À savoir

- **Le jeton dure 60 jours.** Son renouvellement automatique n'est ouvert
  qu'aux applications validées par LinkedIn : prévoyez une reconnexion tous les
  deux mois. Un message explicite le rappellera le moment venu.
- LinkedIn **ne prend pas la vidéo** dans cette intégration. Une publication
  contenant seulement une vidéo est refusée avec un message clair — ajoutez une
  image, ou retirez LinkedIn de la sélection.
- L'API est **versionnée par date**. Si LinkedIn retire la version utilisée,
  changez `LINKEDIN_API_VERSION` sans toucher au code.
- Rédaction : seule la **première ligne** s'affiche avant le « voir plus ».
  La génération IA en tient compte et écrit un ton professionnel, avec une
  accroche courte en tête.

---

## Vérifier que c'est actif

Page **Publications** de la plateforme. Le badge à côté de chaque réseau indique :

| Badge | Signification |
|---|---|
| **Bientôt** | aucun provider écrit — ce n'est plus le cas de YouTube ni Pinterest |
| **App requise** | provider écrit, mais clés absentes dans Railway |
| **Réel** | tout est en place, la publication part vraiment |

Après avoir renseigné les clés, le service redémarre : attendre le déploiement
vert avant de connecter les comptes.
