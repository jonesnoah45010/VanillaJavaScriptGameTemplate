# Vanilla JavaScript Game Template

A lightweight template for building a **3D game using vanilla JavaScript** (no frameworks), focused on clarity, extensibility, and learning-by-modifying. 

---
Note: The app should run on any version of Python but python3.11 is the most tried and true.
---

## 📚 Documentation

Start here to understand and customize the game:

- **`GameCoreDoc.md`**  
  Core engine overview, helper functions, and how the game loop works (`start()` vs `update()`).

- **`GameCoreCharacterAnimationGuide.md`**  
  Step-by-step guide for replacing the player character using **Tinkercad → Mixamo**, including rigging, animations, and FBX setup.

- **`GameCoreConfigsDoc.md`**  
  Complete reference for all `CONFIG` variables, what they do, and how changing them affects gameplay and feel.

- **`Lesson1AddKickAnimation.md`**  
  Instructions for how to add a kick animation to static/js/game_core.js, see lesson1-game_core_kick.js for finished code.

- **`Lesson1AddKickCrateBehavior.md`**  
  Instructions for how to add physical kick trigger to a crate object in static/js/game_core.js, see lesson2-game_core_kick_crate.js for finished code. Assumes you have already finished Lesson1.

- **`Lesson3AddPointsFromDestroyingCrates.md`**  
  Instructions for how to add crate destruction and points to static/js/game_core.js, see lesson3-game_core_kick_crate_points.js for finished code. Assumes you have already finished Lesson2.

- **`Lesson4AddNPC.md`**  
  Instructions for how to add friendly NPC to static/js/game_core.js, see lesson4-game_core_kick_crate_points-npc.js for finished code. Assumes you have already finished Lesson3.

---

Each document is designed to be read independently, but together they explain:
- how the engine is structured
- how assets and animations are loaded
- how to tune movement, camera, climbing, and physics
- how to safely customize the game without breaking the core loop








# Running the App Locally

These instructions work on **macOS, Windows, and Linux**.

---

## 1) Prerequisites

- **Python 3.9+** (recommended)
- **pip** (comes with Python)
- A terminal:
  - macOS: Terminal
  - Windows: PowerShell / Windows Terminal
  - Linux: your preferred terminal

---

## 2) Clone or Download the Project

If you downloaded the project as a ZIP file, unzip it and open a terminal in the project’s root folder (the folder containing `main.py`).

If you’re using git:

```bash
git clone <YOUR_REPO_URL_HERE>
cd <YOUR_PROJECT_FOLDER>
```
Alternatively, just download the repo as a zip file, unzip and navigate to it in your command line using `cd`

---

## 3) Create a Virtual Environment (Recommended)

### macOS / Linux
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Windows (PowerShell)
```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

> If PowerShell blocks activation, run:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```
> then try activating again.

---

## 4) Install Dependencies

Install all required Python packages from `requirements.txt`:

### macOS / Linux
```bash
pip install -r requirements.txt
```

### Windows
```powershell
py -m pip install -r requirements.txt
```

---

## 5) Run the App

Start the server by running:

### macOS / Linux
```bash
python3 main.py
```

### Windows
```powershell
py main.py
```

You should see terminal output indicating that the server is running.

---

## 6) Open the App in Your Browser

Open your web browser and navigate to the local URL printed in the terminal.

Common defaults include:

- `http://127.0.0.1:5000`
- `http://localhost:5000`
- `http://127.0.0.1:8000`
- `http://localhost:8000`

Use **exactly** the URL shown in your terminal output if it differs.

---

## Stopping the Server

To stop the server, return to the terminal and press:

```
Ctrl + C
```

---

## Troubleshooting

### Missing packages / `ModuleNotFoundError`
Make sure your virtual environment is activated, then re-run:

```bash
pip install -r requirements.txt
```

### Port already in use
Another process is using the same port.

You can:
- stop the other process, or
- change the port in `main.py` (if supported), then restart the app.

### Static files not loading
Ensure you are running the app from the **project root directory** (the same directory that contains `main.py`).

---

If you run into issues, check the terminal output carefully—it usually tells you exactly what went wrong.
