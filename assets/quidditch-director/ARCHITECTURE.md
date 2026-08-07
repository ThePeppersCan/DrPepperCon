# Repo Company: Quidditch Director — Production Architecture

## Runtime boundary

Quidditch Director is now a self-contained browser application under `assets/quidditch-director/`. The parent Repo Company site owns only the dialog shell and the launch button. The game runtime is booted by `app/bootstrap.js` and exposes a small compatibility facade to the existing presentation layer while the internal simulation is modular.

The core simulation never reads Supabase, localStorage, DOM elements, audio nodes, or browser input. Presentation may use non-deterministic randomness for particles/audio texture, but gameplay randomness goes only through `RandomService`.

## Layers

- `app/` — bootstrapping, data loading and dependency composition.
- `core/` — deterministic rules. Match, run, cards, relics, weather, AI, effects, combos, state machine and event dispatcher.
- `application/` — commands. Mutating UI actions enter the simulation through `CommandBus`.
- `presentation/` — current DOM view adapter and scene infrastructure.
- `data/` — cards, relics, opponents, weather, events and config. Content is validated before the game starts.
- `save/` — versioned local/cloud persistence and migration.
- `replay/` — deterministic command recording.
- `statistics/`, `achievements/`, `progression/` — systems subscribing to domain events rather than being coupled to match logic.
- `input/`, `audio/`, `animation/`, `particles/`, `themes/`, `localisation/`, `assets/`, `memory/` — independent platform/presentation services.
- `debug/` — structured logger, developer console and optional performance overlay.
- `tests/` — headless simulation and content smoke tests.

## Content model

Cards are definitions in `data/cards.json`. The match engine does not branch on a card ID. A card contains an `effects` program made from reusable operations. New cards that use existing operations require data only, not engine edits.

Relics use reusable `rule` definitions in `data/relics.json`. Opponent intent pools and AI modifiers live in `data/opponents.json`. Weather behaviour lives in `data/weathers.json`. Between-match event choices contain declarative effect programs in `data/events.json`.

Existing short IDs are intentionally retained so old local/cloud saves remain compatible. They are now treated as immutable stable IDs.

## Determinism and replay

A run gets one seed. Gameplay random choices derive independent deterministic streams such as schedule, weather, AI, draw/reshuffle, events and rewards. Card instance IDs are generated from the run seed plus a monotonic counter. `ReplayRecorder` stores commands rather than video/state dumps.

Gameplay must not call `Math.random()`.

## Resolution safety

`EffectQueue` wraps card activation and tracks nested resolution depth, total operations and repeated trigger signatures. Current limits are defined in `data/config.json`. A malformed future combo fails with a trace instead of freezing the browser.

## State ownership

- Profile: permanent unlocks/settings/stats metadata.
- Run: season, deck, relics, fixtures and run modifiers.
- Match: current opponent/weather/scores/deck zones.
- Possession: temporary resources, chain, Flow and activation modifiers.

The `StateMachine` validates high-level run transitions. `CardManager` owns live card-zone moves and can detect duplicate card instances.

## Save compatibility

`SaveManager` continues using the existing `repo_quidditch_director_profile_v1:<manager>` key so users do not lose progress. Loaded v1 profiles migrate to schema v2 in one place. Cloud saves still use `quidditch_director_profiles` and remain optional; local play continues if Supabase is unavailable.

## Debugging

In the browser console:

```js
QD_DEV.help()
QD_DEV.run('state')
QD_DEV.run('events')
QD_DEV.run('stats')
QD_DEV.run('effects')
QD_DEV.run('replay')
QD_DEV.run('debug')
```

`debug` toggles a small performance/effect overlay.

## Testing

From this directory with Node:

```bash
node tests/simulation-smoke.mjs
node tests/content-smoke.mjs
```

The first runs full headless seasons. The second instantiates every card, relic and event choice to catch malformed content/operation definitions.

## Deliberate decisions

This refactor uses native ES modules rather than introducing Vite/TypeScript into the parent website immediately. That avoids changing the current Cloudflare Pages deployment contract. The module boundaries and strict data contracts are intentionally TypeScript-shaped so a later `.ts` conversion is mechanical instead of architectural.

PixiJS is also not introduced in this architecture pass. Rendering technology is isolated behind presentation services first; replacing the DOM match renderer with Pixi later will not require rewriting the simulation.

## Known weaknesses before the next gameplay pass

1. The current visual layer is still the prototype DOM renderer. It is isolated, not yet replaced.
2. Some effect operation names are high-level because existing cards already contain unusual mechanics. Future design should prefer composing smaller reusable operations before adding another specialised operation.
3. AI scoring remains intentionally simple because this pass preserves existing gameplay rather than rebalance it.
4. The old unreferenced `data.js`, `engine.js` and `game.js` files may remain in an existing deployment after overwrite. They are harmless because `index.html` no longer loads them; they can be deleted later during a cleanup release.
5. Full server replay verification for competitive leaderboards requires a backend worker/service and is intentionally not enabled by this client-only refactor.
