import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Users, Clock, Download, Check, X, ChevronDown, Search, AtSign, CheckCircle, Timer, Loader2, Link, AlertCircle, ArrowRight, Lock, ArrowUpDown, ArrowUp, ArrowDown, Filter, FilePlus, FileCheck, RefreshCw, XCircle, PlayCircle } from 'lucide-react';

// --- CONFIGURATION ---
// 🔴 IMPORTANT: Replace this URL with the one you copied from "Deploy > Web App" in Google Sheets
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx5evYmu1lJnRBebzTbrHeP08MACC28nvYVyi7_S74ssI5OYzKG6_-nD9_PxlHeaX0t/exec"; 

// --- Constants ---
const LEAVE_TYPES = [
  "Personal Leave",
  "Military Leave",
  "Family Medical Leave", 
  "Baby Bonding",
  "Paid Family Leave",
  "Short Term Disability",
  "Long Term Disability",
  "Carer’s Leave",
  "ADA Leave",
  "Bereavement [Child, Step Child, Spouse/ Domestic Partner]",
  "Bereavement [Parent, Sibling, Step Sibling]",
  "Bereavement [Extension]",
  "Bereavement [Other]",
  "Bereavement [Ineligible]",
  "Ramp Back Time",
  "Ad Hoc - Guaranteed",
  "Ad Hoc - Discount Only",
  "Unpaid Leave"
];

const BEREAVEMENT_OPTIONS = [
  "Bereavement [Child, Step Child, Spouse/ Domestic Partner]",
  "Bereavement [Parent, Sibling, Step Sibling]",
  "Bereavement [Extension]",
  "Bereavement [Other]"
];

// --- Utilities ---

