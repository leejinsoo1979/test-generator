# Wardrobe Module Generator

A real-time generator for 3D wardrobe modules that instantly outputs `.glb` files and structured `.json` metadata.  
This tool is designed to work seamlessly with custom wardrobe editors and configurators.

## 🚀 Features

- Generate `.glb` 3D models based on panel size, location, and user input
- Simultaneous export of `.json` data representing module structure
- Designed for use with furniture configurators and online editors
- Live viewer integration using Three.js
- Modular, scalable code structure (React + Vite)

## 🛠 Tech Stack

- React / Vite
- Three.js / @react-three/fiber
- GLTFExporter
- Tailwind CSS
- JavaScript (ES6+)

## 📁 Directory Structure


/src
├── components/         # UI and 3D viewer components
├── hooks/              # Custom React hooks
├── utils/              # Utility functions for module rendering and export
└── assets/             # Icons and images
/public
└── vite.svg            # Public assets

## 💡 How It Works

1. User defines panel dimensions and position
2. The system calculates and renders the 3D model in the viewer
3. Upon export, a `.glb` and `.json` file are generated automatically
4. Ready to be used in a full-scale wardrobe editor or design tool

## 🧭 Roadmap

- Add support for additional module types (drawers, shelves)
- Drag-and-drop configuration UI
- WebSocket-based real-time collaboration
- AR preview (planned)

## 📄 License

This project is licensed under the MIT License.

---

Built with by [UABLE Corp.]

