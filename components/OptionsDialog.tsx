import React, { useState, useMemo, useRef } from 'react';
import { X, User, Zap, Map as MapIcon, Clock, Sparkles, Monitor, Package, Sliders, Palette, Lightbulb, Camera, Smile, Cloud, Brush, Calculator, Ban, Shirt, CheckSquare, Square, Layers, Activity, Droplets, Download, Upload, Check, Sword, Lock, Bug, Cog, Flame } from 'lucide-react';
import { AppOptions, GlobalConfig } from '../types';
import { DEFAULT_OPTIONS, DND_CLASSES } from '../constants';
import { countPermutations } from '../utils/combinatorics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  options: AppOptions;
  setOptions: (o: AppOptions) => void;
  config: GlobalConfig | null;
}

type TabID = 'CHAR' | 'ATTIRE' | 'BONDAGE' | 'DND' | 'POWERS' | 'SPECIES' | 'ANIMALS' | 'ITEMS' | 'DECOR' | 'SKIN_FX' | 'TECH' | 'ENV' | 'TIME' | 'WEATHER' | 'RATIO' | 'STYLE' | 'LIGHTING' | 'CAMERA' | 'MOOD' | 'ACTION' | 'CUSTOM';

const OptionsDialog: React.FC<Props> = ({ isOpen, onClose, options, setOptions, config }) => {
  const [activeTab, setActiveTab] = useState<TabID>('CHAR');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for Save Preset UI
  const [isNamingPreset, setIsNamingPreset] = useState(false);
  const [presetName, setPresetName] = useState('ChromaForge');

  const permutationCount = useMemo(() => {
    return countPermutations(options, config);
  }, [options, config]);

  if (!isOpen || !config) return null;

  const toggleOption = (category: keyof AppOptions, value: string) => {
    if (Array.isArray(options[category])) {
        const arr = options[category] as string[];
        setOptions({
          ...options,
          [category]: arr.includes(value)
            ? arr.filter(v => v !== value)
            : [...arr, value]
        });
    }
  };
  
  const removeOption = (category: keyof AppOptions, value: string) => {
      if (Array.isArray(options[category])) {
        const arr = options[category] as string[];
        setOptions({
          ...options,
          [category]: arr.filter(v => v !== value)
        });
      }
  };
  
  const toggleBoolean = (category: keyof AppOptions) => {
      setOptions({
          ...options,
          [category]: !options[category]
      });
  };

  const handleSettingChange = (category: keyof AppOptions, value: any) => {
      setOptions({
          ...options,
          [category]: value
      });
  };

  const toggleCombinedGroup = (category: keyof AppOptions) => {
      const current = options.combinedGroups || [];
      const exists = current.includes(category);
      setOptions({
          ...options,
          combinedGroups: exists 
            ? current.filter(c => c !== category)
            : [...current, category]
      });
  };

  // Helper to map Option Keys to Tab IDs for navigation
  const getTabForKey = (key: keyof AppOptions): TabID | null => {
      const map: Record<string, TabID> = {
          gender: 'CHAR', age: 'CHAR', bodyType: 'CHAR', breastSize: 'CHAR', skin: 'CHAR', hair: 'CHAR', eyeColor: 'CHAR', emotions: 'CHAR',
          clothes: 'ATTIRE', shoes: 'ATTIRE',
          bondage: 'BONDAGE',
          dndClass: 'DND', dndFighterOutfit: 'DND', dndFighterWeapon: 'DND', dndClericOutfit: 'DND', dndClericWeapon: 'DND', 
          dndPaladinOutfit: 'DND', dndPaladinWeapon: 'DND', dndRogueOutfit: 'DND', dndRogueWeapon: 'DND', dndWizardOutfit: 'DND', 
          dndWizardWeapon: 'DND', dndMonkOutfit: 'DND', dndMonkWeapon: 'DND', dndBarbarianOutfit: 'DND', dndBarbarianWeapon: 'DND', 
          dndDruidOutfit: 'DND', dndDruidWeapon: 'DND',
          species: 'SPECIES',
          animals: 'ANIMALS',
          items: 'ITEMS',
          decorations: 'DECOR',
          skinConditions: 'SKIN_FX',
          superhero: 'POWERS',
          technology: 'TECH',
          environment: 'ENV',
          timeOfDay: 'TIME',
          weather: 'WEATHER',
          artStyle: 'STYLE',
          lighting: 'LIGHTING',
          camera: 'CAMERA',
          mood: 'MOOD',
          actions: 'ACTION',
          aspectRatio: 'RATIO',
          replaceBackground: 'CUSTOM',
          removeCharacters: 'CUSTOM',
          modesty: 'CUSTOM'
      };
      return map[key] || null;
  };

  const navigateToOption = (key: keyof AppOptions) => {
      const targetTab = getTabForKey(key);
      if (targetTab) setActiveTab(targetTab);
  };

  const handleSaveClick = () => {
    setPresetName('ChromaForge');
    setIsNamingPreset(true);
  };

  const performSave = () => {
    let filename = presetName.trim() || 'ChromaForge';
    // Ensure extension
    filename = filename.replace(/\.kcf$/i, ''); // Remove if user typed it
    filename += '.kcf';

    const data = JSON.stringify(options, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setIsNamingPreset(false);
  };

  const handleLoadConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const parsed = JSON.parse(event.target?.result as string);
            // Merge with default options to ensure all required fields exist even if the file is old
            setOptions({ ...DEFAULT_OPTIONS, ...parsed });
        } catch (err) {
            console.error("Failed to parse config file", err);
            alert("Failed to load configuration. The file might be corrupted.");
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const renderOptionItem = (category: keyof AppOptions, item: string) => {
      const isSelected = (options[category] as string[]).includes(item);
      return (
      <label key={item} className={`flex items-center gap-2 p-3 rounded cursor-pointer border transition-all ${
        isSelected
          ? 'bg-violet-900/30 border-violet-500/50 text-violet-300'
          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750 hover:border-slate-600'
      }`}>
        <input
          type="checkbox"
          className="hidden"
          checked={isSelected}
          onChange={() => toggleOption(category, item)}
        />
        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
            isSelected ? 'bg-violet-500 border-violet-500' : 'border-slate-500'
        }`}>
           {isSelected && <div className="w-2 h-2 bg-black rounded-sm" />} 
        </div>
        <span className="text-sm select-none truncate" title={item}>{item}</span>
      </label>
      );
  };

  const renderCombineHeader = (category: keyof AppOptions, title: string) => {
      const isCombined = options.combinedGroups?.includes(category);
      const selectedCount = (options[category] as string[])?.length || 0;

      return (
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{title}</h3>
            
            <label className={`flex items-center gap-2 text-xs cursor-pointer transition-colors ${
                isCombined ? 'text-violet-400' : 'text-slate-500 hover:text-slate-300'
            }`}>
                <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={isCombined} 
                    onChange={() => toggleCombinedGroup(category)}
                />
                <div className="flex items-center gap-1.5">
                    {isCombined ? <CheckSquare size={14} /> : <Square size={14} />}
                    <span>Combine Selections</span>
                </div>
            </label>
        </div>
      );
  };

  const renderCheckboxes = (category: keyof AppOptions, title: string, listSource?: string[]) => {
    // Determine the source array from config based on category key
    let items: string[] = [];
    if (listSource) {
        items = listSource;
    } else if (category in config.lists) {
        items = (config.lists as any)[category] || [];
    }

    return (
        <div className="mb-8">
            {renderCombineHeader(category, title)}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {items.map(item => renderOptionItem(category, item))}
            </div>
        </div>
    );
  };

  const renderAspectRatioSection = () => {
    const allRatios = config.lists.aspectRatio || [];
    const standardRatios = ["Original", "1:1", "16:9", "2:3", "3:2", "3:4", "4:3", "9:16"];
    const specialRatios = allRatios.filter(r => !standardRatios.includes(r));
    
    return (
        <div className="mb-8">
            {renderCombineHeader('aspectRatio', 'Output Aspect Ratio')}
            
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-800 pb-1">Standard Formats</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {standardRatios.map(item => renderOptionItem('aspectRatio', item))}
            </div>

            <h4 className="text-xs font-bold text-violet-500 uppercase tracking-wider mb-2 border-b border-violet-900/30 pb-1 flex items-center gap-2">
                <Sparkles size={12}/> Special Layouts & Character Sheets
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3">
                {specialRatios.map(item => renderOptionItem('aspectRatio', item))}
            </div>
        </div>
    );
  };

  const renderGroups = (groups: Record<string, string[]>, category: keyof AppOptions, title: string) => (
      <div className="space-y-6">
          {renderCombineHeader(category, title)}
          
          {Object.entries(groups).map(([groupName, items]) => (
              <div key={groupName}>
                  <h4 className="text-xs font-bold text-violet-500/80 uppercase tracking-wider mb-3 sticky top-0 bg-slate-900/95 py-2 backdrop-blur z-10 pl-1 border-l-2 border-violet-900/50">
                      {groupName}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {items.map(item => renderOptionItem(category, item))}
                  </div>
              </div>
          ))}
      </div>
  );
  
  const renderDndSection = () => {
     return (
         <div className="space-y-12">
            {/* Class Archetype Section */}
            <div className="bg-slate-800/20 rounded-xl p-4 border border-slate-800">
               {renderCheckboxes('dndClass', 'Class Archetype (Generic)')}
            </div>

            {DND_CLASSES.map(cls => {
                const outfitKey = `dnd${cls}Outfit` as keyof AppOptions;
                const weaponKey = `dnd${cls}Weapon` as keyof AppOptions;
                const outfits = config.dndOutfits[cls] || [];
                const weapons = config.dndWeapons[cls] || [];
                
                return (
                    <div key={cls} className="bg-slate-800/20 rounded-xl p-4 border border-slate-800">
                        <h3 className="text-xl font-bold text-violet-400 mb-6 border-b border-violet-900/50 pb-2">{cls}</h3>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                             <div>
                                 {renderCombineHeader(outfitKey, `${cls} Outfits`)}
                                 <div className="grid grid-cols-2 gap-2">
                                     {outfits.map(item => renderOptionItem(outfitKey, item))}
                                 </div>
                             </div>
                             <div>
                                 {renderCombineHeader(weaponKey, `${cls} Weapons`)}
                                 <div className="grid grid-cols-2 gap-2">
                                     {weapons.map(item => renderOptionItem(weaponKey, item))}
                                 </div>
                             </div>
                        </div>
                    </div>
                );
            })}
         </div>
     );
  };

  // Helper to count active selections in a specific tab
  const getTabSelectionCount = (tabId: TabID): number => {
      let count = 0;
      Object.keys(options).forEach((key) => {
          if (key === 'combinedGroups') return;
          const k = key as keyof AppOptions;
          if (getTabForKey(k) === tabId) {
              const val = options[k];
              if (Array.isArray(val)) {
                  count += val.length;
              } else if (typeof val === 'boolean' && val === true) {
                  count += 1;
              } else if (k === 'modesty' && val !== 'None') {
                  count += 1;
              }
          }
      });
      return count;
  };

  const getTabIndicator = (tabId: TabID) => {
      const count = getTabSelectionCount(tabId);
      if (count === 0) return null;
      
      const colorClass = count === 1 ? 'bg-violet-500 text-white' : 'bg-blue-500 text-white';
      return (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto ${colorClass}`}>
              {count}
          </span>
      );
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-[90vw] h-[90vh] bg-slate-900 border border-slate-700 rounded-xl flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="flex flex-col border-b border-slate-700 bg-slate-900 rounded-t-xl z-20">
            <div className="flex items-center justify-between p-6 pb-2">
                <div className="flex items-end gap-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Configuration</h2>
                        <p className="text-slate-400 text-sm mt-1">Select logic permutations for generation.</p>
                    </div>
                    {/* Permutation Counter */}
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg mb-1">
                        <Calculator size={14} className="text-violet-500" />
                        <span className="text-xs text-slate-400 uppercase tracking-wider">Combinations:</span>
                        <span className={`text-sm font-mono font-bold ${
                            permutationCount > 20 ? 'text-amber-400' : 'text-violet-400'
                        }`}>
                            {permutationCount.toLocaleString()}
                        </span>
                        {permutationCount > 20 && (
                            <span className="text-[10px] text-amber-500/80 ml-1">(High Count)</span>
                        )}
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-full transition-all">
                    <X size={28} />
                </button>
            </div>
            
            {/* Selected Options Display */}
            <div className="px-6 pb-4 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {Object.keys(options).map((key) => {
                    if (key === 'combinedGroups' || key === 'retryLimit' || key === 'safetyRetryLimit' || key === 'concurrentJobs' || key === 'outputFormat' || key === 'imageQuality') return null; // Don't show control key
                    
                    const k = key as keyof AppOptions;
                    const val = options[k];
                    const isCombined = options.combinedGroups?.includes(k);

                    if (Array.isArray(val) && val.length > 0) {
                        // Color Logic: Blue if >1 item, Violet if 1 item. Combined usually takes precedence style-wise
                        let pillClass = 'bg-violet-900/40 border-violet-500/30 text-violet-200 hover:bg-slate-800 hover:border-violet-500/80';
                        
                        if (isCombined) {
                             pillClass = 'bg-indigo-900/40 border-indigo-500/30 text-indigo-200 hover:bg-slate-800 hover:border-indigo-500/80';
                        } else if (val.length >= 2) {
                             pillClass = 'bg-blue-900/40 border-blue-500/30 text-blue-200 hover:bg-slate-800 hover:border-blue-500/80';
                        }

                        return (
                            <div 
                                key={k} 
                                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-colors cursor-pointer group ${pillClass}`} 
                                onClick={() => navigateToOption(k)}
                                title="Click to go to option group"
                            >
                                <span className="opacity-50 uppercase text-[9px] font-bold mr-0.5">{k}{isCombined ? ' (Comb)' : ''}:</span>
                                <span className="max-w-[150px] truncate">
                                    {isCombined ? val.join(' + ') : val.length + ' items'}
                                </span>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setOptions({...options, [k]: []}); }}
                                    className="ml-1 p-0.5 hover:bg-black/20 rounded-full"
                                >
                                    <X size={10} className="opacity-70 group-hover:opacity-100" />
                                </button>
                            </div>
                        );
                    }
                    if (typeof val === 'boolean' && val === true) {
                        if (k === 'replaceBackground') {
                            return (
                                <div key={k} className="flex items-center gap-1.5 px-2 py-1 bg-amber-900/40 border border-amber-500/30 rounded text-xs text-amber-200 group hover:border-amber-500/50 hover:bg-slate-800 transition-colors cursor-pointer" onClick={() => navigateToOption(k)}>
                                    <span className="font-bold">BG Replace Active</span>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); toggleBoolean(k); }}
                                        className="ml-1 p-0.5 hover:bg-black/20 rounded-full"
                                    >
                                        <X size={10} className="opacity-70 group-hover:opacity-100" />
                                    </button>
                                </div>
                            );
                        }
                        if (k === 'removeCharacters') {
                            return (
                                <div key={k} className="flex items-center gap-1.5 px-2 py-1 bg-red-900/40 border border-red-500/30 rounded text-xs text-red-200 group hover:border-red-500/50 hover:bg-slate-800 transition-colors cursor-pointer" onClick={() => navigateToOption(k)}>
                                    <span className="font-bold">Landscape Mode (No Chars)</span>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); toggleBoolean(k); }}
                                        className="ml-1 p-0.5 hover:bg-black/20 rounded-full"
                                    >
                                        <X size={10} className="opacity-70 group-hover:opacity-100" />
                                    </button>
                                </div>
                            );
                        }
                    }
                     if (k === 'modesty' && val !== 'None') {
                         return (
                            <div key={k} className="flex items-center gap-1.5 px-2 py-1 bg-pink-900/40 border border-pink-500/30 rounded text-xs text-pink-200 group hover:border-pink-500/50 hover:bg-slate-800 transition-colors cursor-pointer" onClick={() => navigateToOption(k)}>
                                <span className="opacity-50 uppercase text-[9px] font-bold mr-0.5">Modesty:</span>
                                <span className="font-bold">{val}</span>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleSettingChange(k, 'None'); }}
                                    className="ml-1 p-0.5 hover:bg-black/20 rounded-full"
                                >
                                    <X size={10} className="opacity-70 group-hover:opacity-100" />
                                </button>
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
        </div>

        {/* Content Layout */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar Tabs */}
          <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col pt-4 overflow-y-auto shrink-0">
             {[
               { id: 'CHAR', label: 'Characters', icon: User },
               { id: 'ATTIRE', label: 'Attire', icon: Shirt },
               { id: 'BONDAGE', label: 'Bondage', icon: Lock },
               { id: 'POWERS', label: 'Superpowers', icon: Flame }, // New Tab
               { id: 'DND', label: 'D&D Classes', icon: Sword },
               { id: 'SPECIES', label: 'Species', icon: Sparkles },
               { id: 'ANIMALS', label: 'Animals', icon: Bug },
               { id: 'ITEMS', label: 'Items', icon: Package },
               { id: 'ACTION', label: 'Actions', icon: Activity },
               { id: 'DECOR', label: 'Decorations', icon: Brush },
               { id: 'SKIN_FX', label: 'Skin & Fur', icon: Droplets },
               { id: 'TECH', label: 'Technology', icon: Zap },
               { id: 'ENV', label: 'Environment', icon: MapIcon },
               { id: 'TIME', label: 'Time of Day', icon: Clock },
               { id: 'WEATHER', label: 'Weather', icon: Cloud },
               { id: 'STYLE', label: 'Art Style', icon: Palette },
               { id: 'LIGHTING', label: 'Lighting', icon: Lightbulb },
               { id: 'CAMERA', label: 'Camera', icon: Camera },
               { id: 'MOOD', label: 'Mood', icon: Smile },
               { id: 'RATIO', label: 'Aspect Ratio', icon: Monitor },
               { id: 'CUSTOM', label: 'Custom', icon: Sliders },
             ].map((tab: any) => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id)}
                 className={`flex items-center gap-3 px-6 py-4 text-left transition-colors border-l-4 ${
                   activeTab === tab.id 
                    ? 'border-violet-500 bg-slate-900 text-violet-400' 
                    : 'border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                 }`}
               >
                 <tab.icon size={20} className="shrink-0" />
                 <span className="font-medium flex-1">{tab.label}</span>
                 {getTabIndicator(tab.id)}
               </button>
             ))}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto bg-slate-900 p-8">
            {activeTab === 'CHAR' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                {options.removeCharacters && (
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-200 mb-4">
                        <Ban size={20} />
                        <span className="text-sm font-medium">Character options are disabled in Landscape Mode.</span>
                    </div>
                )}
                <div className={options.removeCharacters ? 'opacity-30 pointer-events-none grayscale' : ''}>
                    {renderCheckboxes('gender', 'Gender')}
                    {renderCheckboxes('age', 'Age')}
                    {renderCheckboxes('bodyType', 'Body Type')}
                    {renderCheckboxes('breastSize', 'Breast Size')}
                    {renderCheckboxes('skin', 'Skin Color')}
                    {renderCheckboxes('eyeColor', 'Eye Color')}
                    {renderCheckboxes('hair', 'Hair Color')}
                    {renderCheckboxes('emotions', 'Emotions & Expressions')}
                </div>
              </div>
            )}
            {activeTab === 'ATTIRE' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                {options.removeCharacters && (
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-200 mb-4">
                        <Ban size={20} />
                        <span className="text-sm font-medium">Attire options are disabled in Landscape Mode.</span>
                    </div>
                )}
                <div className={options.removeCharacters ? 'opacity-30 pointer-events-none grayscale' : ''}>
                    {renderGroups(config.attireGroups, 'clothes', 'Attire Selection')}
                    <div className="mt-8 pt-8 border-t border-slate-800">
                       {renderCheckboxes('shoes', 'Footwear')}
                    </div>
                </div>
              </div>
            )}
            {activeTab === 'BONDAGE' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                {options.removeCharacters && (
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-200 mb-4">
                        <Ban size={20} />
                        <span className="text-sm font-medium">Bondage options are disabled in Landscape Mode.</span>
                    </div>
                )}
                <div className={options.removeCharacters ? 'opacity-30 pointer-events-none grayscale' : ''}>
                    <div className="p-4 bg-slate-800 rounded-lg mb-6 border border-slate-700">
                        <p className="text-sm text-slate-400">
                            <strong className="text-violet-400">Note:</strong> Selecting bondage options may override standard clothing with artistic/implied nudity constraints to ensure the restraints are visible. The AI will prioritize safety and artistic merit.
                        </p>
                    </div>
                    {renderGroups(config.bondageGroups, 'bondage', 'Restraints & Bondage')}
                </div>
              </div>
            )}
            {activeTab === 'POWERS' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                {options.removeCharacters && (
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-200 mb-4">
                        <Ban size={20} />
                        <span className="text-sm font-medium">Superpower options are disabled in Landscape Mode.</span>
                    </div>
                )}
                <div className={options.removeCharacters ? 'opacity-30 pointer-events-none grayscale' : ''}>
                    {renderGroups(config.superheroGroups, 'superhero', 'Mutant Abilities & Powers')}
                </div>
              </div>
            )}
            {activeTab === 'DND' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                 {options.removeCharacters && (
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-200 mb-4">
                        <Ban size={20} />
                        <span className="text-sm font-medium">Class options are disabled in Landscape Mode.</span>
                    </div>
                 )}
                 <div className={options.removeCharacters ? 'opacity-30 pointer-events-none grayscale' : ''}>
                     {renderDndSection()}
                 </div>
              </div>
            )}
            {activeTab === 'SPECIES' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                 {options.removeCharacters && (
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-200 mb-4">
                        <Ban size={20} />
                        <span className="text-sm font-medium">Species options are disabled in Landscape Mode.</span>
                    </div>
                 )}
                 <div className={options.removeCharacters ? 'opacity-30 pointer-events-none grayscale' : ''}>
                     {renderGroups(config.speciesGroups, 'species', 'Species Selection')}
                 </div>
              </div>
            )}
            {activeTab === 'ANIMALS' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                 {options.removeCharacters && (
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-200 mb-4">
                        <Ban size={20} />
                        <span className="text-sm font-medium">Animal options are disabled in Landscape Mode.</span>
                    </div>
                 )}
                 <div className={options.removeCharacters ? 'opacity-30 pointer-events-none grayscale' : ''}>
                     {renderGroups(config.animalGroups, 'animals', 'Animal Selection')}
                 </div>
              </div>
            )}
            {activeTab === 'ITEMS' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                 {options.removeCharacters && (
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-200 mb-4">
                        <Ban size={20} />
                        <span className="text-sm font-medium">Item options are disabled in Landscape Mode.</span>
                    </div>
                 )}
                 <div className={options.removeCharacters ? 'opacity-30 pointer-events-none grayscale' : ''}>
                     {renderGroups(config.itemGroups, 'items', 'Items Selection')}
                 </div>
              </div>
            )}
            {activeTab === 'ACTION' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                 {options.removeCharacters && (
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-200 mb-4">
                        <Ban size={20} />
                        <span className="text-sm font-medium">Action options are disabled in Landscape Mode.</span>
                    </div>
                 )}
                 <div className={options.removeCharacters ? 'opacity-30 pointer-events-none grayscale' : ''}>
                     {renderCheckboxes('actions', 'Actions & Poses')}
                 </div>
              </div>
            )}
            {activeTab === 'DECOR' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  {options.removeCharacters && (
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-200 mb-4">
                        <Ban size={20} />
                        <span className="text-sm font-medium">Decoration options are disabled in Landscape Mode.</span>
                    </div>
                  )}
                  <div className={options.removeCharacters ? 'opacity-30 pointer-events-none grayscale' : ''}>
                      {renderGroups(config.decorationGroups, 'decorations', 'Decorations Selection')}
                  </div>
              </div>
            )}
            {activeTab === 'SKIN_FX' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  {options.removeCharacters && (
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-200 mb-4">
                        <Ban size={20} />
                        <span className="text-sm font-medium">Skin effect options are disabled in Landscape Mode.</span>
                    </div>
                  )}
                  <div className={options.removeCharacters ? 'opacity-30 pointer-events-none grayscale' : ''}>
                      {renderGroups(config.skinConditionGroups, 'skinConditions', 'Skin Surface, Paint & Fur')}
                  </div>
              </div>
            )}
            {activeTab === 'TECH' && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                   {renderCheckboxes('technology', 'Technology Level')}
               </div>
            )}
            {activeTab === 'ENV' && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  {renderGroups(config.environmentGroups, 'environment', 'Environment Selection')}
               </div>
            )}
             {activeTab === 'TIME' && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  {renderCheckboxes('timeOfDay', 'Time of Day')}
               </div>
            )}
            {activeTab === 'WEATHER' && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  {renderCheckboxes('weather', 'Weather Conditions')}
               </div>
            )}
            {activeTab === 'STYLE' && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  {renderCheckboxes('artStyle', 'Art Style')}
               </div>
            )}
            {activeTab === 'LIGHTING' && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  {renderCheckboxes('lighting', 'Lighting')}
               </div>
            )}
            {activeTab === 'CAMERA' && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  {renderCheckboxes('camera', 'Camera Angle & Lens')}
               </div>
            )}
            {activeTab === 'MOOD' && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  {renderCheckboxes('mood', 'Mood & Atmosphere')}
               </div>
            )}
            {activeTab === 'RATIO' && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  {renderAspectRatioSection()}
               </div>
            )}
            {activeTab === 'CUSTOM' && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-8">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                      <Cog size={16} /> Advanced Processing Settings
                  </h3>

                  {/* Settings Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-800/50 p-6 rounded-lg border border-slate-800">
                      
                      {/* Retry Limit */}
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Failure Retry Limit</label>
                          <input 
                             type="number" min={1} max={10} 
                             value={options.retryLimit}
                             onChange={(e) => handleSettingChange('retryLimit', Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                             className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-violet-500 outline-none"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Default: 5 (Min 1, Max 10)</p>
                      </div>

                      {/* Safety Retry Limit */}
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Safety (Ban) Retry Limit</label>
                          <input 
                             type="number" min={0} max={5} 
                             value={options.safetyRetryLimit}
                             onChange={(e) => handleSettingChange('safetyRetryLimit', Math.max(0, Math.min(5, parseInt(e.target.value) || 0)))}
                             className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-violet-500 outline-none"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Default: 2 (Min 0, Max 5)</p>
                      </div>

                      {/* Parallel Jobs */}
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Parallel Jobs</label>
                          <input 
                             type="number" min={1} max={10} 
                             value={options.concurrentJobs}
                             onChange={(e) => handleSettingChange('concurrentJobs', Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                             className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-violet-500 outline-none"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Default: 5 (Min 1, Max 10)</p>
                      </div>

                      {/* Output Format */}
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-2">File Format</label>
                          <select 
                             value={options.outputFormat}
                             onChange={(e) => handleSettingChange('outputFormat', e.target.value)}
                             className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 focus:border-violet-500 outline-none"
                          >
                              <option value="image/png" className="bg-slate-900 text-slate-200">PNG</option>
                              <option value="image/jpeg" className="bg-slate-900 text-slate-200">JPEG</option>
                          </select>
                      </div>

                      {/* Image Quality */}
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Image Quality</label>
                          <select 
                             value={options.imageQuality}
                             onChange={(e) => handleSettingChange('imageQuality', e.target.value)}
                             className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 focus:border-violet-500 outline-none"
                          >
                              <option value="4K" className="bg-slate-900 text-slate-200">4K (High Resolution)</option>
                              <option value="2K" className="bg-slate-900 text-slate-200">2K (Standard)</option>
                              <option value="1K" className="bg-slate-900 text-slate-200">1K (Fast)</option>
                          </select>
                      </div>
                      
                      {/* Modesty Settings */}
                       <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Modesty Strategy (For Nudity/Bondage)</label>
                          <select 
                             value={options.modesty}
                             onChange={(e) => handleSettingChange('modesty', e.target.value)}
                             className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 focus:border-violet-500 outline-none"
                          >
                              <option value="None" className="bg-slate-900 text-slate-200">None (As-Is)</option>
                              <option value="Left Hand Cover" className="bg-slate-900 text-slate-200">Left Hand Cover</option>
                              <option value="Right Hand Cover" className="bg-slate-900 text-slate-200">Right Hand Cover</option>
                              <option value="Both Hands Cover" className="bg-slate-900 text-slate-200">Both Hands Cover</option>
                              <option value="Strategic Object" className="bg-slate-900 text-slate-200">Strategic Object Placement</option>
                              <option value="Transparent Veil" className="bg-slate-900 text-slate-200">Transparent Veil</option>
                              <option value="Long Hair Cover" className="bg-slate-900 text-slate-200">Long Hair Cover</option>
                              <option value="Crossed Legs" className="bg-slate-900 text-slate-200">Crossed Legs</option>
                              <option value="Heavy Shadow" className="bg-slate-900 text-slate-200">Heavy Shadow / Chiaroscuro</option>
                              <option value="Steam/Mist" className="bg-slate-900 text-slate-200">Steam / Mist Obscured</option>
                          </select>
                          <p className="text-[10px] text-slate-500 mt-1">Select a strategy to obscure nudity if clothing is removed.</p>
                      </div>
                  </div>
                  
                  {/* Remove Characters Toggle */}
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                      <label className="flex items-start gap-4 cursor-pointer">
                           <div className={`mt-1 w-6 h-6 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                options.removeCharacters ? 'bg-red-500 border-red-500' : 'bg-slate-900 border-slate-500'
                           }`}>
                               <input 
                                  type="checkbox" 
                                  className="hidden" 
                                  checked={options.removeCharacters}
                                  onChange={() => toggleBoolean('removeCharacters')}
                               />
                               {options.removeCharacters && <div className="w-3 h-3 bg-white rounded-sm" />}
                           </div>
                           <div>
                               <span className="font-bold text-slate-200">Remove Characters (Landscape Mode)</span>
                               <p className="text-sm text-slate-400 mt-1">
                                   Removes all characters and people from the image. The AI will treat the input as a background scene 
                                   and infill any gaps. Character settings (Gender, Age, etc.) will be ignored.
                               </p>
                           </div>
                      </label>
                  </div>

                  {/* Replace Background Toggle */}
                  <div className={`bg-slate-800 border border-slate-700 rounded-lg p-6 ${options.removeCharacters ? 'opacity-70' : ''}`}>
                      <label className="flex items-start gap-4 cursor-pointer">
                           <div className={`mt-1 w-6 h-6 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                options.replaceBackground ? 'bg-violet-500 border-violet-500' : 'bg-slate-900 border-slate-500'
                           }`}>
                               <input 
                                  type="checkbox" 
                                  className="hidden" 
                                  checked={options.replaceBackground}
                                  onChange={() => toggleBoolean('replaceBackground')}
                               />
                               {options.replaceBackground && <div className="w-3 h-3 bg-black rounded-sm" />}
                           </div>
                           <div>
                               <span className="font-bold text-slate-200">Replace Background</span>
                               <p className="text-sm text-slate-400 mt-1">
                                   {options.removeCharacters 
                                     ? "Completely discards original background lines and generates a fresh landscape based on 'Environment' settings."
                                     : "Extracts main character(s) and generates a new background based on 'Environment' settings."}
                               </p>
                           </div>
                      </label>
                  </div>
               </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center">
            {/* Hidden File Input (Always Present) */}
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".kcf,.json" 
                onChange={handleLoadConfig}
            />

            {/* Left Actions (Save/Load) */}
            {isNamingPreset ? (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                    <span className="text-sm text-slate-400 font-medium">Filename:</span>
                    <div className="relative">
                        <input 
                            type="text" 
                            value={presetName}
                            onChange={(e) => setPresetName(e.target.value)}
                            className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-200 focus:border-violet-500 outline-none w-48 font-mono"
                            autoFocus
                            placeholder="ChromaForge"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') performSave();
                                if (e.key === 'Escape') setIsNamingPreset(false);
                            }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">.kcf</span>
                    </div>
                    <button 
                        onClick={performSave} 
                        className="p-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors shadow-lg shadow-violet-900/20" 
                        title="Confirm Save"
                    >
                        <Check size={16} />
                    </button>
                    <button 
                        onClick={() => setIsNamingPreset(false)} 
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-700" 
                        title="Cancel"
                    >
                        <X size={16} />
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleSaveClick}
                        className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-violet-400 bg-slate-900 border border-slate-700 hover:border-violet-500/50 rounded-lg text-sm transition-all"
                        title="Save current configuration to .kcf file"
                    >
                        <Download size={14} /> 
                        <span className="hidden sm:inline">Save Preset</span>
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-indigo-400 bg-slate-900 border border-slate-700 hover:border-indigo-500/50 rounded-lg text-sm transition-all"
                        title="Load configuration from .kcf file"
                    >
                        <Upload size={14} /> 
                        <span className="hidden sm:inline">Load Preset</span>
                    </button>
                </div>
            )}

            {/* Right Actions (Save/Reset) */}
            <div className="flex items-center gap-3">
                 <button 
                    onClick={() => setOptions(DEFAULT_OPTIONS)}
                    className="px-4 py-2 text-sm text-slate-500 hover:text-white transition-colors"
                 >
                     Reset Defaults
                 </button>
                 <button 
                    onClick={onClose}
                    className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors"
                 >
                     Done
                 </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default OptionsDialog;