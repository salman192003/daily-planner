import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronRight, 
  GripVertical, 
  Plus, 
  Trash2, 
  Archive,
  CheckCircle,
  Circle
} from 'lucide-react';

// --- Configuration & Constants ---
const PILLARS = [
  {
    id: 'P1', title: 'P1', bg: 'bg-slate-900', border: 'border-slate-900', text: 'text-white',
    sections: [
      { id: '1.1', title: 'Job' },
      { id: '1.2', title: 'Job 2' }
    ]
  },
  {
    id: 'P2', title: 'P2', bg: 'bg-slate-700', border: 'border-slate-700', text: 'text-white',
    sections: [
      { id: '2.1', title: 'Job Search' },
      { id: '2.2', title: 'Portfolio Building' },
      { id: '2.3', title: 'Leetcode & Algos' },
      { id: '2.4', title: 'System Design + Tools' }
    ]
  },
  {
    id: 'P3', title: 'P3', bg: 'bg-slate-500', border: 'border-slate-500', text: 'text-white',
    sections: [
      { id: '3.1', title: 'Masters' },
      { id: '3.2', title: 'Biz / Finance Prep' },
      { id: '3.3', title: 'Personal Development' },
      { id: '3.4', title: 'Sleep and Health' }
    ]
  }
];

const formatDate = (date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const addDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-');
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return formatDate(date);
};

const getDisplayDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-');
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

