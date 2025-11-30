
import React, { useState } from 'react';
import { X, User, Zap, Map as MapIcon, Clock, Sparkles, Monitor, Package, Sliders, Palette, Lightbulb, Camera, Smile } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'CHAR' | 'SPECIES' | 'ITEMS' | 'TECH' | 'ENV' | 'TIME' | 'RATIO' | 'STYLE' | 'LIGHTING' | 'CAMERA' | 'MOOD' | 'CUSTOM'>('CHAR');

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
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Configuration</h2>
            <p className="text-slate-400 text-sm mt-1">Select logic permutations for generation.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-full transition-all">
            <X size={28} />
          </button>
        </div>

        {/* Content Layout */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar Tabs */}
          <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col pt-4 overflow-y-auto shrink-0">
             {[
               { id: 'CHAR', label: 'Characters', icon: User },
               { id: 'SPECIES', label: 'Species', icon: Sparkles },
               { id: 'ITEMS', label: 'Items', icon: Package },
               { id: 'TECH', label: 'Technology', icon: Zap },
               { id: 'ENV', label: 'Environment', icon: MapIcon },
               { id: 'TIME', label: 'Time of Day', icon: Clock },
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
                {renderCheckboxes('gender', 'Gender')}
                {renderCheckboxes('age', 'Age')}
                {renderCheckboxes('skin', 'Skin Color')}
                {renderCheckboxes('hair', 'Hair Color')}
                {renderCheckboxes('clothes', 'Attire')}
                {renderCheckboxes('shoes', 'Footwear')}
              </div>
            )}
            {activeTab === 'SPECIES' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                 {renderGroups(config.speciesGroups, 'species')}
              </div>
            )}
            {activeTab === 'ITEMS' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                 {renderGroups(config.itemGroups, 'items')}
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
               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Advanced Processing</h3>
                  
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
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
                               <span className="font-bold text-slate-200">Replace Background (Character Extraction)</span>
                               <p className="text-sm text-slate-400 mt-1">
                                   If enabled, the AI will attempt to extract only the main character(s) from the source line art 
                                   and generate a completely new background based on the 'Environment' setting, ignoring the original background.
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
