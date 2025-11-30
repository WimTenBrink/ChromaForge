import React, { useState } from 'react';
import { X, User, Zap, Map as MapIcon, Clock } from 'lucide-react';
import { AppOptions } from '../types';
import { OPTION_LISTS, DEFAULT_OPTIONS } from '../constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  options: AppOptions;
  setOptions: (o: AppOptions) => void;
}

const OptionsDialog: React.FC<Props> = ({ isOpen, onClose, options, setOptions }) => {
  const [activeTab, setActiveTab] = useState<'CHAR' | 'TECH' | 'ENV' | 'TIME'>('CHAR');

  if (!isOpen) return null;

  const toggleOption = (category: keyof AppOptions, value: string) => {
    setOptions({
      ...options,
      [category]: options[category].includes(value)
        ? options[category].filter(v => v !== value)
        : [...options[category], value]
    });
  };

  const renderCheckboxes = (category: keyof AppOptions, title: string) => (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {OPTION_LISTS[category].map(item => (
          <label key={item} className={`flex items-center gap-2 p-3 rounded cursor-pointer border transition-all ${
            options[category].includes(item)
              ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-300'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750 hover:border-slate-600'
          }`}>
            <input
              type="checkbox"
              className="hidden"
              checked={options[category].includes(item)}
              onChange={() => toggleOption(category, item)}
            />
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                options[category].includes(item) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500'
            }`}>
               {options[category].includes(item) && <div className="w-2 h-2 bg-black rounded-sm" />} 
            </div>
            <span className="text-sm select-none">{item}</span>
          </label>
        ))}
      </div>
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
          <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col pt-4">
             {[
               { id: 'CHAR', label: 'Characters', icon: User },
               { id: 'TECH', label: 'Technology', icon: Zap },
               { id: 'ENV', label: 'Environment', icon: MapIcon },
               { id: 'TIME', label: 'Time of Day', icon: Clock },
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
            {activeTab === 'TECH' && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                   {renderCheckboxes('technology', 'Technology Level')}
               </div>
            )}
            {activeTab === 'ENV' && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  {renderCheckboxes('environment', 'Setting / Environment')}
               </div>
            )}
             {activeTab === 'TIME' && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  {renderCheckboxes('timeOfDay', 'Time of Day')}
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