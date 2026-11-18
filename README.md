# Solmar Heat — Open World Getaway

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/zebhyrus/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/zebhyrus/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 2D top-down open-world crime game set in **Solmar**, a fictional sun-soaked
coastal city. You are **Danny Reyes**, getaway driver for **Mara Solis** and
her crew. Steal cars, outrun the Solmar PD, and finish all five jobs.

## What is in the game

- **A city to explore on foot and by car** — an 8×8 grid of streets, blocks,
  parks, palm trees and named landmarks (the Docks, Solmar Bank, the Marina,
  Plaza del Sol, the Safehouse, Solmar General, Solmar PD HQ).
- **Traffic and pedestrians** — AI cars drive the street grid, brake for the
  car ahead and turn at intersections; pedestrians stroll the sidewalks and
  flee from danger.
- **Steal cars** — press E near a car to get in. Stealing a traffic car makes
  its driver flee and raises your wanted level; stealing a police cruiser is
  a much bigger deal.
- **Wanted system and police** — 0–5 stars rise from crimes (stealing, hitting
  pedestrians, ramming cars, shooting). Police cars chase and ram you, foot
  cops chase you on foot and can bust you. Stay clean and the heat decays.
  Getting busted costs 15% of your money and clears your wanted level.
- **Missions and story** — five jobs for Mara's crew: meet at the Docks,
  a package run, stealing wheels and losing the heat, a turf war with the
  rival Vultures, and the big bank score. Markers on the map and minimap,
  objective text on the HUD, cash reward per job.
- **Combat** — punch (F) or shoot the pistol (G / click, limited ammo) at
  cops and rival gang members.
- **HUD** — wanted stars, health, money, mission objective, speed, current
  vehicle, and a live minimap showing streets, cars, police and the mission
  marker.
- **Start screen and save** — title screen, pause menu, and progress (money,
  jobs completed) saved to localStorage.
- **Sound** — WebAudio-synthesized engine hum, sirens, crash/punch/shot
  effects and a bass music loop. No audio files.
- **Polish** — a smooth chase camera, skid marks, crash sparks, and a warm
  sun-soaked palette.

## Run

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no
network requests — the game is plain static files under `game/`.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| E | Get in or out of a car |
| F | Punch |
| G / click | Shoot the pistol |
| Q | Switch weapon |
| P / Esc | Pause |
| R | Restart the current job |
| Enter | Start / continue |

<sub>Entered on [make.fun](https://make.fun/?ref=9srzvfjv&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