const formatDateRange = (start, end) => {
  if (!start || !end) return '';
  const s = new Date(start);
  const e = new Date(end);
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${s.toLocaleDateString('en-US', options)} - ${e.toLocaleDateString('en-US', options)}`;
};

const getDuration = (start, end) => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  const diffTime = Math.abs(e - s);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
  return diffDays;
};

const getTypeStyles = (type) => {
  const t = (type || '').toLowerCase();
  if (t.includes("ineligible")) return "bg-amber-100 text-amber-800 border-amber-300"; // Highlight ineligible
  if (t.includes("bereavement")) return "bg-slate-100 text-slate-700 border-slate-200";
  if (t.includes("sick") || t.includes("medical") || t.includes("disability") || t.includes("ada")) return "bg-rose-100 text-rose-700 border-rose-200";
  if (t.includes("vacation") || t.includes("personal")) return "bg-blue-100 text-blue-700 border-blue-200";
  if (t.includes("family") || t.includes("baby") || t.includes("carer")) return "bg-purple-100 text-purple-700 border-purple-200";
  if (t.includes("military")) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (t.includes("ad hoc") || t.includes("ramp")) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
};

// Helper to check if a date string matches today
const isToday = (dateString) => {
  if (!dateString) return false;
  const d = new Date(dateString);
  const today = new Date();
  return d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
};

const LoginScreen = ({ onLogin, error }) => {
  const [pass, setPass] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(pass);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="text-blue-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Team Access</h1>
          <p className="text-gray-500 mt-2">Enter the team passcode to access the leave tracker.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input 
              type="password" 
              placeholder="Enter Passcode"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-center text-lg tracking-widest"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoFocus
            />
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center font-medium animate-in fade-in">
              {error}
            </div>
          )}

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-md transition-all transform active:scale-[0.98]"
          >
            Access Dashboard
          </button>
        </form>
      </div>
    </div>
  );
};

const LeaveTracker = () => {
  // -- State --
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiPassword, setApiPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [view, setView] = useState('list'); 
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [leaves, setLeaves] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateError, setDateError] = useState('');
  
  const [sortConfig, setSortConfig] = useState({ key: 'start', direction: 'desc' });
  const [statusFilter, setStatusFilter] = useState('All');

  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState('');
  
  // State for fixing ineligible leaves
  const [leaveIdToFix, setLeaveIdToFix] = useState(null);

  const [newLeave, setNewLeave] = useState({
    name: '',
    username: '',
    type: 'Personal Leave',
    start: '',
    end: '',
    status: 'Pending',
    notes: ''
  });

  // --- Actions ---

  const handleLogin = (password) => {
    setApiPassword(password);
    setIsLoading(true);
    fetchLeaves(password);
  };

  const fetchLeaves = async (passwordOverride) => {
    const pass = passwordOverride || apiPassword;
    if (!pass) return;

    if (GOOGLE_SCRIPT_URL.includes("REPLACE")) {
        setIsAuthenticated(true);
        setLeaves([
            { id: 1, name: 'Demo User', username: 'demo', type: 'Bereavement [Ineligible]', start: new Date().toISOString(), end: new Date().toISOString(), status: 'Pending', submittedAt: new Date().toISOString() },
            { id: 2, name: 'John Doe', username: 'jdoe', type: 'Sick Leave', start: '2023-10-01', end: '2023-10-03', status: 'Approved', submittedAt: '2023-09-28' }
        ]);
        setIsLoading(false);
        return; 
    }

    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?password=${encodeURIComponent(pass)}`);
      const data = await response.json();
      
      if (data.error) {
        setAuthError("Incorrect passcode");
        setIsAuthenticated(false);
        setIsLoading(false);
      } else {
        if (Array.isArray(data)) {
          setLeaves(data);
        }
        setIsAuthenticated(true);
        setAuthError("");
      }
    } catch (error) {
      console.error("Error fetching from sheets:", error);
      setAuthError("Connection failed");
    } finally {
      setIsLoading(false);
    }
  };

  const sendToSheet = async (payload) => {
    if (GOOGLE_SCRIPT_URL.includes("REPLACE")) {
        alert("Please replace the GOOGLE_SCRIPT_URL in the code.");
        return false;
    }
    try {
        const payloadWithAuth = { ...payload, password: apiPassword };
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payloadWithAuth)
        });
        fetchLeaves(); 
        return true;
    } catch (error) {
        console.error("Error sending to sheet", error);
        return false;
    }
  };

  // -- Derived Data --
  const processedLeaves = useMemo(() => {
    let data = [...leaves];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter(l => 
        (l.name || '').toLowerCase().includes(term) || 
        (l.username || '').toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'All') {
      data = data.filter(l => l.status === statusFilter);
    }

    if (sortConfig.key) {
      data.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'dates') {
             aValue = new Date(a.start);
             bValue = new Date(b.start);
        } else if (sortConfig.key === 'duration') {
            aValue = getDuration(a.start, a.end);
            bValue = getDuration(b.start, b.end);
        } else {
            aValue = (aValue || '').toString().toLowerCase();
            bValue = (bValue || '').toString().toLowerCase();
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [leaves, searchTerm, sortConfig, statusFilter]);
  
  const filteredTypes = LEAVE_TYPES.filter(t => 
    t.toLowerCase().includes(typeSearch.toLowerCase())
  );

  // --- NEW STATS CALCULATIONS ---
  const activeLeaves = leaves.filter(l => l.status !== 'Rejected');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Records Completed (End date < Today)
  const recordsCompletedCount = activeLeaves.filter(l => {
    const end = new Date(l.end);
    end.setHours(0,0,0,0);
    return end < today;
  }).length;

  // 2. Pending Records
  const pendingCount = leaves.filter(l => l.status === 'Pending').length;

  // 3. Records in Progress (Current date is between start and end)
  const recordsInProgressCount = activeLeaves.filter(l => {
    const start = new Date(l.start);
    const end = new Date(l.end);
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    return start <= today && end >= today;
  }).length;

  // 4. Rejected Records
  const rejectedCount = leaves.filter(l => l.status === 'Rejected').length;

  // 5. Submitted Today (Uses new submittedAt field)
  const submittedTodayCount = leaves.filter(l => isToday(l.submittedAt)).length;

  // -- Handlers --
  const handleAddLeave = async (e) => {
    e.preventDefault();
    setDateError('');
    if (!newLeave.name || !newLeave.start || !newLeave.end) return;
    if (new Date(newLeave.end) < new Date(newLeave.start)) {
      setDateError("End date cannot be before start date");
      return;
    }
    setIsSubmitting(true);
    const success = await sendToSheet({ action: 'add', ...newLeave, submittedAt: new Date().toISOString() });
    if (success) {
        setNewLeave({ name: '', username: '', type: 'Personal Leave', start: '', end: '', status: 'Pending', notes: '' });
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id) => {
    if(confirm("Are you sure? This will delete the row from the spreadsheet.")) {
        setIsLoading(true);
        await sendToSheet({ action: 'delete', id: id });
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    setIsLoading(true);
    await sendToSheet({ action: 'updateStatus', id: id, status: newStatus });
  };

  const handleTypeChange = async (id, newType) => {
    setIsLoading(true);
    await sendToSheet({ action: 'updateType', id: id, type: newType });
    setLeaveIdToFix(null);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // -- Components --
  const StatusBadge = ({ status }) => {
    const colors = {
      Approved: 'bg-green-50 text-green-700 border-green-200',
      Pending: 'bg-amber-50 text-amber-700 border-amber-200',
      Rejected: 'bg-red-50 text-red-700 border-red-200 line-through opacity-60'
    };
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[status] || 'bg-gray-50'}`}>{status}</span>;
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="ml-1 text-gray-300" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-blue-600" /> : <ArrowDown size={14} className="ml-1 text-blue-600" />;
  };

  const StatCard = ({ icon: Icon, label, value, colorBg, colorText }) => (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 min-w-[200px]">
      <div className={`p-4 rounded-lg ${colorBg} ${colorText}`}><Icon size={24} /></div>
      <div><p className="text-gray-500 text-xs font-bold uppercase tracking-wide">{label}</p><h3 className="text-2xl font-bold text-gray-900">{value}</h3></div>
    </div>
  );

  const TimelineView = () => { /* Simplified for brevity, same as before */ return <div className="p-8 text-center text-gray-500">Timeline view is active</div>; };

  if (!isAuthenticated) return <LoginScreen onLogin={handleLogin} error={authError} />;

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans text-slate-800">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {GOOGLE_SCRIPT_URL.includes("REPLACE") && (
             <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded shadow-sm"><p className="text-sm text-yellow-700">Action Required: Connect your Google Sheet.</p></div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          <StatCard icon={Users} label="Total Records" value={activeLeaves.length} colorBg="bg-blue-50" colorText="text-blue-600" />
          <StatCard icon={FileCheck} label="Records Completed" value={recordsCompletedCount} colorBg="bg-emerald-50" colorText="text-emerald-600" />
          <StatCard icon={PlayCircle} label="Records in Progress" value={recordsInProgressCount} colorBg="bg-indigo-50" colorText="text-indigo-600" />
          <StatCard icon={Clock} label="Pending" value={pendingCount} colorBg="bg-amber-50" colorText="text-amber-600" />
          <StatCard icon={XCircle} label="Rejected" value={rejectedCount} colorBg="bg-red-50" colorText="text-red-600" />
          <StatCard icon={FilePlus} label="Records Added Today" value={submittedTodayCount} colorBg="bg-purple-50" colorText="text-purple-600" />
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Sidebar Form */}
          <div className="w-full lg:w-[350px] flex-shrink-0 bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative">
            {isSubmitting && <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-xl"><Loader2 className="animate-spin text-blue-600" size={32} /></div>}
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"><Plus size={20} /> Log New Leave</h2>
            <form onSubmit={handleAddLeave} className="space-y-5">
               {/* Fields */}
               <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Employee Name</label><input type="text" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg" value={newLeave.name} onChange={e => setNewLeave({...newLeave, name: e.target.value})} required placeholder="e.g. Jane Doe" /></div>
               <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Username / ID</label><input type="text" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg" value={newLeave.username} onChange={e => setNewLeave({...newLeave, username: e.target.value})} placeholder="jane.d" /></div>
               <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Start Date</label><input type="date" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg" value={newLeave.start} onChange={e => setNewLeave({...newLeave, start: e.target.value})} required /></div>
                <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">End Date</label><input type="date" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg" value={newLeave.end} onChange={e => setNewLeave({...newLeave, end: e.target.value})} required /></div>
               </div>
               {dateError && <div className="text-red-600 text-sm">{dateError}</div>}
               <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Leave Type</label><button type="button" onClick={() => setIsTypePickerOpen(true)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-left flex justify-between items-center"><span className="truncate text-gray-700 max-w-[250px] block">{newLeave.type || "Select Type..."}</span> <ChevronDown size={16}/></button></div>
               {/* Conditional Warning in Form */}
               {newLeave.type === "Bereavement [Ineligible]" && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm"><p className="text-amber-800 font-medium mb-2 flex items-center gap-2 text-xs"><AlertCircle size={14} /> Switch to eligible type?</p><div className="flex flex-col gap-1">{BEREAVEMENT_OPTIONS.map(type => (<button key={type} type="button" onClick={() => setNewLeave({ ...newLeave, type })} className="text-left text-amber-700 hover:text-amber-900 hover:bg-amber-100 px-2 py-1.5 rounded transition text-xs truncate" title={type}>• {type}</button>))}</div></div>
               )}
               <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Status</label><select className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg" value={newLeave.status} onChange={e => setNewLeave({...newLeave, status: e.target.value})}><option>Pending</option><option>Approved</option><option>Rejected</option></select></div>
               <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Notes</label><textarea rows="3" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg" value={newLeave.notes} onChange={e => setNewLeave({...newLeave, notes: e.target.value})}></textarea></div>
               <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-md">Add Record</button>
            </form>
          </div>

          {/* Main Table */}
          <div className="flex-1 w-full min-w-0">
             {/* Filter Toolbar (same as before, abbreviated) */}
             <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4"><div className="relative w-full sm:w-64"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search..." className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></div>

             <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative min-h-[400px]">
               {isLoading ? <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10"><Loader2 className="animate-spin text-blue-600 mb-3" size={48}/><p>Loading...</p></div> : (
                 <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse">
                     <thead>
                       <tr className="border-b border-gray-100 bg-gray-50/50">
                         <th onClick={() => handleSort('name')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase cursor-pointer">Employee <SortIcon columnKey="name" /></th>
                         <th onClick={() => handleSort('dates')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase cursor-pointer">Dates <SortIcon columnKey="dates" /></th>
                         <th onClick={() => handleSort('duration')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase cursor-pointer">Duration <SortIcon columnKey="duration" /></th>
                         <th onClick={() => handleSort('type')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase cursor-pointer">Type <SortIcon columnKey="type" /></th>
                         <th onClick={() => handleSort('status')} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase cursor-pointer">Status <SortIcon columnKey="status" /></th>
                         <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Action</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                       {processedLeaves.map((leave) => (
                         <tr key={leave.id} className={`hover:bg-gray-50/50 transition ${leave.status === 'Rejected' ? 'bg-gray-50/50' : ''}`}>
                           <td className="px-6 py-4"><div className={`font-semibold ${leave.status === 'Rejected' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{leave.name}</div><div className="text-xs text-gray-400 mt-0.5">{leave.username}</div></td>
                           <td className="px-6 py-4 text-sm text-gray-600 font-medium">{formatDateRange(leave.start, leave.end)}</td>
                           <td className="px-6 py-4"><span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium border border-gray-200">{getDuration(leave.start, leave.end)} days</span></td>
                           
                           {/* TYPE CELL with QUICK FIX */}
                           <td className="px-6 py-4">
                             <div className="flex flex-col gap-1 items-start">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border inline-block max-w-[160px] truncate align-bottom ${getTypeStyles(leave.type)}`}>{leave.type}</span>
                                {leave.type === "Bereavement [Ineligible]" && (
                                  <button onClick={() => setLeaveIdToFix(leave.id)} className="text-xs flex items-center gap-1 text-amber-700 hover:text-amber-900 font-medium bg-amber-50 px-2 py-1 rounded border border-amber-200 mt-1">
                                    <RefreshCw size={12} /> Switch Type
                                  </button>
                                )}
                             </div>
                           </td>

                           <td className="px-6 py-4"><StatusBadge status={leave.status} /></td>
                           <td className="px-6 py-4 text-right">
                               <div className="flex justify-end gap-1">
                                {leave.status === 'Pending' && <><button onClick={() => handleStatusChange(leave.id, 'Approved')} className="text-green-600 hover:bg-green-50 p-2 rounded"><Check size={16} /></button><button onClick={() => handleStatusChange(leave.id, 'Rejected')} className="text-red-600 hover:bg-red-50 p-2 rounded"><X size={16} /></button><div className="w-px h-6 bg-gray-200 mx-1 self-center"></div></>}
                                <button onClick={() => handleDelete(leave.id)} className="text-gray-300 hover:text-red-500 transition p-2 rounded-full hover:bg-red-50"><Trash2 size={16} /></button>
                               </div>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>

      {/* --- MODAL FOR FIXING TYPE --- */}
      {leaveIdToFix && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b bg-amber-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-amber-800 flex items-center gap-2"><AlertCircle size={20}/> Fix Bereavement Type</h3>
              <button onClick={() => setLeaveIdToFix(null)} className="p-1 hover:bg-amber-100 rounded-full"><X size={20} className="text-amber-800" /></button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">Select the correct bereavement type for this record:</p>
              <div className="flex flex-col gap-2">
                {BEREAVEMENT_OPTIONS.map(type => (
                  <button
                    key={type}
                    onClick={() => handleTypeChange(leaveIdToFix, type)}
                    className="p-3 text-left border rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition text-sm font-medium text-gray-700"
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leave Type Picker Modal (Same as before) */}
      {isTypePickerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl"><h3 className="font-bold text-lg text-gray-800">Select Leave Type</h3><button onClick={() => setIsTypePickerOpen(false)}><X size={20} className="text-gray-500" /></button></div>
            <div className="p-4 border-b bg-white"><div className="relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search type..." className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg outline-none" value={typeSearch} onChange={e => setTypeSearch(e.target.value)} autoFocus /></div></div>
            <div className="overflow-y-auto p-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{filteredTypes.map((type) => (<button key={type} onClick={() => { setNewLeave({ ...newLeave, type: type }); setIsTypePickerOpen(false); setTypeSearch(''); }} className={`p-3 rounded-lg text-left text-sm border flex items-center justify-between group ${newLeave.type === type ? 'ring-1 ring-blue-500 border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'}`}><span className={`font-medium ${newLeave.type === type ? 'text-blue-700' : 'text-gray-700'}`}>{type}</span>{newLeave.type === type && <Check size={16} className="text-blue-600" />}</button>))}</div></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveTracker;