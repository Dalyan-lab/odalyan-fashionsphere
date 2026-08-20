/**
 * Nom de la marque, en un seul endroit.
 *
 * Il existait quatre écritures dans l'application, dont une — « FashionSphere
 * AI », en tête du tableau de bord — qui amputait le nom. Un produit qui
 * s'appelle différemment selon l'écran donne l'impression de plusieurs
 * produits, et affaiblit celui qu'on essaie d'installer.
 *
 * `BRAND` est le nom courant, à utiliser partout dans l'interface.
 * `BRAND_LEGAL` porte la mention de marque déposée, réservée aux pages
 * juridiques et aux métadonnées où elle a une valeur.
 */
export const BRAND = 'Odalyan FashionSphere';
export const BRAND_LEGAL = `${BRAND} AI™`;
