# Analyse d'Optimisation : MoneyFlow - Business Edition (Cameroun)

## 1. Objectif de l'Optimisation
Adapter l'application aux réalités des petits commerces, boutiques et PME au Cameroun. L'objectif est de simplifier la comptabilité tout en offrant un suivi rigoureux des stocks, des dettes (crédit) et de la performance des employés.

---

## 2. Axe 1 : Gestion de Stock Réel & Alertes
L'inventaire est le cœur du commerce. Le système doit passer d'une simple liste de prix à un suivi de flux.

### Fonctionnalités Clés :
*   **Décrémentation Automatique** : Chaque "Vente" enregistrée doit automatiquement soustraire la quantité du stock disponible du produit lié.
*   **Alerte Stock Bas** : Indicateur visuel sur le Dashboard listant les produits en rupture ou sous un seuil critique (ex: "Plus que 5 sacs de riz").
*   **Journal de Mouvement (`stock_movements`)** :
    *   **Entrées** : Achats de stock, réapprovisionnement.
    *   **Sorties** : Ventes, pertes (avaries), ou prélèvements personnels.

---

## 3. Axe 2 : Gestion de la Dette ("L'Ardoise")
Le crédit client est une réalité incontournable du quartier.

### Fonctionnalités Clés :
*   **Base Clients (`customers`)** : Enregistrement des clients réguliers avec suivi de leur solde débiteur.
*   **Vente à Crédit** : Possibilité de marquer une transaction comme "Impayée" ou "Crédit".
*   **Interface "L'Ardoise"** : Panneau récapitulatif permettant de voir en un coup d'œil qui doit combien et de solder les dettes rapidement.

---

## 4. Axe 3 : Performance & Caisse (Mode Business)
Sécurisation des revenus pour le propriétaire du projet (`Project Owner`).

### Fonctionnalités Clés :
*   **Leaderboard des Employés** : 
    *   Classement des membres par chiffre d'affaires généré.
    *   **Restriction** : Visible uniquement par le `Project Owner` et uniquement pour les projets de type Business (`continuous`).
*   **Caisse du Jour** :
    *   Fonctionnalité de fin de journée permettant de confronter le cash physique avec le solde théorique de l'application.
    *   Calcul automatique des écarts de caisse (Surplus / Manquant).

---

## 5. Axe 4 : Contextualisation des Catégories
Amélioration de l'UX en filtrant les options selon la nature du projet.

### Logique de Filtrage :
*   **Projets Business (`continuous`)** : 
    *   Affiche : Vente, Achat Stock, Livraison, Loyer Boutique, Électricité, Achats Divers.
    *   Masque : Shopping, Restaurant, Ration, Sport (trop personnels).
*   **Projets Personnels (`standard`)** : 
    *   Affiche l'intégralité des catégories pour un suivi de vie granulaire.

---

## 6. Impact Technique (Architecture)

### Nouvelles Tables Supabase :
1.  **`customers`** : `id, project_id, name, phone, total_debt, created_at`
2.  **`stock_movements`** : `id, product_id, type (in/out), quantity, reason, created_at`
3.  **`daily_closings`** : `id, project_id, user_id, declared_amount, theoretical_amount, difference, date`

### Modifications Schema :
*   **`products`** : Ajout d'une colonne `stock_quantity` et `alert_threshold`.
*   **`transactions`** : Ajout d'une colonne `payment_status` (paid/unpaid) et `customer_id`.
