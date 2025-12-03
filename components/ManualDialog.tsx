import React, { useEffect, useState } from 'react';
import { X, Download, Book, FileText } from 'lucide-react';
import { marked } from 'marked';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const MANUAL_CONTENT = `
# ChromaForge User Manual
**Version 1.2 | Katje B.V.**

---

## 1. Introduction to ChromaForge

Welcome to **ChromaForge**, a professional-grade AI-powered tool designed to transform simple line art and sketches into fully realized, photorealistic masterpieces. Unlike generic image generators, ChromaForge focuses specifically on the *colorization and rendering* of existing structures, preserving the composition of your original drawings while applying sophisticated lighting, texturing, and character detailing.

This application leverages the Google Gemini 3 Pro Vision model to understand the semantic content of your sketches. It doesn't just "guess" colors; it identifies characters, environments, and objects, and then applies a rigorous set of user-defined constraints to generate variations.

### Core Philosophy
The core philosophy of ChromaForge is **Combinatorial Creativity**. Instead of writing one prompt and hoping for the best, ChromaForge allows you to define sets of variables (e.g., 3 different lighting conditions, 2 different outfits, and 4 art styles). The engine then mathematically permutes these options to generate every unique combination, allowing you to explore a vast creative space systematically.

---

## 2. Getting Started

### 2.1 System Requirements
ChromaForge is a web-based application that runs entirely in your browser.
*   **Browser**: Latest versions of Chrome, Edge, Firefox, or Safari.
*   **Hardware**: No heavy GPU required locally; all processing happens in the cloud. A stable internet connection is essential.
*   **Display**: Optimized for desktop resolutions (1080p or higher recommended).

### 2.2 API Key Configuration
To function, ChromaForge requires access to Google's Generative AI services.
1.  Click the **Shield Icon** or **Set API Key** button in the top header.
2.  You will be prompted to select a Google Cloud Project with billing enabled.
3.  Once authorized, the key is securely handled by the session.
    *   *Note: This application does not store your API key on any external server controlled by Katje B.V.; it is used directly between your browser and Google APIs.*

---

## 3. Interface Overview

The user interface is divided into three main operational zones:

### 3.1 Input Queue (Left Panel)
This is your staging area.
*   **Drag & Drop**: You can drag multiple image files (PNG, JPG, WEBP) directly onto the dashed drop zone.
*   **Status Indicators**: Each image card shows its current state:
    *   \`QUEUED\`: Waiting for processing.
    *   \`ANALYZING\`: The AI is currently scanning the image to generate a title and description.
    *   \`PROCESSING\`: The AI is currently generating variations. A progress bar will appear.
    *   \`COMPLETED\`: All requested variations have been generated.
    *   \`FAILED\`: An error occurred (see Troubleshooting).
*   **Controls**: Hovering over an image allows you to **Delete** it. Completed images have a **Rerun** button to restart the batch with new settings.

### 3.2 Main Gallery (Center Panel)
This is where your creations appear.
*   **Masonry Layout**: Images are arranged dynamically to respect their original aspect ratios.
*   **Interaction**: Click any image to open the **Detail View** (Deep Zoom).
*   **Metadata**: Hovering over an image reveals the filename and the specific options combination used to generate it.
*   **Clear Gallery**: A trash icon in the toolbar allows you to clear the current session's results.

### 3.3 Failed Jobs (Right Panel)
If a generation fails (due to safety filters or API limits), it appears here.
*   **Retry**: You can retry individual failed jobs.
*   **Retry All**: A master button to re-queue all failures at once.
*   **Error Details**: Provides a technical reason for the failure (e.g., "Safety Block: Sexual Content").

### 3.4 Header & Controls
*   **Start/Stop**: The primary control for the batch processing engine.
*   **Configuration (Settings Icon)**: Opens the Permutation Logic editor.
*   **Console (Terminal Icon)**: Opens the system logs for advanced debugging.
*   **Stats Dashboard**: Displays the total scheduled variations vs. completed and failed jobs.

---

## 4. The Configuration Engine

This is the heart of ChromaForge. Clicking **Configure Generation** opens a comprehensive dialog where you define the logic for your batch.

### 4.1 Permutations vs. Combinations
ChromaForge operates on a **Cartesian Product** logic.
*   **Example**: If you select \`Gender: Female\`, \`Hair: [Red, Blonde]\`, and \`Time: [Noon, Midnight]\`.
*   **Result**: The system will generate **4 images** (Female+Red+Noon, Female+Red+Midnight, Female+Blonde+Noon, Female+Blonde+Midnight).

#### The "Combine Selections" Feature
In any category (e.g., Clothing), you will see a **"Combine Selections"** checkbox in the header.
*   **Unchecked (Default)**: Generates one image per selected option (Permutation).
*   **Checked**: Merges all selected options into a single prompt.
    *   *Example*: Selecting "Boots" and "Anklets" with Combine checked will generate **one** image with "Boots AND Anklets", rather than two separate images.

### 4.2 Character Configuration
*   **Gender & Age**: Defines the demographic of the subject.
*   **Skin & Hair**: Offers a wide range of natural and fantasy colors (e.g., "Blueish", "Metallic").
*   **Species**:
    *   *Standard*: Humans, Elves, Dwarves.
    *   *Franchise Specific*: Twi'lek (Star Wars), Klingon (Star Trek), Na'vi (Avatar).
    *   *Note*: Selecting a non-human species will override most human physiological descriptors.

### 4.3 Attire & Clothing
Clothing is organized into functional groups.
*   **Casual / Office / Uniforms**: Standard daily wear.
*   **Armor / Fantasy**: Plate mail, leather, robes.
*   **Implied Nudity / Artistic**:
    *   This section includes sensitive options like "Nude (Implied)", "Body Paint", or "Chained".
    *   **Safety Mechanism**: ChromaForge automatically appends "Strategic Coverage" instructions to these prompts (e.g., "cover with leaves, shadow, or hair") to ensure the output remains artistic and non-explicit, adhering to safety guidelines while fulfilling the creative request.

### 4.4 Decorations (Body Mods)
Customize the fine details of your character.
*   **Tattoos**: Tribal, sleeve, Yakuza-style, etc.
*   **Piercings**: Nose rings, industrial piercings, etc.
*   **Scars & Marks**: Battle scars, burn marks, freckles.
*   **Makeup**: War paint, geisha makeup, camouflage.

### 4.5 Environment & World Building
*   **Technology Level**: Sets the era (Stone Age to Intergalactic). This logic is "sticky"—if you select "Bronze Age", the AI will try to avoid putting the character in a modern suit, even if requested, or will adapt the suit to look primitive.
*   **Environment**:
    *   *Indoors*: Libraries, throne rooms, bunkers.
    *   *Outdoors*: Nature and Urban settings.
    *   *Abstract*: Studio lighting, solid backgrounds.
*   **Time of Day & Weather**: drastically affects the lighting and mood. "Golden Hour" provides warm light; "Cyberpunk" environments often force neon lighting.

### 4.6 Artistic Control
*   **Art Style**: Defaults to "Photorealistic" (4K render). Can be changed to "Oil Painting", "Watercolor", "Anime", "Ukiyo-e", etc.
*   **Camera**: "Wide Angle", "Telephoto", "Drone View".
*   **Lighting**: "Volumetric Fog", "Rembrandt", "Neon".

### 4.7 Advanced Custom Settings
Located in the **Custom** tab.

#### A. Landscape Mode (Remove Characters)
*   **Function**: When enabled, the AI is instructed to **ignore** all character-related prompts (Gender, Clothes, etc.).
*   **Use Case**: You have a line art of a person standing in a forest, but you only want to generate the forest background without the person.
*   **In-filling**: The AI will attempt to "in-fill" the space where the character was, effectively erasing them from the scene.

#### B. Replace Background
*   **Function**: Instructs the AI to perform a segmentation/extraction of the main subject and completely discard the background drawn in the line art.
*   **Use Case**: You have a sketch of a character on a plain paper, but you want them standing on "The Moon".
*   **Integration**: The AI generates the new background and attempts to composite the character seamlessly with correct lighting matching that background.

---

## 5. Workflow Strategies

### 5.1 Efficient Batching
Because of the combinatorial nature of the app, variation counts can explode quickly.
*   **Tip**: Use the **Counter** in the configuration header. If it turns yellow/amber, you are generating over 20 images per input file.
*   **Tip**: Start small. Select 1 Art Style and 1 Environment to test how the AI interprets your specific line art style before selecting 10 different outfits.

### 5.2 Handling Line Art Quality
*   **Clean Lines**: The better the input line art, the better the result. High contrast black-and-white images work best.
*   **Sketches**: Rough sketches are acceptable, but the AI might interpret stray pencil marks as texture or floating objects.
*   **Incomplete Lines**: If your line art has gaps (open shapes), colors may "bleed" or the AI might misinterpret the form.

### 5.3 Analyzing Inputs
When you add an image, ChromaForge runs an **Analysis Phase**.
*   It detects objects and safety levels.
*   It generates a markdown file (automatically downloaded) containing a description of what the AI "sees" in your sketch.
*   **Why is this useful?** If the AI keeps generating the wrong thing (e.g., thinking a hat is a rock), check the analysis. If the analysis is wrong, the drawing might be too ambiguous.

---

## 6. Technical Details & Troubleshooting

### 6.1 The Processing Loop
1.  **Queue**: Images sit in the queue until "Start" is clicked.
2.  **Analysis**: The first step is always analyzing the image content.
3.  **Job Creation**: The app calculates all permutations and creates "Jobs".
4.  **Execution**: Jobs are processed 2 at a time (Max Concurrency).
5.  **Result**: The image is returned as a base64 stream and saved to memory.

### 6.2 Data Persistence
*   **Input Queue**: Saved to your browser's IndexedDB. If you refresh the page, your queued images should remain (though generated images in the gallery are currently session-only to save memory).
*   **Configuration**: Saved to LocalStorage. Your settings persist between visits.

### 6.3 Common Errors
*   **"Safety" Block**: The Gemini model has strict safety filters. If your prompt combined with the visual input implies explicit sexual violence or extreme gore, the generation will be blocked.
    *   *Solution*: Try using the "Implied Nudity" options which add safety keywords, or reduce the explicitness of the prompt.
*   **"API Key Missing"**: You must re-select the key if the session expires.
*   **"Overloaded"**: If Google's servers are busy, you may see 503 errors. The app has built-in retry logic, but sometimes you just need to wait.

### 6.4 Downloads
*   **Auto-Download**: By default, every generated image is automatically downloaded to your device's default download folder.
*   **Filename Format**: \`{OriginalName}_{OptionSummary}.png\`

---

## 7. Privacy & Security
*   **Local Processing**: ChromaForge does not upload your images to any private server owned by the developers. Images are sent directly from your browser to Google's API endpoints.
*   **Google Data Usage**: Please refer to Google's Generative AI Terms of Service regarding how they handle data sent to the Gemini API. Generally, for paid tiers (using your own API key), data is not used to train models, but you should verify this based on your specific Google Cloud agreement.

---

## 8. Keyboard Shortcuts
*   **ESC**: Close any open dialog (Options, Console, Detail View).
*   **Left / Right Arrow**: Navigate through images in the Detail View.

---

**ChromaForge** is a tool for the modern digital artist—a forge where the raw iron of a sketch is hammered into the steel of a masterpiece. Happy creating!
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
                    <p className="mt-2">ChromaForge v1.2</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ManualDialog;