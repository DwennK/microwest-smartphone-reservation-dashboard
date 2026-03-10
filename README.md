# Microwest Smartphone Reservation Dashboard

Mini application interne pour enregistrer rapidement les reservations clients quand un smartphone reconditionne n'est pas disponible en magasin.

## Stack

- React 19 + Vite
- Tailwind CSS 4
- Node.js + Express
- SQLite via `node:sqlite`

## Structure

```text
.
|-- client
|-- server
|-- package.json
`-- README.md
```

## Prerequis

- Node.js 24 ou plus recent
- npm 10 ou plus recent

## Installation

Depuis la racine du projet :

```bash
npm install
```

## Lancement en developpement

Depuis la racine du projet :

```bash
npm run dev
```

Cette commande lance :

- le frontend Vite sur `http://localhost:5173`
- l'API backend sur `http://localhost:3001`

Le frontend proxifie automatiquement les requetes `/api` vers le backend.

## Test en developpement via Tailscale

Le mode developpement peut etre teste depuis un autre PC connecte au meme tailnet.

Configuration actuelle :

- Vite ecoute sur le reseau local
- le backend autorise les origines `localhost`, les IP Tailscale `100.x.x.x` et les noms `*.ts.net`
- Vite autorise les hotes `*.ts.net`

Utilisation :

```bash
npm run dev
```

Puis, depuis un autre PC du tailnet, ouvrez par exemple :

- `http://nom-machine.votre-tailnet.ts.net:5173`
- `http://100.x.x.x:5173`

Notes :

- le nom court de la machine sans suffixe `*.ts.net` n'est pas autorise par Vite
- ce flux est prevu pour du test en developpement, pas comme mode de production

## Commandes racine

Depuis la racine du projet :

```bash
npm run dev
npm run build
npm run start
```

Comportement des scripts :

- `npm run dev` lance le frontend et le backend en parallele
- `npm run build` build uniquement le frontend
- `npm run start` lance le serveur backend et sert aussi le frontend buildé si `client/dist` existe

## Scripts par dossier

Si besoin, chaque partie peut etre lancee separement.

Backend :

```bash
cd server
npm run dev
```

```bash
cd server
npm run start
```

Frontend :

```bash
cd client
npm run dev
```

```bash
cd client
npm run build
npm run preview
```

## Lancement en production

Depuis la racine du projet :

```bash
npm install
npm run build
npm run start
```

En production :

- Express sert l'application web sur `http://localhost:3001`
- les routes `/api` restent disponibles sur le meme serveur
- si le build frontend n'existe pas encore, `npm run start` ne sert que l'API

## Fonctionnalites

- ajout, modification et suppression de reservations
- suivi rapide des statuts : `en_attente`, `contacte`, `vendu`, `annule`
- recherche par client, numero de telephone ou note
- filtres par modele, capacite et statut
- filtre "seulement en attente"
- tri par date
- compteurs total et en attente
- export CSV complet des donnees pour sauvegarde
- import CSV depuis un fichier exporte par l'application

## API principale

- `GET /api/health`
- `GET /api/options`
- `GET /api/requests`
- `GET /api/requests/export/csv`
- `POST /api/requests/import/csv`
- `POST /api/requests`
- `PUT /api/requests/:id`
- `PATCH /api/requests/:id/status`
- `DELETE /api/requests/:id`

## Donnees

La base SQLite est creee automatiquement au premier lancement dans `server/data/microwest.sqlite`.

Le mode journal SQLite `WAL` est active automatiquement.

## Note SQLite

Le backend utilise le module natif `node:sqlite` de Node.js pour eviter toute compilation locale de dependance C++.
