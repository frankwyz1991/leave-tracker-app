import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Users, Clock, Download, Check, X, ChevronDown, Search, AtSign, CheckCircle, Timer, Loader2, Link, AlertCircle, ArrowRight, Lock, ArrowUpDown, ArrowUp, ArrowDown, Filter } from 'lucide-react';

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
  if (t.includes("bereavement")) return "bg-slate-100 text-slate-700 border-slate-200";
  if (t.includes("sick") || t.includes("medical") || t.includes("disability") || t.includes("ada")) return "bg-rose-100 text-rose-700 border-rose-200";
  if (t.includes("vacation") || t.includes("personal")) return "bg-blue-100 text-blue-700 border-blue-200";
  if (t.includes("family") || t.includes("baby") || t.includes("carer")) return "bg-purple-100 text-purple-700 border-purple-200";
  if (t.includes("military")) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (t.includes("ad hoc") || t.includes("ramp")) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
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
  
  // Sorting & Filtering State
  const [sortConfig, setSortConfig] = useState({ key: 'start', direction: 'desc' });
  const [statusFilter, setStatusFilter] = useState('All');

  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState('');
  
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
        // Dummy data for demo purposes with diverse dates and statuses
        setLeaves([
            { id: 1, name: 'Demo User', username: 'demo', type: 'Personal Leave', start: new Date().toISOString(), end: new Date().toISOString(), status: 'Pending' },
            { id: 2, name: 'John Doe', username: 'jdoe', type: 'Sick Leave', start: '2023-10-01', end: '2023-10-03', status: 'Approved' },
            { id: 3, name: 'Jane Smith', username: 'jsmith', type: 'Vacation', start: '2023-12-20', end: '2023-12-25', status: 'Pending' }
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

  // -- Derived Data: Filtering & Sorting --
  const processedLeaves = useMemo(() => {
    let data = [...leaves];

    // 1. Filter by Search Term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter(l => 
        (l.name || '').toLowerCase().includes(term) || 
        (l.username || '').toLowerCase().includes(term)
      );
    }

    // 2. Filter by Status
    if (statusFilter !== 'All') {
      data = data.filter(l => l.status === statusFilter);
    }

    // 3. Sort Data
    if (sortConfig.key) {
      data.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Special handling for specific columns
        if (sortConfig.key === 'dates') {
             aValue = new Date(a.start);
             bValue = new Date(b.start);
        } else if (sortConfig.key === 'duration') {
            aValue = getDuration(a.start, a.end);
            bValue = getDuration(b.start, b.end);
        } else {
            // Default string comparison for name, type, status
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

  // Stats Calculations
  const activeLeaves = leaves.filter(l => l.status !== 'Rejected');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalDays = activeLeaves.reduce((acc, curr) => acc + getDuration(curr.start, curr.end), 0);
  
  const inProgressCount = activeLeaves.filter(l => {
    const start = new Date(l.start);
    const end = new Date(l.end);
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    return start <= today && end >= today;
  }).length;

  const completedDays = activeLeaves
    .filter(l => {
      const end = new Date(l.end);
      end.setHours(0,0,0,0);
      return end < today;
    })
    .reduce((acc, curr) => acc + getDuration(curr.start, curr.end), 0);


  // -- Handlers --
  const handleAddLeave = async (e) => {
    e.preventDefault();
    setDateError('');

    if (!newLeave.name || !newLeave.start || !newLeave.end) return;

    // Date Validation
    if (new Date(newLeave.end) < new Date(newLeave.start)) {
      setDateError("End date cannot be before start date");
      return;
    }
    
    setIsSubmitting(true);
    const success = await sendToSheet({ action: 'add', ...newLeave });
    
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
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[status] || 'bg-gray-50'}`}>
        {status}
      </span>
    );
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="ml-1 text-gray-300" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="ml-1 text-blue-600" />
      : <ArrowDown size={14} className="ml-1 text-blue-600" />;
  };

  const StatCard = ({ icon: Icon, label, value, colorBg, colorText }) => (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 min-w-[200px]">
      <div className={`p-4 rounded-lg ${colorBg} ${colorText}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-wide">{label}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      </div>
    </div>
  );

  const TimelineView = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

    const isLeaveOnDay = (leave, day) => {
      if (leave.status === 'Rejected') return false;
      const checkDate = new Date(year, month, day);
      const start = new Date(leave.start);
      const end = new Date(leave.end);
      checkDate.setHours(0,0,0,0);
      start.setHours(0,0,0,0);
      end.setHours(0,0,0,0);
      return checkDate >= start && checkDate <= end;
    };

    return (
      <div className="overflow-x-auto border-t">
         <div className="p-4 flex justify-between items-center border-b bg-gray-50">
           <button onClick={() => setCurrentMonth(new Date(year, month - 1))} className="p-1 hover:bg-gray-200 rounded"><ArrowRight className="rotate-180" size={20} /></button>
           <h3 className="font-bold text-lg text-gray-800">{monthName}</h3>
           <button onClick={() => setCurrentMonth(new Date(year, month + 1))} className="p-1 hover:bg-gray-200 rounded"><ArrowRight size={20} /></button>
        </div>
        <div className="min-w-[800px]">
          <div className="grid grid-flow-col auto-cols-fr border-b bg-gray-50">
            <div className="w-48 p-3 text-xs font-bold text-gray-500 uppercase sticky left-0 z-10 border-r bg-gray-50">Employee</div>
            {days.map(d => (
              <div key={d} className={`w-8 flex-shrink-0 text-center text-xs py-2 border-r font-medium text-gray-500`}>{d}</div>
            ))}
          </div>
          {processedLeaves.map(leave => (
            <div key={leave.id} className={`flex border-b h-12 items-center hover:bg-gray-50 transition group ${leave.status === 'Rejected' ? 'opacity-50 bg-gray-50' : ''}`}>
              <div className="w-48 p-3 text-sm font-medium truncate sticky left-0 bg-white z-10 border-r group-hover:bg-gray-50">
                 <span className={leave.status === 'Rejected' ? 'line-through text-gray-400' : ''}>{leave.name}</span>
              </div>
              {days.map(d => (
                <div key={d} className={`w-8 h-full border-r flex-shrink-0 ${isLeaveOnDay(leave, d) ? getTypeStyles(leave.type).replace('text-slate-700', 'bg-blue-400').replace('text-rose-700', 'bg-rose-400').replace('text-blue-700', 'bg-blue-400').replace('text-purple-700', 'bg-purple-400').replace('text-emerald-700', 'bg-emerald-400').replace('text-amber-700', 'bg-amber-400') : ''}`}></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // -- Render --

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} error={authError} />;
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans text-slate-800">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {GOOGLE_SCRIPT_URL.includes("REPLACE") && (
             <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="flex items-center">
                    <div className="flex-shrink-0">
                        <Link className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-yellow-700">
                            <strong>Action Required:</strong> Connect your Google Sheet. <br/>
                            1. Open your Sheet &gt; Extensions &gt; Apps Script. <br/>
                            2. Paste the backend code. <br/>
                            3. Deploy as Web App (Access: Anyone). <br/>
                            4. Paste the URL in Line 6 of the code.
                        </p>
                    </div>
                </div>
            </div>
        )}

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            icon={Users} 
            label="Total Records" 
            value={activeLeaves.length} 
            colorBg="bg-blue-50" 
            colorText="text-blue-600" 
          />
          <StatCard 
            icon={Clock} 
            label="Total Days" 
            value={totalDays} 
            colorBg="bg-emerald-50" 
            colorText="text-emerald-600" 
          />
           <StatCard 
            icon={CheckCircle} 
            label="Days Completed" 
            value={completedDays} 
            colorBg="bg-purple-50" 
            colorText="text-purple-600" 
          />
          <StatCard 
            icon={Timer} 
            label="In Progress" 
            value={inProgressCount} 
            colorBg="bg-yellow-50" 
            colorText="text-yellow-600" 
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* Left Sidebar: Log New Leave */}
          <div className="w-full lg:w-[350px] flex-shrink-0 bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative">
            {isSubmitting && (
                <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-xl">
                    <Loader2 className="animate-spin text-blue-600" size={32} />
                </div>
            )}
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Plus size={20} /> Log New Leave
            </h2>
            
            <form onSubmit={handleAddLeave} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Employee Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. Jane Doe"
                  value={newLeave.name}
                  onChange={e => setNewLeave({...newLeave, name: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Username / ID</label>
                <div className="relative">
                   <AtSign size={16} className="absolute left-3 top-3 text-gray-400" />
                   <input 
                    type="text" 
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    placeholder="jane.d"
                    value={newLeave.username}
                    onChange={e => setNewLeave({...newLeave, username: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Start Date</label>
                  <input 
                    type="date" 
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-600"
                    value={newLeave.start}
                    onChange={e => setNewLeave({...newLeave, start: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">End Date</label>
                  <input 
                    type="date" 
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-600"
                    value={newLeave.end}
                    onChange={e => setNewLeave({...newLeave, end: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              {dateError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle size={16} />
                  <span>{dateError}</span>
                </div>
              )}

              {/* Custom Leave Type Picker Trigger */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Leave Type</label>
                <button
                  type="button"
                  onClick={() => setIsTypePickerOpen(true)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-left flex justify-between items-center group transition-all hover:bg-gray-100"
                >
                  <span className="truncate text-gray-700">{newLeave.type || "Select Type..."}</span>
                  <ChevronDown size={16} className="text-gray-400 group-hover:text-blue-500" />
                </button>
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Status</label>
                <div className="relative">
                  <select 
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer"
                    value={newLeave.status}
                    onChange={e => setNewLeave({...newLeave, status: e.target.value})}
                  >
                    <option>Pending</option>
                    <option>Approved</option>
                    <option>Rejected</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>

               <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Notes (Optional)</label>
                <textarea 
                  rows="3"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                  placeholder="Add any details..."
                  value={newLeave.notes}
                  onChange={e => setNewLeave({...newLeave, notes: e.target.value})}
                />
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-[0.98]">
                Add Record
              </button>
            </form>
          </div>

          {/* Right Content: Table & Toolbar */}
          <div className="flex-1 w-full min-w-0">
            
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
              <div className="relative w-full sm:w-64">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search employee..." 
                  className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
                   <button 
                    onClick={() => setStatusFilter('All')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${statusFilter === 'All' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    All
                  </button>
                   <button 
                    onClick={() => setStatusFilter('Pending')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1 ${statusFilter === 'Pending' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <Clock size={14} /> Pending
                  </button>
                  <button 
                    onClick={() => setStatusFilter('Approved')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${statusFilter === 'Approved' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Approved
                  </button>
                   <button 
                    onClick={() => setStatusFilter('Rejected')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${statusFilter === 'Rejected' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Rejected
                  </button>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
                  <button 
                    onClick={() => setView('list')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    List
                  </button>
                   <button 
                    onClick={() => setView('timeline')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${view === 'timeline' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Timeline
                  </button>
                </div>
              </div>
            </div>

            {/* Main Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative min-h-[400px]">
              
              {isLoading ? (
                 <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-white/90">
                    <Loader2 className="animate-spin text-blue-600 mb-3" size={48} />
                    <p className="text-gray-500 font-medium">Loading from Google Sheets...</p>
                 </div>
              ) : (
                 view === 'list' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th 
                          onClick={() => handleSort('name')}
                          className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition select-none"
                        >
                          <div className="flex items-center">Employee <SortIcon columnKey="name" /></div>
                        </th>
                        <th 
                          onClick={() => handleSort('dates')}
                          className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition select-none"
                        >
                          <div className="flex items-center">Dates <SortIcon columnKey="dates" /></div>
                        </th>
                        <th 
                           onClick={() => handleSort('duration')}
                           className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition select-none"
                        >
                           <div className="flex items-center">Duration <SortIcon columnKey="duration" /></div>
                        </th>
                        <th 
                           onClick={() => handleSort('type')}
                           className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition select-none"
                        >
                          <div className="flex items-center">Type <SortIcon columnKey="type" /></div>
                        </th>
                        <th 
                           onClick={() => handleSort('status')}
                           className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition select-none"
                        >
                           <div className="flex items-center">Status <SortIcon columnKey="status" /></div>
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {processedLeaves.length === 0 ? (
                         <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-400">No records found</td></tr>
                      ) : (
                        processedLeaves.map((leave) => (
                          <tr key={leave.id} className={`hover:bg-gray-50/50 transition group ${leave.status === 'Rejected' ? 'bg-gray-50/50' : ''}`}>
                            <td className="px-6 py-4">
                              <div className={`font-semibold ${leave.status === 'Rejected' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{leave.name}</div>
                              <div className="text-xs text-gray-400 mt-0.5">{leave.username}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                              {formatDateRange(leave.start, leave.end)}
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium border border-gray-200">
                                {getDuration(leave.start, leave.end)} days
                              </span>
                            </td>
                            <td className="px-6 py-4">
                               <span className={`px-3 py-1 rounded-full text-xs font-semibold border inline-block max-w-[160px] truncate align-bottom ${getTypeStyles(leave.type)}`}>
                                {leave.type}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                               <StatusBadge status={leave.status} />
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-1">
                                {leave.status === 'Pending' && (
                                  <>
                                    <button 
                                      onClick={() => handleStatusChange(leave.id, 'Approved')}
                                      className="text-green-600 hover:bg-green-50 p-2 rounded transition"
                                      title="Approve"
                                    >
                                      <Check size={16} />
                                    </button>
                                    <button 
                                      onClick={() => handleStatusChange(leave.id, 'Rejected')}
                                      className="text-red-600 hover:bg-red-50 p-2 rounded transition"
                                      title="Reject"
                                    >
                                      <X size={16} />
                                    </button>
                                    <div className="w-px h-6 bg-gray-200 mx-1 self-center"></div>
                                  </>
                                )}
                                <button 
                                  onClick={() => handleDelete(leave.id)}
                                  className="text-gray-300 hover:text-red-500 transition p-2 rounded-full hover:bg-red-50"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <TimelineView />
              )
              )}
             
            </div>
          </div>

        </div>
      </div>

      {/* Leave Type Selection Modal */}
      {isTypePickerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold text-lg text-gray-800">Select Leave Type</h3>
              <button onClick={() => setIsTypePickerOpen(false)} className="p-1 hover:bg-gray-200 rounded-full transition">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            
            {/* Search bar inside modal */}
            <div className="p-4 border-b bg-white">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search type..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={typeSearch}
                  onChange={e => setTypeSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {filteredTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setNewLeave({ ...newLeave, type: type });
                      setIsTypePickerOpen(false);
                      setTypeSearch('');
                    }}
                    className={`p-3 rounded-lg text-left text-sm border transition hover:shadow-sm flex items-center justify-between group ${newLeave.type === type ? 'ring-1 ring-blue-500 border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'}`}
                  >
                    <span className={`font-medium ${newLeave.type === type ? 'text-blue-700' : 'text-gray-700'}`}>{type}</span>
                    {newLeave.type === type && <Check size={16} className="text-blue-600" />}
                  </button>
                ))}
                {filteredTypes.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-gray-400">
                    No types found matching "{typeSearch}"
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveTracker;