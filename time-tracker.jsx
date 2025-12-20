import React, { useState, useEffect } from 'react';
import { Clock, MapPin, CheckCircle, XCircle, Upload, FileText, Calendar, DollarSign, Briefcase } from 'lucide-react';

export default function FieldWorkTracker() {
  const [currentState, setCurrentState] = useState('idle'); // idle, heading, onsite
  const [currentJob, setCurrentJob] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [showJobForm, setShowJobForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [reportView, setReportView] = useState('daily'); // daily or weekly
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [lastPosition, setLastPosition] = useState(null);
  const [drivingDistance, setDrivingDistance] = useState(0);
  const watchIdRef = React.useRef(null);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Auto-detection using GPS
  useEffect(() => {
    if (!autoDetectEnabled) {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatus('Geolocation not supported');
      return;
    }

    setLocationStatus('Requesting location access...');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLocationStatus('Tracking location');
        handleLocationUpdate(position);
      },
      (error) => {
        setLocationStatus(`Location error: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [autoDetectEnabled, currentState, lastPosition, drivingDistance]);

  const handleLocationUpdate = (position) => {
    const currentPos = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      speed: position.coords.speed, // meters per second
      timestamp: position.timestamp
    };

    if (!lastPosition) {
      setLastPosition(currentPos);
      return;
    }

    // Calculate distance between positions (in miles)
    const distance = calculateDistance(
      lastPosition.lat,
      lastPosition.lng,
      currentPos.lat,
      currentPos.lng
    );

    // Calculate speed in mph
    const timeDiff = (currentPos.timestamp - lastPosition.timestamp) / 1000; // seconds
    const speedMph = currentPos.speed !== null 
      ? currentPos.speed * 2.237 // convert m/s to mph
      : (distance / timeDiff) * 3600; // calculate from distance/time

    // Auto-detect driving (speed > 15mph)
    if (speedMph > 15) {
      const newDistance = drivingDistance + distance;
      setDrivingDistance(newDistance);

      // If heading to job and traveled > 0.25 miles at speed, assume still driving
      if (currentState === 'heading' && newDistance > 0.25) {
        setLocationStatus(`Driving: ${speedMph.toFixed(0)} mph (${newDistance.toFixed(2)} mi)`);
      }
    } else {
      // Not driving (speed <= 15mph)
      if (currentState === 'heading' && drivingDistance > 0.25) {
        // Stopped after driving - auto-arrive
        setLocationStatus('Stopped - Auto-arrived at site');
        handleArrivedOnsite();
        setDrivingDistance(0);
      } else {
        setLocationStatus(`Not moving (${speedMph.toFixed(0)} mph)`);
        setDrivingDistance(0);
      }
    }

    setLastPosition(currentPos);
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    // Haversine formula to calculate distance in miles
    const R = 3959; // Earth's radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toRad = (degrees) => {
    return degrees * (Math.PI / 180);
  };

  const loadData = async () => {
    try {
      const jobsData = await window.storage.get('field-jobs');
      const expensesData = await window.storage.get('field-expenses');
      const stateData = await window.storage.get('field-state');
      
      if (jobsData?.value) setJobs(JSON.parse(jobsData.value));
      if (expensesData?.value) setExpenses(JSON.parse(expensesData.value));
      if (stateData?.value) {
        const state = JSON.parse(stateData.value);
        setCurrentState(state.currentState || 'idle');
        setCurrentJob(state.currentJob || null);
      }
    } catch (error) {
      console.log('No saved data found, starting fresh');
    }
  };

  const saveData = async (newJobs, newExpenses, newState, newCurrentJob) => {
    try {
      await window.storage.set('field-jobs', JSON.stringify(newJobs || jobs));
      await window.storage.set('field-expenses', JSON.stringify(newExpenses || expenses));
      await window.storage.set('field-state', JSON.stringify({
        currentState: newState !== undefined ? newState : currentState,
        currentJob: newCurrentJob !== undefined ? newCurrentJob : currentJob
      }));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const handleHeadedToJob = () => {
    setShowJobForm(true);
  };

  const startJob = (jobData) => {
    const newJob = {
      ...jobData,
      id: Date.now().toString(),
      headedTime: new Date().toISOString(),
      arrivedTime: null,
      leftTime: null,
      driveTime: 0,
      workTime: 0,
      date: new Date().toISOString().split('T')[0]
    };
    setCurrentJob(newJob);
    setCurrentState('heading');
    setShowJobForm(false);
    setDrivingDistance(0); // Reset driving distance for new job
    
    const updatedJobs = [...jobs, newJob];
    setJobs(updatedJobs);
    saveData(updatedJobs, null, 'heading', newJob);
  };

  const handleArrivedOnsite = () => {
    if (currentJob && currentState === 'heading') {
      const arrivedTime = new Date().toISOString();
      const driveTime = (new Date(arrivedTime) - new Date(currentJob.headedTime)) / 1000 / 60; // minutes
      
      const updatedJob = {
        ...currentJob,
        arrivedTime,
        driveTime: Math.round(driveTime)
      };
      
      setCurrentJob(updatedJob);
      setCurrentState('onsite');
      setDrivingDistance(0); // Reset for next trip
      
      const updatedJobs = jobs.map(j => j.id === updatedJob.id ? updatedJob : j);
      setJobs(updatedJobs);
      saveData(updatedJobs, null, 'onsite', updatedJob);
    }
  };

  const handleLeftSite = () => {
    if (currentJob && currentState === 'onsite') {
      const leftTime = new Date().toISOString();
      const workTime = (new Date(leftTime) - new Date(currentJob.arrivedTime)) / 1000 / 60; // minutes
      
      const updatedJob = {
        ...currentJob,
        leftTime,
        workTime: Math.round(workTime)
      };
      
      setCurrentJob(updatedJob);
      setCurrentState('left');
      
      const updatedJobs = jobs.map(j => j.id === updatedJob.id ? updatedJob : j);
      setJobs(updatedJobs);
      saveData(updatedJobs, null, 'left', updatedJob);
    }
  };

  const handleAnotherJob = (goingToAnother) => {
    if (goingToAnother) {
      setCurrentState('idle');
      setCurrentJob(null);
      saveData(null, null, 'idle', null);
      setShowJobForm(true);
    } else {
      handleConcludeDay();
    }
  };

  const handleConcludeDay = () => {
    setCurrentState('idle');
    setCurrentJob(null);
    saveData(null, null, 'idle', null);
  };

  const addExpense = async (expenseData) => {
    const newExpense = {
      ...expenseData,
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0]
    };
    
    const updatedExpenses = [...expenses, newExpense];
    setExpenses(updatedExpenses);
    await saveData(null, updatedExpenses, null, null);
    setShowExpenseForm(false);
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getDateRange = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Sunday as start
    const sunday = new Date(d.setDate(diff));
    const saturday = new Date(sunday);
    saturday.setDate(saturday.getDate() + 6);
    return { start: sunday.toISOString().split('T')[0], end: saturday.toISOString().split('T')[0] };
  };

  const getDailyJobs = (date) => {
    return jobs.filter(j => j.date === date);
  };

  const getWeeklyJobs = (date) => {
    const { start, end } = getDateRange(date);
    return jobs.filter(j => j.date >= start && j.date <= end);
  };

  const getDailyExpenses = (date) => {
    return expenses.filter(e => e.date === date);
  };

  const getWeeklyExpenses = (date) => {
    const { start, end } = getDateRange(date);
    return expenses.filter(e => e.date >= start && e.date <= end);
  };

  const calculateTotals = (jobList) => {
    return jobList.reduce((acc, job) => ({
      driveTime: acc.driveTime + (job.driveTime || 0),
      workTime: acc.workTime + (job.workTime || 0)
    }), { driveTime: 0, workTime: 0 });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Briefcase className="w-8 h-8 text-indigo-600" />
              <h1 className="text-3xl font-bold text-gray-800">Field Work Tracker</h1>
            </div>
            <button
              onClick={() => setShowReports(!showReports)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <FileText className="w-5 h-5" />
              Reports
            </button>
          </div>

          {!showReports ? (
            <>
              {/* Auto-Detect Toggle */}
              <div className="mb-4 p-3 bg-yellow-50 rounded-lg border-2 border-yellow-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-yellow-600" />
                    <span className="font-semibold text-gray-700">Auto-Detect Driving</span>
                  </div>
                  <button
                    onClick={() => {
                      setAutoDetectEnabled(!autoDetectEnabled);
                      if (!autoDetectEnabled) {
                        setDrivingDistance(0);
                        setLastPosition(null);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                      autoDetectEnabled
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                    }`}
                  >
                    {autoDetectEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                {autoDetectEnabled && locationStatus && (
                  <p className="text-sm text-gray-600 mt-2 ml-7">{locationStatus}</p>
                )}
                {autoDetectEnabled && (
                  <p className="text-xs text-gray-500 mt-2 ml-7">
                    Will auto-detect arrival when you stop after driving {'>'}15mph for {'>'}0.25 miles
                  </p>
                )}
              </div>

              {/* Current Status */}
              <div className="mb-6 p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  <span className="font-semibold text-gray-700">Current Status:</span>
                </div>
                <p className="text-lg font-bold text-indigo-700 capitalize ml-7">
                  {currentState === 'idle' && 'Ready to start'}
                  {currentState === 'heading' && `Heading to ${currentJob?.customerName || 'job'}`}
                  {currentState === 'onsite' && `On-site at ${currentJob?.customerName || 'job'}`}
                  {currentState === 'left' && 'Left site - Next action?'}
                </p>
                {currentJob && (
                  <div className="mt-3 ml-7 text-sm text-gray-600">
                    <p><strong>Customer:</strong> {currentJob.customerName}</p>
                    <p><strong>Facility:</strong> {currentJob.facility}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {currentState === 'idle' && (
                  <button
                    onClick={handleHeadedToJob}
                    className="flex items-center justify-center gap-3 p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
                  >
                    <MapPin className="w-6 h-6" />
                    Headed to Job
                  </button>
                )}

                {currentState === 'heading' && (
                  <button
                    onClick={handleArrivedOnsite}
                    className="flex items-center justify-center gap-3 p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-semibold"
                  >
                    <CheckCircle className="w-6 h-6" />
                    Arrived Onsite {autoDetectEnabled && '(Manual)'}
                  </button>
                )}

                {currentState === 'onsite' && (
                  <button
                    onClick={handleLeftSite}
                    className="flex items-center justify-center gap-3 p-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-lg font-semibold"
                  >
                    <XCircle className="w-6 h-6" />
                    Left Site
                  </button>
                )}

                {currentState === 'left' && (
                  <>
                    <button
                      onClick={() => handleAnotherJob(true)}
                      className="flex items-center justify-center gap-3 p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
                    >
                      <MapPin className="w-6 h-6" />
                      Another Job
                    </button>
                    <button
                      onClick={() => handleAnotherJob(false)}
                      className="flex items-center justify-center gap-3 p-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-lg font-semibold"
                    >
                      <CheckCircle className="w-6 h-6" />
                      Conclude Day
                    </button>
                  </>
                )}

                <button
                  onClick={() => setShowExpenseForm(true)}
                  className="flex items-center justify-center gap-3 p-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-lg font-semibold"
                >
                  <DollarSign className="w-6 h-6" />
                  Add Expense
                </button>
              </div>

              {/* Today's Jobs */}
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Today's Jobs
                </h2>
                <div className="space-y-3">
                  {getDailyJobs(new Date().toISOString().split('T')[0]).map(job => (
                    <div key={job.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-bold text-gray-800">{job.customerName}</h3>
                          <p className="text-sm text-gray-600">{job.facility}</p>
                        </div>
                        <div className="text-right text-sm">
                          <div className="font-semibold text-blue-600">Drive: {formatTime(job.driveTime || 0)}</div>
                          <div className="font-semibold text-green-600">Work: {formatTime(job.workTime || 0)}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mt-2">
                        <div>Headed: {formatDateTime(job.headedTime)}</div>
                        <div>Arrived: {formatDateTime(job.arrivedTime)}</div>
                        <div>Left: {formatDateTime(job.leftTime)}</div>
                      </div>
                    </div>
                  ))}
                  {getDailyJobs(new Date().toISOString().split('T')[0]).length === 0 && (
                    <p className="text-gray-500 text-center py-4">No jobs recorded today</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <ReportsView
              reportView={reportView}
              setReportView={setReportView}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              getDailyJobs={getDailyJobs}
              getWeeklyJobs={getWeeklyJobs}
              getDailyExpenses={getDailyExpenses}
              getWeeklyExpenses={getWeeklyExpenses}
              calculateTotals={calculateTotals}
              formatTime={formatTime}
              formatDateTime={formatDateTime}
              getDateRange={getDateRange}
            />
          )}
        </div>
      </div>

      {/* Job Form Modal */}
      {showJobForm && (
        <JobFormModal
          onClose={() => setShowJobForm(false)}
          onSubmit={startJob}
        />
      )}

      {/* Expense Form Modal */}
      {showExpenseForm && (
        <ExpenseFormModal
          onClose={() => setShowExpenseForm(false)}
          onSubmit={addExpense}
        />
      )}
    </div>
  );
}

function JobFormModal({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    customerName: '',
    contact: '',
    facility: '',
    workScope: '',
    tasksCompleted: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">New Job Details</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Customer Name *</label>
            <input
              type="text"
              required
              value={formData.customerName}
              onChange={(e) => setFormData({...formData, customerName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Contact</label>
            <input
              type="text"
              value={formData.contact}
              onChange={(e) => setFormData({...formData, contact: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Facility *</label>
            <input
              type="text"
              required
              value={formData.facility}
              onChange={(e) => setFormData({...formData, facility: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Work Scope *</label>
            <textarea
              required
              value={formData.workScope}
              onChange={(e) => setFormData({...formData, workScope: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="3"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tasks Completed</label>
            <textarea
              value={formData.tasksCompleted}
              onChange={(e) => setFormData({...formData, tasksCompleted: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="3"
              placeholder="You can update this later"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Start Job
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ExpenseFormModal({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'fuel',
    receipt: null,
    receiptName: ''
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({
          ...formData,
          receipt: reader.result,
          receiptName: file.name
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Add Expense</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Description *</label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="e.g., Gas for job site travel"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Amount *</label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="fuel">Fuel</option>
              <option value="meals">Meals</option>
              <option value="tolls">Tolls/Parking</option>
              <option value="materials">Materials</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Receipt</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            {formData.receiptName && (
              <p className="text-sm text-green-600 mt-1">✓ {formData.receiptName}</p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold"
            >
              Add Expense
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReportsView({ reportView, setReportView, selectedDate, setSelectedDate, getDailyJobs, getWeeklyJobs, getDailyExpenses, getWeeklyExpenses, calculateTotals, formatTime, formatDateTime, getDateRange }) {
  const jobs = reportView === 'daily' ? getDailyJobs(selectedDate) : getWeeklyJobs(selectedDate);
  const expenses = reportView === 'daily' ? getDailyExpenses(selectedDate) : getWeeklyExpenses(selectedDate);
  const totals = calculateTotals(jobs);
  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  const { start, end } = getDateRange(selectedDate);

  return (
    <div>
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setReportView('daily')}
          className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
            reportView === 'daily' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Daily Report
        </button>
        <button
          onClick={() => setReportView('weekly')}
          className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
            reportView === 'weekly' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Weekly Report
        </button>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {reportView === 'daily' ? 'Select Date' : 'Select Week (any day in week)'}
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        />
        {reportView === 'weekly' && (
          <p className="text-sm text-gray-600 mt-2">
            Week: {new Date(start).toLocaleDateString()} - {new Date(end).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <div className="text-sm text-blue-600 font-semibold">Total Drive Time</div>
          <div className="text-2xl font-bold text-blue-700">{formatTime(totals.driveTime)}</div>
        </div>
        <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
          <div className="text-sm text-green-600 font-semibold">Total Work Time</div>
          <div className="text-2xl font-bold text-green-700">{formatTime(totals.workTime)}</div>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
          <div className="text-sm text-purple-600 font-semibold">Total Expenses</div>
          <div className="text-2xl font-bold text-purple-700">${totalExpenses.toFixed(2)}</div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3">Jobs</h3>
        <div className="space-y-3">
          {jobs.map(job => (
            <div key={job.id} className="p-4 bg-white border border-gray-300 rounded-lg">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-gray-800">{job.customerName}</h4>
                  <p className="text-sm text-gray-600">{job.facility}</p>
                  <p className="text-xs text-gray-500 mt-1">{job.date}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-blue-600">Drive: {formatTime(job.driveTime || 0)}</div>
                  <div className="text-sm font-semibold text-green-600">Work: {formatTime(job.workTime || 0)}</div>
                </div>
              </div>
              <div className="border-t pt-2 mt-2">
                <p className="text-sm text-gray-700"><strong>Contact:</strong> {job.contact || 'N/A'}</p>
                <p className="text-sm text-gray-700"><strong>Work Scope:</strong> {job.workScope}</p>
                {job.tasksCompleted && (
                  <p className="text-sm text-gray-700"><strong>Tasks Completed:</strong> {job.tasksCompleted}</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mt-3 pt-2 border-t">
                <div>Headed: {formatDateTime(job.headedTime)}</div>
                <div>Arrived: {formatDateTime(job.arrivedTime)}</div>
                <div>Left: {formatDateTime(job.leftTime)}</div>
              </div>
            </div>
          ))}
          {jobs.length === 0 && (
            <p className="text-gray-500 text-center py-4">No jobs for this period</p>
          )}
        </div>
      </div>

      {/* Expenses List */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-3">Expenses</h3>
        <div className="space-y-3">
          {expenses.map(expense => (
            <div key={expense.id} className="p-4 bg-white border border-gray-300 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-gray-800">{expense.description}</h4>
                  <p className="text-sm text-gray-600 capitalize">{expense.category}</p>
                  <p className="text-xs text-gray-500 mt-1">{expense.date}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-purple-600">${parseFloat(expense.amount).toFixed(2)}</div>
                  {expense.receiptName && (
                    <div className="text-xs text-green-600 mt-1">✓ Receipt</div>
                  )}
                </div>
              </div>
              {expense.receipt && (
                <div className="mt-3">
                  <img src={expense.receipt} alt="Receipt" className="max-w-full h-auto max-h-48 rounded border" />
                </div>
              )}
            </div>
          ))}
          {expenses.length === 0 && (
            <p className="text-gray-500 text-center py-4">No expenses for this period</p>
          )}
        </div>
      </div>
    </div>
  );
}