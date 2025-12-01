

import React, { useState, useMemo } from 'react';
import { X, User, Zap, Map as MapIcon, Clock, Sparkles, Monitor, Package, Sliders, Palette, Lightbulb, Camera, Smile, Cloud, Brush, Calculator, Ban } from 'lucide-react';
import { AppOptions, GlobalConfig } from '../types';
import { DEFAULT_OPTIONS } from '../constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  options: AppOptions;
  setOptions: (o: AppOptions) => void;
  config: GlobalConfig | null;
}

const OptionsDialog: React.FC<Props> = ({ isOpen, onClose, options, setOptions, config }) => {
  const [activeTab, setActiveTab] = useState<'CHAR' | 'SPECIES' | 'ITEMS' | 'DECOR' | 'TECH' | 'ENV' | 'TIME' | 'WEATHER' | 'RATIO' | 'STYLE' | 'LIGHTING' | 'CAMERA' | 'MOOD' | 'CUSTOM'>('CHAR');

  const permutationCount = useMemo(() => {
    return (Object.keys(options) as Array<keyof AppOptions>).reduce((acc, key) => {
        const val = options[key];
        // Only check length for arrays (skip boolean flags)
        if (Array.isArray(val)) {
            const len = val.length;
            return acc * (len > 0 ? len : 1);
        }
        return acc;
    }, 1);
  }, [options]);

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

  const renderOptionItem = (category: keyof AppOptions, item: string) => {
      const isSelected = (options[category] as string[]).includes(item);
      return (
      <label key={item} className={`flex items-center gap-2 p-3 rounded cursor-pointer border transition-all ${
        isSelected
          ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-300'
          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750 hover:border-slate-600'
      }`}>
        <input
          type="checkbox"
          className="hidden"
          checked={isSelected}
          onChange={() => toggleOption(category, item)}
        />
        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
            isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500'
        }`}>
           {isSelected && <div className="w-2 h-2 bg-black rounded-sm" />} 
        </div>
        <span className="text-sm select-none truncate" title={item}>{item}</span>
      </label>
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
        <div className="mb-6">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">{title}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {items.map(item => renderOptionItem(category, item))}
        </div>
        </div>
    );
  };

  const renderGroups = (groups: Record<string, string[]>, category: keyof AppOptions) => (
      <div className="space-y-8">
          {Object.entries(groups).map(([groupName, items]) => (
              <div key={groupName}>
                  <h3 className="text-sm font-bold text-emerald-500/80 uppercase tracking-wider mb-3 sticky top-0 bg-slate-900/95 py-2 backdrop-blur z-10">
                      {groupName}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {items.map(item => renderOptionItem(category, item))}
                  </div>
              </div>
          ))}
      </div>
  );

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
                        <Calculator size={14} className="text-emerald-500" />
                        <span className="text-xs text-slate-400 uppercase tracking-wider">Combinations:</span>
                        <span className={`text-sm font-mono font-bold ${
                            permutationCount > 20 ? 'text-amber-400' : 'text-emerald-400'
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
                    const k = key as keyof AppOptions;
                    const val = options[k];
                    
                    if (Array.isArray(val) && val.length > 0) {
                        return val.map((v) => (
                            <div key={`${k}-${v}`} className="flex items-center gap-1.5 px-2 py-1 bg-emerald-900/40 border border-emerald-500/30 rounded text-xs text-emerald-200 group hover:border-red-500/50 hover:bg-red-900/20 hover:text-red-200 transition-colors cursor-pointer" onClick={() => removeOption(k, v)}>
                                <span className="opacity-50 uppercase text-[9px] font-bold mr-0.5">{k}:</span>
                                <span>{v}</span>
                                <X size={10} className="ml-1 opacity-50 group-hover:opacity-100" />
                            </div>
                        ));
                    }
                    if (typeof val === 'boolean' && val === true) {
                        if (k === 'replaceBackground') {
                            return (
                                <div key={k} className="flex items-center gap-1.5 px-2 py-1 bg-amber-900/40 border border-amber-500/30 rounded text-xs text-amber-200 group hover:border-red-500/50 hover:bg-red-900/20 hover:text-red-200 transition-colors cursor-pointer" onClick={() => toggleBoolean(k)}>
                                    <span className="font-bold">BG Replace Active</span>
                                    <X size={10} className="ml-1 opacity-50 group-hover:opacity-100" />
                                </div>
                            );
                        }
                        if (k === 'removeCharacters') {
                            return (
                                <div key={k} className="flex items-center gap-1.5 px-2 py-1 bg-red-900/40 border border-red-500/30 rounded text-xs text-red-200 group hover:border-slate-500/50 hover:bg-slate-900/20 hover:text-slate-200 transition-colors cursor-pointer" onClick={() => toggleBoolean(k)}>
                                    <span className="font-bold">Landscape Mode (No Chars)</span>
                                    <X size={10} className="ml-1 opacity-50 group-hover:opacity-100" />
                                </div>
                            );
                        }
                    }
                    return null;
                })}
                {Object.keys(options).every(k => {
                     const val = options[k as keyof AppOptions];
                     return Array.isArray(val) ? val.length === 0 : val === false;
                }) && (
                    <span className="text-slate-600 text-xs italic py-1">No options selected. Defaults (Original Image) will apply.</span>
                )}
            </div>
        </div>

        {/* Content Layout */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar Tabs */}
          <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col pt-4 overflow-y-auto shrink-0">
             {[
               { id: 'CHAR', label: 'Characters', icon: User },
               { id: 'SPECIES', label: 'Species', icon: Sparkles },
               { id: 'ITEMS', label: 'Items', icon: Package },
               { id: 'DECOR', label: 'Decorations', icon: Brush },
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
                    ? 'border-emerald-500 bg-slate-900 text-emerald-400' 
                    : 'border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                 }`}
               >
                 <tab.icon size={20} />
                 <span className="font-medium">{tab.label}</span>
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
                    {renderCheckboxes('skin', 'Skin Color')}
                    {renderCheckboxes('hair', 'Hair Color')}
                    {renderCheckboxes('clothes', 'Attire')}
                    {renderCheckboxes('shoes', 'Footwear')}
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
                     {renderGroups(config.speciesGroups, 'species')}
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
                     {renderGroups(config.itemGroups, 'items')}
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
                      {renderGroups(config.decorationGroups, 'decorations')}
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
                  {renderGroups(config.environmentGroups, 'environment')}
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
                  {renderCheckboxes('aspectRatio', 'Output Aspect Ratio')}
               </div>
            )}
            {activeTab === 'CUSTOM' && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Advanced Processing</h3>
                  
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
                                options.replaceBackground ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-900 border-slate-500'
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
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
             <button 
                onClick={() => setOptions(DEFAULT_OPTIONS)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
             >
                 Reset to Defaults
             </button>
             <button 
                onClick={onClose}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
             >
                 Done
             </button>
        </div>
      </div>
    </div>
  );
};

export default OptionsDialog;