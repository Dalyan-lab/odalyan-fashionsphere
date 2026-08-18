# Activer la découverte automatique des meilleures ventes (Keepa)

Le module ViralAmazone sait reprendre chaque nuit le haut du classement des
meilleures ventes Amazon. Il lui faut pour cela une clé d'accès Keepa.

> **Symptôme sans clé** : un rayon se lance, affiche « 0 produits » et **aucune
> erreur**. Le code sort proprement quand Keepa n'est pas configuré. Depuis le
> correctif, un bandeau orange le signale explicitement dans l'interface.

---

## 1. Pourquoi Keepa et pas Amazon directement

L'API officielle d'Amazon (PA-API) sait décrire un produit dont on connaît déjà
l'identifiant, mais **elle n'expose aucun classement de meilleures ventes**.

La seule autre voie serait d'aspirer les pages publiques d'Amazon — ce que nous
avons écarté dès le début du projet : cela viole les conditions d'utilisation et
expose ton compte Associates à une fermeture. Keepa collecte ces données
légitimement et les revend par API. C'est la voie conforme.

Les deux sources se complètent :

| Source | Rôle |
|---|---|
| **Keepa** | Quels produits se vendent le mieux, et l'historique de leur rang |
| **PA-API** | Titre, image, prix à jour, et le lien d'affiliation qui te rémunère |

---

## 2. Souscrire à l'API

1. Créer un compte sur [keepa.com](https://keepa.com)
2. Aller sur [keepa.com/#!api](https://keepa.com/#!api)
3. Souscrire à un abonnement API

**Sur le dimensionnement** : Keepa fonctionne par *jetons*. Ton abonnement en
génère un nombre fixe par minute, en continu, et chaque requête en consomme.
Les jetons non utilisés expirent au bout d'une heure — inutile d'espérer les
accumuler.

Notre consommation est volontairement modeste : **un passage par jour** sur
chaque rayon, et non par heure. Un classement de meilleures ventes bouge
lentement ; l'interroger sans cesse gaspillerait tes jetons sans rien apprendre.
L'offre la plus petite suffit largement pour démarrer avec quelques rayons.

Je ne cite pas de tarif ici : il change, et je préfère que tu lises le prix
courant sur leur page plutôt qu'un chiffre périmé dans un fichier.

## 3. Récupérer la clé

Toujours sur [keepa.com/#!api](https://keepa.com/#!api), la page affiche ta
**clé d'accès**. Elle est visible en permanence — contrairement à Resend ou
Pinterest, tu peux y revenir plus tard.

---

## 4. Renseigner la clé dans Railway

Service `@odalyan/api` → **Variables** → **+ New Variable** :

| Variable | Valeur |
|---|---|
| `KEEPA_API_KEY` | ta clé Keepa |

Le service redémarre seul. Ne colle jamais cette clé ailleurs que dans Railway.

---

## 5. Déclarer un rayon

Page **Hot Trends** → bloc **🎯 Rayons surveillés** (visible pour
l'administrateur seulement).

| Champ | Ce qu'il attend |
|---|---|
| Nom du rayon | Un libellé pour toi : « Beauté France » |
| Pays | Le marketplace Amazon visé |
| Catégorie | Voir ci-dessous |
| Top | Combien de produits reprendre en tête du classement |

### Trouver la bonne valeur de catégorie

Keepa accepte **soit** un identifiant de nœud Amazon, **soit** un nom de groupe
d'affichage. La méthode la plus sûre consiste à la lire dans l'URL d'Amazon :

1. Ouvrir la page des meilleures ventes du pays visé, par exemple
   `https://www.amazon.fr/gp/bestsellers/`
2. Cliquer sur le rayon qui t'intéresse
3. Lire l'adresse obtenue :

```
https://www.amazon.fr/gp/bestsellers/beauty/197861031/
                                     ↑        ↑
                            nom de groupe   identifiant de nœud
```

Les deux fonctionnent. Le **nom** est portable d'un pays à l'autre ; l'**identifiant
numérique** est propre à un seul pays mais désigne une sous-catégorie plus fine.

Commence par un seul rayon, clique sur **Lancer** pour ne pas attendre le
passage automatique de 4 h du matin, et regarde le nombre de produits rapportés.

### Si ça ne marche pas

| Ce que tu vois | Cause |
|---|---|
| Bandeau orange « Clé Keepa absente » | `KEEPA_API_KEY` pas encore dans Railway |
| « 0 produits » sans bandeau | Catégorie invalide pour ce pays — essaie l'autre écriture |
| Message d'erreur rouge sur la ligne | Keepa a répondu : quota épuisé, ou clé invalide |

Un rayon en échec n'empêche pas les autres de fonctionner : l'erreur reste
attachée au rayon concerné.

---

## 6. Ce qui se passe ensuite

Chaque nuit à 4 h, la plateforme reprend le haut du classement de chaque rayon
actif et met ces produits sous suivi. Toutes les 3 heures, elle recalcule leur
**vélocité** — la vitesse à laquelle leur rang progresse — et les classe en
Explosion Éclair, Tendance Forte ou Croissance Stable.

Les deux mécanismes ne disent pas la même chose : le classement révèle **ce qui
se vend déjà**, la vélocité révèle **ce qui décolle**. C'est le second qui fait
le bon contenu viral — un produit installé au sommet depuis six mois n'intéresse
personne, un produit qui grimpe de 200 % en douze heures, si.
