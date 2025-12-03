import React, { useEffect, useState } from 'react';
import { X, Download, Book, FileText } from 'lucide-react';
import { marked } from 'marked';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const MANUAL_CONTENT = `
# ChromaForge User Manual
**Version 2.0 | Katje B.V.**

---

## 1. Introduction

**ChromaForge** is a professional AI-powered tool for transforming line art into photorealistic 4K masterpieces. It uses a **Combinatorial Generation Engine** to create distinct variations of your artwork based on structured logical inputs.

### Core Architecture: "One Job Per Configuration"
Unlike standard image generators, ChromaForge treats every single configuration as a unique **Job**.
*   If you select 1 Gender, 2 Hair Colors, and 3 Environments, the system calculates $1 \\times 2 \\times 3 = 6$ distinct permutations.
*   When you drag an image into the app, **6 separate jobs** are immediately created in the queue.
*   **Snapshotting**: Each job "remembers" the exact settings active at the moment you added the file. Changing global settings afterwards *will not* change the jobs already in the queue.

---

## 2. Workflow & Interface

### 2.1 Global Drop Zone
The entire application window is a drop zone.
*   **Action**: Drag one or multiple image files (PNG, JPG, WEBP) anywhere onto the screen.
*   **Result**: The system immediately calculates the permutations based on your *current* configuration and adds them to the Input Queue.

### 2.2 The Input Queue (Left Sidebar)
This list represents your production line.
*   **Granular Items**: Each item is a specific variation (e.g., *"Elf, Red Hair, Sunset"*), not just the source file.
*   **Thumbnails**: Full-width thumbnails allow you to preview the source line art. **Click to Zoom** deeply into the source image.
*   **Reordering**: Use the **Up/Down** and **Top/Bottom** buttons on each card to prioritize specific variations.
*   **Processing**: The system processes the queue from **Top to Bottom**, handling **3 jobs concurrently**.

### 2.3 The Gallery (Center)
*   **Viewing**: Click any image to open the **Detail View**. Use Arrow Keys to navigate.
*   **Zooming**: Scroll to zoom in/out; drag to pan.
*   **Management**:
    *   **Delete**: Each image has a trash icon to remove it from the session.
    *   **Clear Gallery**: Removes all generated results (does not affect the queue).
*   **Auto-Download**: Generated images are automatically downloaded to your device with filenames describing their specific configuration.

### 2.4 Failed Jobs (Right Sidebar)
*   **Retry Limit**: A job can be retried up to **5 times**. After 5 failures, it is permanently locked to prevent API loops.
*   **Manual Retry**: Failures are not retried automatically. You must click the **Retry** button (Refresh icon).
*   **Zoom**: You can zoom in on failed thumbnails to inspect if the source image quality caused the issue.

### 2.5 Dashboard Header
*   **Stats**: Shows Pending vs. Completed jobs.
*   **ETR (Estimated Time Remaining)**: Calculates based on the average duration of recent jobs.
*   **API Key**: Status indicator for your Google Gemini API connection.

---

## 3. Configuration & Options

Click **Configure Generation** to access the logic engine.

### 3.1 Presets (.kcf)
You can now save and load your configurations.
*   **Save Preset**: Exports your current settings to a \`.kcf\` (JSON) file. You will be prompted for a name.
*   **Load Preset**: Imports settings from a file, restoring your complex logic setups.

### 3.2 Feature Categories

#### **Character & Body**
*   **Eye Color**: Dedicated options for iris coloration.
*   **Emotions**: Force specific expressions (e.g., "Screaming", "Seductive", "Stoic").
*   **Actions**: Define dynamic poses like "Fighting", "Swimming", or "Casting Spell".
*   **Skin Effects**: A specialized tab for surface textures.
    *   **Zones**: Apply effects to Face, Arms, Legs, or Whole Body.
    *   **Options**: Mud, Dust, Blood, Oil, Paint, Soot, Sweat, etc.

#### **Camera & Composition**
*   **Full Body**: A specific instruction to ensure the AI frames the character from head to toe.
*   **Angles**: Aerial, Dutch Angle, Low Angle, etc.

#### **World Building**
*   **Technology**: Now includes Fantasy levels (High Fantasy, Magitech, Steampunk, D&D Tech Levels).
*   **As-Is (Skip)**: Every category now includes an "As-Is" option. This tells the AI to ignore that specific category and use its own judgment based on the visual input.

### 3.3 Advanced Modes (Custom Tab)
*   **Landscape Mode (Remove Characters)**:
    *   Instructs the AI to erase people from the scene and in-fill the background.
    *   Disables character-specific tabs (Gender, Attire, etc.) to prevent logical conflicts.
*   **Replace Background**:
    *   Performs subject segmentation to discard the original line art background and generate a new one based on "Environment" settings.

---

## 4. Tips for Success

1.  **Check Settings BEFORE Dragging**: Because jobs snapshot settings immediately, ensure your configuration is correct before dragging in 10 files.
2.  **Use the Permutation Counter**: The calculator in the config header updates in real-time. If it says "120 Combinations", dragging **one** image will add **120 jobs** to the queue.
3.  **Facial Details**: The system is prompted to strictly preserve facial features, but "Close-up" camera angles often yield the highest fidelity faces.
4.  **Zooming**: Use the zoom feature on sidebar items to check if your source line art has enough contrast. Faint pencil lines can sometimes be misinterpreted as "fog" or "texture".

---

## 5. Technical Notes

*   **Markdown Analysis**: Automatic markdown report generation has been disabled to streamline the batch workflow.
*   **Privacy**: Images are processed in memory and sent directly to Google Cloud. No images are stored on intermediate servers.
*   **Session Storage**: The Input Queue persists via your browser's IndexedDB, but the Gallery is session-based. Download your results!

---

*(c) 2024 Katje B.V. - ChromaForge*
`;

const ManualDialog: React.FC<Props> = ({ isOpen, onClose }) => {
  const [htmlContent, setHtmlContent] = useState('');

  useEffect(() => {
    // Parse markdown to HTML
    if (isOpen) {
        // Configure marked options if needed, defaults are usually fine
        const parsed = marked.parse(MANUAL_CONTENT) as string;
        setHtmlContent(parsed);
    }
  }, [isOpen]);

  const handleDownload = () => {
    const blob = new Blob([MANUAL_CONTENT], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ChromaForge_Manual.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-[95vw] h-[96vh] bg-slate-900 border border-slate-700 rounded-xl flex flex-col shadow-2xl relative">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950 rounded-t-xl z-10">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-900/30 rounded-lg border border-emerald-500/30 text-emerald-400">
                    <Book size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white">ChromaForge Documentation</h2>
                    <p className="text-sm text-slate-400">User Manual & Reference Guide</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <button 
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg transition-colors font-medium text-sm"
                >
                    <Download size={16} />
                    Download Manual (.md)
                </button>
                <button 
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-white hover:bg-red-900/20 rounded-lg transition-colors"
                >
                    <X size={28} />
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-950 p-8 sm:p-12">
            <div className="max-w-5xl mx-auto">
                <div 
                    className="prose prose-invert prose-emerald max-w-none"
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                />
                
                {/* Footer of document */}
                <div className="mt-16 pt-8 border-t border-slate-800 flex flex-col items-center text-slate-500 text-sm">
                    <p>© {new Date().getFullYear()} Katje B.V. All rights reserved.</p>
                    <p className="mt-2">ChromaForge v2.0</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ManualDialog;