// --- Main Application Component ---
export default function App() {
  const today = formatDate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  
  const [tasks, setTasks] = useState([]);
  const [sectionMeta, setSectionMeta] = useState({});
  const [reflections, setReflections] = useState({});
  const [summary, setSummary] = useState({});
  
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [hoveredDropZone, setHoveredDropZone] = useState(null);

  const debounceRefs = useRef({});

  // --- API Calls ---
  const fetchTasks = async (date) => {
    try {
      const res = await fetch(`/api/tasks?date=${date}`);
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setTasks([]);
    }
  };

  const fetchSectionMeta = async (date) => {
    try {
      const res = await fetch(`/api/section-meta?date=${date}`);
      const data = await res.json();
      setSectionMeta(prev => ({ ...prev, ...data }));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchReflection = async (date) => {
    try {
      const res = await fetch(`/api/reflections/${date}`);
      const data = await res.json();
      setReflections(prev => ({ ...prev, [date]: data.text }));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/tasks/summary');
      const data = await res.json();
      setSummary(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTasks(selectedDate);
    fetchSectionMeta(selectedDate);
    fetchReflection(selectedDate);
    fetchSummary();
  }, [selectedDate]);

  const calendarDates = useMemo(() => {
    const dates = [];
    const base = new Date(today);
    for (let i = -7; i <= 14; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      dates.push(formatDate(d));
    }
    return dates;
  }, [today]);

  const currentTasks = useMemo(() => {
    return tasks.filter(t => t.date === selectedDate).sort((a, b) => a.order - b.order);
  }, [tasks, selectedDate]);

  // --- Task Management ---
  const addTask = async (sectionId) => {
    const sectionTasks = currentTasks.filter(t => t.sectionId === sectionId);
    const newOrder = sectionTasks.length;
    const newTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date: selectedDate,
      text: '',
      sectionId,
      completed: false,
      order: newOrder
    };
    
    setTasks([...tasks, newTask]);
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      });
      fetchSummary();
    } catch (e) {
      console.error(e);
    }
  };

  const updateTask = (taskId, updates) => {
    const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
    setTasks(updatedTasks);
    
    const task = updatedTasks.find(t => t.id === taskId);
    
    if (debounceRefs.current[taskId]) {
      clearTimeout(debounceRefs.current[taskId]);
    }
    
    debounceRefs.current[taskId] = setTimeout(async () => {
      try {
        await fetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task)
        });
        if ('completed' in updates || 'date' in updates) {
          fetchSummary();
        }
      } catch (e) {
        console.error(e);
      }
    }, 500);
  };

  const deleteTask = async (taskId) => {
    setTasks(tasks.filter(t => t.id !== taskId));
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      fetchSummary();
    } catch (e) {
      console.error(e);
    }
  };

  const updateSectionMetaAPI = async (sectionId, min, max) => {
    try {
      await fetch('/api/section-meta', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, sectionId, min, max })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const updateSectionMeta = (sectionId, field, value) => {
    const key = `${selectedDate}-${sectionId}`;
    const prevMeta = sectionMeta[key] || { min: '', max: '' };
    const newMeta = { ...prevMeta, [field]: value };
    
    setSectionMeta(prev => ({
      ...prev,
      [key]: newMeta
    }));

    if (debounceRefs.current[key]) {
      clearTimeout(debounceRefs.current[key]);
    }
    debounceRefs.current[key] = setTimeout(() => {
      updateSectionMetaAPI(sectionId, newMeta.min, newMeta.max);
    }, 500);
  };

  const updateReflectionAPI = async (text) => {
    try {
      await fetch(`/api/reflections/${selectedDate}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const updateReflection = (text) => {
    setReflections(prev => ({ ...prev, [selectedDate]: text }));
    
    const key = `ref-${selectedDate}`;
    if (debounceRefs.current[key]) {
      clearTimeout(debounceRefs.current[key]);
    }
    debounceRefs.current[key] = setTimeout(() => {
      updateReflectionAPI(text);
    }, 500);
  };

  const saveBatchTasks = async (batchTasks) => {
    try {
      await fetch('/api/tasks/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: batchTasks })
      });
      fetchSummary();
    } catch (e) {
      console.error(e);
    }
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, dropZoneId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (hoveredDropZone !== dropZoneId) {
      setHoveredDropZone(dropZoneId);
    }
  };

  const handleDragLeave = () => {
    setHoveredDropZone(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setHoveredDropZone(null);
  };

  const handleDropOnSection = (e, targetSectionId) => {
    e.preventDefault();
    setHoveredDropZone(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const targetSectionTasks = currentTasks
      .filter(t => t.sectionId === targetSectionId && t.id !== taskId);

    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        return { ...t, sectionId: targetSectionId, order: targetSectionTasks.length };
      }
      return t;
    });
    
    setTasks(updatedTasks);
    
    const changedTask = updatedTasks.find(t => t.id === taskId);
    saveBatchTasks([changedTask]);
  };

  const handleDropOnTask = (e, targetTaskId, targetSectionId) => {
    e.preventDefault();
    e.stopPropagation();
    setHoveredDropZone(null);
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === targetTaskId) return;

    let updatedTasks = [...tasks];
    
    const sectionTasks = updatedTasks
      .filter(t => t.date === selectedDate && t.sectionId === targetSectionId)
      .sort((a, b) => a.order - b.order);
      
    const draggedTask = updatedTasks.find(t => t.id === draggedId);
    const targetTask = updatedTasks.find(t => t.id === targetTaskId);

    if (!draggedTask || !targetTask) return;

    const filteredSectionTasks = sectionTasks.filter(t => t.id !== draggedId);
    const targetIndex = filteredSectionTasks.findIndex(t => t.id === targetTaskId);
    filteredSectionTasks.splice(targetIndex, 0, { ...draggedTask, sectionId: targetSectionId });

    const batchToUpdate = [];
    filteredSectionTasks.forEach((t, idx) => {
      const globalIndex = updatedTasks.findIndex(gt => gt.id === t.id);
      if (globalIndex !== -1) {
        updatedTasks[globalIndex] = { ...updatedTasks[globalIndex], sectionId: targetSectionId, order: idx };
        batchToUpdate.push(updatedTasks[globalIndex]);
      }
    });

    setTasks(updatedTasks);
    saveBatchTasks(batchToUpdate);
  };

  const handleDropOnClearance = (e) => {
    e.preventDefault();
    setHoveredDropZone(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const nextDay = addDays(selectedDate, 1);
    
    let changedTask = null;
    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        changedTask = { ...t, date: nextDay };
        return changedTask;
      }
      return t;
    });
    
    // Remove it from current day's view by relying on the filter in currentTasks
    setTasks(updatedTasks);
    
    if (changedTask) {
      saveBatchTasks([changedTask]);
    }
  };

  const getPriorityBadge = (index) => {
    if (index === 0) return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 ml-2 shadow-sm border border-red-200">1 Prio</span>;
    if (index === 1) return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 ml-2 shadow-sm border border-orange-200">2 Prio</span>;
    if (index === 2) return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 ml-2 shadow-sm border border-amber-200">3 Prio</span>;
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 ml-2 border border-slate-200">{index + 1}</span>;
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-800 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10 relative">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-indigo-600" />
            WORK SYSTEM
          </h2>
          <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">Timeline Planner</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {calendarDates.map(date => {
            const isSelected = date === selectedDate;
            const isToday = date === today;
            
            // Try to get data from summary or from local state if it's the current date
            let total = 0;
            let completed = 0;
            if (date === selectedDate) {
               total = currentTasks.length;
               completed = currentTasks.filter(t => t.completed).length;
            } else if (summary[date]) {
               total = summary[date].total;
               completed = summary[date].completed;
            }
            
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group
                  ${isSelected 
                    ? 'bg-slate-900 text-white shadow-md' 
                    : 'hover:bg-slate-100 text-slate-600'}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                      {isToday ? 'Today' : new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <span className={`text-xs ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                      {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  {total > 0 && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <div className={`h-1.5 w-16 rounded-full overflow-hidden ${isSelected ? 'bg-slate-700' : 'bg-slate-200'}`}>
                        <div 
                          className={`h-full ${isSelected ? 'bg-indigo-400' : 'bg-indigo-500'}`} 
                          style={{ width: `${(completed/total) * 100}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                        {completed}/{total}
                      </span>
                    </div>
                  )}
                </div>
                {isSelected && <ChevronRight className="w-4 h-4 opacity-70" />}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative bg-slate-50">
        
        <header className="px-8 py-5 border-b border-slate-200 bg-white flex justify-between items-end flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">
              {selectedDate === today ? "Today's Layout" : "Daily Layout"}
            </h3>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {getDisplayDate(selectedDate)}
            </h1>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-100 px-4 py-2 rounded-lg border border-slate-200">
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Tasks</div>
              <div className="text-lg font-black text-slate-800 leading-none mt-0.5">{currentTasks.length}</div>
            </div>
            <div className="w-px h-8 bg-slate-300"></div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Completed</div>
              <div className="text-lg font-black text-indigo-600 leading-none mt-0.5">{currentTasks.filter(t=>t.completed).length}</div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 pb-32">
          <div className="grid grid-cols-3 gap-6 h-full min-h-[600px]">
            {PILLARS.map((pillar) => (
              <div key={pillar.id} className={`flex flex-col border-[1.5px] rounded-xl overflow-hidden shadow-sm bg-white ${pillar.border}`}>
                
                <div className={`${pillar.bg} ${pillar.text} py-2.5 px-4 text-center border-b border-black/10`}>
                  <h2 className="text-lg font-black tracking-widest">{pillar.title}</h2>
                </div>
                
                <div className="flex-1 flex flex-col divide-y divide-slate-100 overflow-y-auto">
                  {pillar.sections.map((section) => {
                    const metaKey = `${selectedDate}-${section.id}`;
                    const meta = sectionMeta[metaKey] || { min: '', max: '' };
                    
                    const sectionTasks = currentTasks
                      .filter(t => t.sectionId === section.id)
                      .sort((a, b) => a.order - b.order);

                    const isHovered = hoveredDropZone === section.id;

                    return (
                      <div 
                        key={section.id} 
                        className={`p-4 transition-colors flex-1 min-h-[140px]
                          ${isHovered ? 'bg-indigo-50 border-2 border-indigo-300 border-dashed rounded-lg m-1' : ''}`}
                        onDragOver={(e) => handleDragOver(e, section.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropOnSection(e, section.id)}
                      >
                        <div className="flex justify-between items-end mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-black ${pillar.bg.replace('bg-', 'text-')}`}>
                              {section.id}
                            </span>
                            <h3 className="text-sm font-bold text-slate-700 border-b-2 border-slate-300 pb-0.5 inline-block">
                              {section.title}
                            </h3>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                            <div className="flex items-center gap-1">
                              <span>MIN:</span>
                              <input 
                                type="text" 
                                className="w-6 bg-transparent border-b border-slate-300 focus:border-indigo-500 outline-none text-center text-slate-700"
                                value={meta.min}
                                onChange={(e) => updateSectionMeta(section.id, 'min', e.target.value)}
                                placeholder="--"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span>MAX:</span>
                              <input 
                                type="text" 
                                className="w-6 bg-transparent border-b border-slate-300 focus:border-indigo-500 outline-none text-center text-slate-700"
                                value={meta.max}
                                onChange={(e) => updateSectionMeta(section.id, 'max', e.target.value)}
                                placeholder="--"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5 min-h-[20px]">
                          {sectionTasks.map((task, index) => {
                            const isTaskHovered = hoveredDropZone === task.id;
                            const isDragging = draggedTaskId === task.id;
                            
                            return (
                              <div 
                                key={task.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, task.id)}
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) => handleDragOver(e, task.id)}
                                onDrop={(e) => handleDropOnTask(e, task.id, section.id)}
                                className={`group flex items-start gap-2 p-1.5 -ml-1.5 rounded-lg border-l-2 transition-all cursor-grab active:cursor-grabbing
                                  ${isDragging ? 'opacity-30' : 'opacity-100'}
                                  ${isTaskHovered ? 'border-indigo-500 bg-indigo-50' : 'border-transparent hover:bg-slate-50'}
                                `}
                              >
                                <button 
                                  className="mt-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500"
                                  disabled
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </button>
                                
                                <button 
                                  onClick={() => updateTask(task.id, { completed: !task.completed })}
                                  className={`mt-0.5 flex-shrink-0 transition-colors ${task.completed ? 'text-indigo-600' : 'text-slate-300 hover:text-indigo-400'}`}
                                >
                                  {task.completed ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                                </button>
                                
                                <div className="flex-1">
                                  <div className="flex items-center">
                                    <input
                                      type="text"
                                      value={task.text}
                                      onChange={(e) => updateTask(task.id, { text: e.target.value })}
                                      className={`w-full bg-transparent outline-none text-sm font-medium transition-colors
                                        ${task.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}
                                      placeholder="Write a task..."
                                    />
                                  </div>
                                  <div className="w-full h-px bg-slate-200 mt-1 mb-1"></div>
                                  <div className="flex items-center justify-between">
                                     <div className="w-4/5 h-px bg-slate-200"></div>
                                     <div className="flex items-center">
                                        {getPriorityBadge(index)}
                                        <button 
                                          onClick={() => deleteTask(task.id)}
                                          className="ml-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                     </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        <button 
                          onClick={() => addTask(section.id)}
                          className="mt-3 flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors w-full p-1 hover:bg-slate-50 rounded"
                        >
                          <Plus className="w-3.5 h-3.5" /> ADD TASK
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 border-[1.5px] border-slate-300 rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-100 py-2.5 px-5 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">End of Day Review & Execution Summary</h3>
            </div>
            <div className="p-1">
              <textarea 
                className="w-full h-24 p-4 outline-none resize-none text-sm font-medium text-slate-700 leading-relaxed bg-[linear-gradient(transparent_27px,#e2e8f0_28px)] bg-[length:100%_28px] focus:bg-[linear-gradient(transparent_27px,#c7d2fe_28px)] transition-all"
                placeholder="Write your reflections before sleep here..."
                style={{ lineHeight: '28px' }}
                value={reflections[selectedDate] || ''}
                onChange={(e) => updateReflection(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div 
          onDragOver={(e) => handleDragOver(e, 'clearance-bin')}
          onDragLeave={handleDragLeave}
          onDrop={handleDropOnClearance}
          className={`absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-full shadow-lg border-2 transition-all backdrop-blur-md
            ${hoveredDropZone === 'clearance-bin' 
              ? 'bg-amber-100/90 border-amber-400 text-amber-800 scale-105' 
              : 'bg-slate-900/90 border-slate-700 text-white hover:bg-slate-800'}`}
        >
          <Archive className={`w-5 h-5 ${hoveredDropZone === 'clearance-bin' ? 'animate-bounce' : ''}`} />
          <span className="text-sm font-bold tracking-wide">
            {hoveredDropZone === 'clearance-bin' ? 'Drop to defer to Tomorrow!' : 'Drag task here to push to Tomorrow'}
          </span>
        </div>

      </main>
    </div>
  );
}
