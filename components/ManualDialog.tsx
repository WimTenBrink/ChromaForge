
import React, { useEffect, useState } from 'react';
import { X, Download, Book, FileText } from 'lucide-react';
import { marked } from 'marked';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const MANUAL_CONTENT = `
# ChromaForge User Manual
**Version 2.5 | Katje B.V.**

---

## 1. Introduction

**ChromaForge** is a professional AI-powered tool designed to colorize and render line art into photorealistic 4K masterpieces. It utilizes a **Combinatorial Generation Engine** to create multiple variations of an image based on logical configuration attributes.

---

## 2. The User Interface

The application is divided into two main sections:
1.  **Sidebar (20vw)**: The control center for all files and queues.
2.  **Gallery (80vw)**: The display area for generated results.

### 2.1 The Sidebar Queues
The sidebar is organized into tabs using icon navigation at the top:

*   **Uploads (Image Icon)**:
    *   Contains the original source images you dragged into the app.
    *   **Filtering**: Click the checkbox on an image to filter the main gallery. Only results derived from that specific source will be shown.
    *   **Status**: A green glowing border indicates that all jobs associated with this source have finished processing.
*   **Check / Validating (Scan Icon)**:
    *   When an image is uploaded, it enters this queue first.
    *   The AI analyzes the visual content to generate a descriptive, safe filename automatically.
    *   Once named, it moves to the Jobs/Queue.
*   **Jobs (Spinner Icon)**:
    *   Shows jobs currently being processed by the AI.
    *   Maximum concurrent jobs: **5**.
*   **Queue (Layers Icon)**:
    *   Jobs waiting for their turn.
    *   Processed from top to bottom.
*   **Failed (Refresh Icon)**:
    *   Jobs that failed due to network errors or timeouts.
    *   **Retry Limit**: 3 attempts allowed.
    *   **Action**: Use the **Retry All** button to re-queue them.
*   **Ban / Prohibited (Ban Icon)**:
    *   Jobs rejected by the AI safety filters (Prohibited Content).
    *   **Retry Limit**: 1 attempt allowed (in case of false positive).
    *   **Action**: Use the **Retry All** button.
*   **Dead / Blocked (X Icon)**:
    *   Jobs that have exceeded their retry limits. They cannot be processed.

### 2.2 The Main Gallery
*   **Layout**: Images are displayed in a grid, constrained to 400px max dimension.
*   **Sorting**: Use the controls in the top bar to sort by:
    *   **Queue**: Groups images by their source file.
    *   **Name**: Sorts alphabetically by filename.
    *   **Time**: Sorts by generation timestamp.
    *   **Order**: Toggle Ascending/Descending.
*   **Navigation**:
    *   Floating buttons in the bottom-right allow instant scrolling to **Top** or **Bottom**.
*   **Image Actions**:
    *   **Zoom**: Click an image to view in full resolution.
    *   **Repeat**: Hover over an image and click the **Refresh** icon to duplicate that specific job configuration and run it again.
    *   **Delete**: Remove specific results.

---

## 3. Workflow

### 3.1 Importing Images
*   **Drop Zone**: Drag and drop one or multiple image files anywhere on the screen.
*   **Snapshotting**: The moment you drop a file, the current Configuration is "frozen" into that job. Changing settings afterwards will not affect files already in the queue.

### 3.2 Combinatorial Logic
ChromaForge generates a Cartesian product of your settings.
*   *Example*: Selecting "Elf" (Species) + "Red", "Blue" (Hair) + "Forest", "City" (Environment).
*   *Result*: $1 \\times 2 \\times 2 = 4$ distinct jobs per uploaded image.

### 3.3 Safety & Retry System
*   **Standard Failure**: Network issues or server overloads. Retriable 3 times.
*   **Safety Violation**: If the AI detects prohibited content (e.g., specific nudity not covered by artistic exemptions), it flags the job. You get 1 retry chance.
*   **Blocked**: After limits are reached, the job is moved to the "Dead" queue to prevent infinite loops.

---

## 4. Configuration

Click **Configure Generation** to access the logic engine.

### 4.1 Visual Indicators
*   **Emerald Pill**: Single selection active.
*   **Blue Pill**: Multiple items selected in a category.
*   **Indigo Pill**: "Combine Selections" is active (merges all selected items into one prompt instead of creating variations).

### 4.2 Special Categories
*   **Bondage**: A dedicated tab for restraint and capture scenarios.
    *   *Note*: Selecting these options automatically triggers "Implied Nudity" safety overrides in the prompt engineering to prevent the AI from generating excessive clothing that would obscure the requested concept, while maintaining TOS compliance.
*   **Landscape Mode (Custom Tab)**:
    *   **Remove Characters**: Instructs the AI to generate a scene with NO people.
    *   **Replace Background**: Discards the original background lines entirely and generates a new environment.

### 4.3 Presets
*   Save your complex configurations to \`.kcf\` files to reload them later.

---

## 5. Technical Details

*   **Validation**: Uses \`gemini-2.5-flash\` for rapid image analysis and naming.
*   **Generation**: Uses \`gemini-3-pro-image-preview\` for high-fidelity 4K output.
*   **Persistence**: The Queue and Uploads are saved to your browser's local database (IndexedDB). They survive page reloads. The Gallery results are session-based and should be downloaded (auto-download is active).

---

*(c) 2024 Katje B.V. - ChromaForge*
`;

const ManualDialog: React.FC<Props> = ({ isOpen, onClose }) => {
  const [htmlContent, setHtmlContent] = useState('');

  useEffect(() => {
    // Parse markdown to HTML
    if (isOpen) {
        try {
            // Configure marked options if needed, defaults are usually fine
            const parsed = marked.parse(MANUAL_CONTENT);
            // Handle both sync (string) and async (Promise) returns just in case
            if (parsed instanceof Promise) {
                parsed.then(res => setHtmlContent(res));
            } else {
                setHtmlContent(parsed as string);
            }
        } catch (e) {
            console.error("Failed to parse manual content", e);
            setHtmlContent("<p>Error loading manual.</p>");
        }
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
                    <p className="mt-2">ChromaForge v2.5</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ManualDialog;