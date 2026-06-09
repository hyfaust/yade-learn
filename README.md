# YADE DEM Learning Tutorials

[English](README.md) | [简体中文](README_zh.md)

---

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![YADE](https://img.shields.io/badge/YADE-2024.x-orange.svg)](https://yade-dem.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-green.svg)](https://www.python.org/)

> A progressive, hands-on tutorial series for learning the **YADE** (Yet Another Dynamic Engine) discrete element method (DEM) simulation framework — from a single bouncing sphere to advanced fluid-particle coupling.

## Table of Contents

- [Introduction](#introduction)
- [Learning Roadmap](#learning-roadmap)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project List](#project-list)
  - [Level 1: Beginner](#level-1-beginner)
  - [Level 2: Intermediate](#level-2-intermediate)
  - [Level 3: Advanced](#level-3-advanced)
- [Core Concepts Reference](#core-concepts-reference)
- [Web Viewer](#web-viewer)
- [Project Structure](#project-structure)
- [References](#references)
- [License](#license)

## Introduction

**YADE** is an open-source DEM framework for simulating granular materials, soils, rocks, concrete, and other particulate or discontinuous media. It provides a flexible, extensible architecture built on C++ with Python scripting support.

This repository contains **9 progressively challenging projects**, each in its own directory with:

- A detailed **Markdown tutorial** explaining key concepts, data structures, and the physics behind the simulation
- A runnable **Python script** (`*.py`) that can be executed with `yadedaily`
- An interactive **web-based viewer** (`index.html`) for browsing all tutorials in your browser

## Learning Roadmap

```
🟢 Beginner           🟡 Intermediate              🔴 Advanced
┌───────────────┐    ┌─────────────────────┐    ┌─────────────────────────┐
│ 1. Bouncing   │    │ 3. Oedometric Test   │    │ 6. Triaxial Test        │
│    Sphere     │    │ 4. Periodic Shear    │    │ 7. Concrete Mechanics   │
│ 2. Gravity    │───▶│ 5. Sphere Packing    │───▶│ 8. Clumps & Breakage    │
│    Deposition │    │                      │    │ 9. Fluid Coupling       │
└───────────────┘    └─────────────────────┘    └─────────────────────────┘
```

## Prerequisites

| Dependency | Version | Required |
|------------|---------|----------|
| YADE (daily) | Latest | Yes |
| Python | >= 3.10 | Yes (bundled with YADE) |

Install YADE on Ubuntu/Debian:

```bash
sudo apt install yadedaily
```

For other platforms, see the [YADE installation guide](https://yade-dem.org/doc/installation.html).

## Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd yade_learn

# Run the first tutorial: Bouncing Sphere
yadedaily 01_bouncing_sphere/bouncing_sphere.py

# Run any other tutorial
yadedaily 02_gravity_deposition/gravity_deposition.py
```

## Project List

### Level 1: Beginner

| # | Project | Description | Key Concepts |
|---|---------|-------------|--------------|
| 1 | [Bouncing Sphere](01_bouncing_sphere/) | The simplest DEM simulation: a single sphere bouncing on a flat surface | Body quartet, Engine pipeline, Gravity & collision |
| 2 | [Gravity Deposition](02_gravity_deposition/) | Multiple spheres settling under gravity into a container | SpherePack, makeCloud, Data recording & plotting |

### Level 2: Intermediate

| # | Project | Description | Key Concepts |
|---|---------|-------------|--------------|
| 3 | [Oedometric Test](03_oedometric_test/) | Uniaxial compression test with stress-strain analysis | UniaxialStrainer, Stress tensor, Force chains |
| 4 | [Periodic Simple Shear](04_periodic_shear/) | Shear simulation using periodic boundary conditions | O.cell, Periodic boundaries, Shear deformation |
| 5 | [Sphere Packing](05_sphere_packing/) | Various sphere packing generation methods and particle size distributions | Predicate, randomDensePack, PSD |

### Level 3: Advanced

| # | Project | Description | Key Concepts |
|---|---------|-------------|--------------|
| 6 | [Triaxial Test](06_triaxial_test/) | Complete triaxial stress path simulation | PeriTriaxController, Stress control, Mohr circle |
| 7 | [Concrete Mechanics](07_concrete_mechanics/) | Concrete tension/compression failure simulation | CpmMat, Damage evolution, Fracture mechanics |
| 8 | [Clumps & Breakage](08_clumps_breakage/) | Non-spherical particles and particle breakage | Clump, Aspherical dynamics, Breakage mechanisms |
| 9 | [Fluid Coupling](09_fluid_coupling/) | Fluid-particle coupling simulation | HydroForceEngine, Drag models, Fluidization |

## Core Concepts Reference

| Concept | Description |
|---------|-------------|
| **Body** | Fundamental unit in DEM, composed of Shape (geometry), Material, State (position/velocity), and Bound (AABB) |
| **Engine** | An operation step in the simulation loop, executed in order: reset forces → collision detection → contact resolution → external forces → motion integration |
| **Functor** | A function object that dispatches tasks based on object types — the core of YADE's flexibility |
| **Scene** | Top-level container holding all Bodies, Interactions, and Engines |
| **Interaction** | A contact between two Bodies, containing geometry info (IGeom) and physical info (IPhys) |
| **SpherePack** | Utility class for generating and manipulating sphere packings (random, dense, periodic, etc.) |
| **Periodic Cell** | A virtual box that repeats infinitely in all directions, eliminating boundary effects |

## Web Viewer

An interactive web-based tutorial viewer is included. Launch it with any static HTTP server:

```bash
# Using Python
python3 -m http.server 8080

# Then open http://localhost:8080 in your browser
```

Features:
- Dark/light theme toggle
- Chapter navigation sidebar with difficulty levels
- Full-text search across all chapters
- Code syntax highlighting
- Reading progress tracking
- Responsive design for mobile and desktop

## Project Structure

```
yade_learn/
├── index.html                  # Web viewer entry point
├── style.css                   # Web viewer styles
├── app.js                      # Web viewer application logic
├── README.md                   # This file (English)
├── README_zh.md                # Chinese documentation
├── LICENSE                     # GPL v3 License
├── 01_bouncing_sphere/         # Tutorial 1: Single sphere bounce
│   ├── bouncing_sphere.py      #   Simulation script
│   └── README.md               #   Tutorial documentation
├── 02_gravity_deposition/      # Tutorial 2: Gravity deposition
├── 03_oedometric_test/         # Tutorial 3: Oedometric compression
├── 04_periodic_shear/          # Tutorial 4: Periodic shear
├── 05_sphere_packing/          # Tutorial 5: Sphere packing methods
├── 06_triaxial_test/           # Tutorial 6: Triaxial test
├── 07_concrete_mechanics/      # Tutorial 7: Concrete mechanics
├── 08_clumps_breakage/         # Tutorial 8: Clumps and breakage
└── 09_fluid_coupling/          # Tutorial 9: Fluid-particle coupling
```

Each tutorial directory contains:
- `*.py` — Runnable YADE simulation script (execute with `yadedaily`)
- `README.md` — Detailed tutorial with concept explanations, code walkthrough, and exercises

## References

- [YADE Official Documentation](https://yade-dem.org/doc/)
- [YADE Source Code (GitLab)](https://gitlab.com/yade-dev/trunk)
- [YADE Community Q&A](https://answers.launchpad.net/yade)
- Šmilauer, V. et al. (2024). *Yade Documentation*. https://yade-dem.org/doc/
- Radjai, F. & Dubois, F. (Eds.) (2011). *Discrete-element Modeling of Granular Materials*. Wiley-ISTE.

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
