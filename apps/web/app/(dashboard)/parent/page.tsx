'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getUser } from '@/lib/auth';
import api from '@/lib/api';
import { 
  Plus, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  BookOpen, 
  Loader2, 
  Printer, 
  FileText, 
  Bell, 
  Award, 
  DollarSign, 
  Calendar, 
  User, 
  GraduationCap, 
  ExternalLink,
  AlertTriangle,
  Info,
  Clock,
  Download,
  Pin
} from 'lucide-react';

// Interfaces
interface StudentItem {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  bloodGroup: string | null;
  classId: string | null;
  sectionId: string | null;
  portalPin: string | null;
  class: { id: string; name: string } | null;
  section: { id: string; name: string } | null;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';
  note: string | null;
}

interface AttendanceReport {
  summary: {
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    total: number;
    percentage: number;
  };
  records: AttendanceRecord[];
}

interface FeeBreakdownItem {
  feeCategoryId: string;
  feeCategoryName: string;
  structureAmount: number;
  frequency: string;
  paid: number;
  due: number;
}

interface FeePaymentItem {
  id: string;
  feeCategoryId: string;
  amount: number;
  paidAt: string;
  method: string;
  receiptNumber: string;
  referenceNumber: string | null;
  note: string | null;
  feeCategory: { name: string };
  collectedBy?: { firstName: string; lastName: string };
  student?: {
    firstName: string;
    lastName: string;
    admissionNumber: string;
    class: { name: string } | null;
    section: { name: string } | null;
  };
}

interface FeeAccount {
  student: StudentItem;
  academicYear: string;
  breakdown: FeeBreakdownItem[];
  payments: FeePaymentItem[];
  summary: {
    totalStructure: number;
    totalPaid: number;
    totalDue: number;
  };
}

interface ExamResultItem {
  id: string;
  marksObtained: number | null;
  grade: string | null;
  isAbsent: boolean;
  remarks: string | null;
  subject: { id: string; name: string; code: string | null };
}

interface ExamSummary {
  exam: {
    id: string;
    name: string;
    maxMarks: number;
    passingMarks: number;
    startDate: string;
  };
  results: ExamResultItem[];
  totalMarks: number;
  maxPossible: number;
  percentage: number;
  overallGrade: string | null;
}

interface ReportCard {
  student: StudentItem;
  academicYear: string;
  examSummaries: ExamSummary[];
}

interface HomeworkItem {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  class: { id: string; name: string };
  subject: { id: string; name: string } | null;
  teacher: { id: string; firstName: string; lastName: string };
}

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  type: 'ANNOUNCEMENT' | 'CIRCULAR' | 'EVENT' | 'ALERT';
  isPinned: boolean;
  publishedAt: string;
  createdBy: { firstName: string; lastName: string };
}

function ParentDashboardContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [parentName, setParentName] = useState('');
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [activeStudent, setActiveStudent] = useState<StudentItem | null>(null);
  const [activeTab, setActiveTab] = useState<'attendance' | 'fees' | 'exams' | 'homework' | 'announcements'>('attendance');

  useEffect(() => {
    if (tabParam && ['attendance', 'fees', 'exams', 'homework', 'announcements'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [tabParam]);

  // Loading States
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  // Tab Data States
  const [attendance, setAttendance] = useState<AttendanceReport | null>(null);
  const [fees, setFees] = useState<FeeAccount | null>(null);
  const [exams, setExams] = useState<ReportCard | null>(null);
  const [homeworks, setHomeworks] = useState<HomeworkItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);

  // Linking Form State
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [portalPin, setPortalPin] = useState('');
  const [submittingLink, setSubmittingLink] = useState(false);

  // Filter States
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Modal / Print Overlays
  const [selectedReceipt, setSelectedReceipt] = useState<FeePaymentItem | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [receiptDetails, setReceiptDetails] = useState<any | null>(null);

  // General Notification Banners
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load parent user details and students list
  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const u = getUser();
      if (u) setParentName(u.firstName);
      
      const { data } = await api.get('/sis/parent/students');
      setStudents(data);
      if (data.length > 0) {
        setActiveStudent(data[0]);
      } else {
        setActiveStudent(null);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch linked students.');
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Data fetching functions
  const fetchAttendance = useCallback(async (studentId: string, from: string, to: string) => {
    setLoadingData(true);
    try {
      const { data } = await api.get('/attendance/students/report', {
        params: { studentId, fromDate: from, toDate: to },
      });
      setAttendance(data);
    } catch (err) {
      console.error(err);
      setAttendance(null);
    } finally {
      setLoadingData(false);
    }
  }, []);

  const fetchFees = useCallback(async (studentId: string) => {
    setLoadingData(true);
    try {
      const { data } = await api.get(`/fees/students/${studentId}/account`);
      setFees(data);
    } catch (err) {
      console.error(err);
      setFees(null);
    } finally {
      setLoadingData(false);
    }
  }, []);

  const fetchExams = useCallback(async (studentId: string) => {
    setLoadingData(true);
    try {
      const { data } = await api.get(`/exams/report-card/${studentId}`);
      setExams(data);
    } catch (err) {
      console.error(err);
      setExams(null);
    } finally {
      setLoadingData(false);
    }
  }, []);

  const fetchHomework = useCallback(async (classId: string) => {
    setLoadingData(true);
    try {
      const { data } = await api.get('/homework', { params: { classId } });
      setHomeworks(data.items);
    } catch (err) {
      console.error(err);
      setHomeworks([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    setLoadingData(true);
    try {
      const { data } = await api.get('/communication/announcements');
      setAnnouncements(data);
    } catch (err) {
      console.error(err);
      setAnnouncements([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Handle active child/tab data reloading
  useEffect(() => {
    if (!activeStudent) return;

    if (activeTab === 'attendance') {
      fetchAttendance(activeStudent.id, fromDate, toDate);
    } else if (activeTab === 'fees') {
      fetchFees(activeStudent.id);
    } else if (activeTab === 'exams') {
      fetchExams(activeStudent.id);
    } else if (activeTab === 'homework') {
      if (activeStudent.classId) {
        fetchHomework(activeStudent.classId);
      } else {
        setHomeworks([]);
      }
    } else if (activeTab === 'announcements') {
      fetchAnnouncements();
    }
  }, [activeStudent, activeTab, fetchAttendance, fetchFees, fetchExams, fetchHomework, fetchAnnouncements, fromDate, toDate]);

  // Handle student linking
  const handleLinkStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admissionNumber.trim() || !portalPin.trim()) {
      setError('Please fill in both fields.');
      return;
    }

    setSubmittingLink(true);
    setError(null);
    setSuccess(null);

    try {
      const { data } = await api.post('/auth/link-student', {
        admissionNumber: admissionNumber.trim(),
        portalPin: portalPin.trim(),
      });
      setSuccess(data.message || 'Student linked successfully!');
      setAdmissionNumber('');
      setPortalPin('');
      setShowLinkModal(false);
      fetchStudents();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Invalid Admission Number or PIN. Please try again.');
    } finally {
      setSubmittingLink(false);
    }
  };

  // View receipt logic
  const handleViewReceipt = async (payment: FeePaymentItem) => {
    setSelectedReceipt(payment);
    setLoadingReceipt(true);
    try {
      const { data } = await api.get(`/fees/payments/${payment.id}`);
      setReceiptDetails(data);
    } catch (err) {
      console.error('Failed to load receipt details', err);
    } finally {
      setLoadingReceipt(false);
    }
  };

  // Formatting date helper
  const formatDateStr = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Color mappings
  const ATTENDANCE_BADGES = {
    PRESENT: 'bg-[#E5F6EE] text-[#1D7A4A] border-[#1D7A4A]/10',
    ABSENT: 'bg-rose-50 text-rose-700 border-rose-100',
    LATE: 'bg-amber-50 text-amber-700 border-amber-100',
    HALF_DAY: 'bg-blue-50 text-blue-700 border-blue-100',
  };

  const TYPE_BADGES = {
    ANNOUNCEMENT: 'bg-[#E5F6EE] text-[#1D7A4A] border-[#1D7A4A]/10',
    CIRCULAR: 'bg-purple-50 text-purple-700 border-purple-100',
    EVENT: 'bg-blue-50 text-blue-700 border-blue-150',
    ALERT: 'bg-rose-50 text-rose-700 border-rose-100',
  };

  if (loadingStudents) {
    return (
      <div className="py-40 text-center text-sm text-gray-400 font-body">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1D7A4A] mx-auto mb-4"></div>
        Loading Portal Workspace...
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6 font-body">
      {/* Global CSS style block for clean, print-friendly templates */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-section, #print-section * {
            visibility: visible !important;
          }
          #print-section {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 20px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-6 no-print">
        <div>
          <h1 className="font-display text-[32px] font-bold text-[#1A1D23] leading-tight">Hello, {parentName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome to your Parent Portal dashboard. Track your children's attendance, fees, academic marks, and school updates.
          </p>
        </div>

        {students.length > 0 && (
          <button
            onClick={() => setShowLinkModal(true)}
            className="px-4 py-2.5 bg-[#1D7A4A] hover:bg-[#155B37] text-white text-sm font-semibold rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            Link Another Child
          </button>
        )}
      </div>

      {/* Notifications Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-750 rounded-xl text-sm flex items-center justify-between shadow-sm animate-fadeIn">
          <span className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600" strokeWidth={1.75} />
            {error}
          </span>
          <button onClick={() => setError(null)} className="text-red-900 font-bold hover:text-red-700 text-lg leading-none">×</button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-705 rounded-xl text-sm flex items-center justify-between shadow-sm animate-fadeIn">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} />
            {success}
          </span>
          <button onClick={() => setSuccess(null)} className="text-emerald-900 font-bold hover:text-emerald-755 text-lg leading-none">×</button>
        </div>
      )}

      {/* If NO student is linked, show a premium invitation interface */}
      {students.length === 0 ? (
        <div className="max-w-md mx-auto my-16 bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden animate-fadeIn">
          <div className="bg-gradient-to-tr from-[#1D7A4A] to-[#155B37] p-8 text-center text-white relative">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20">
              <GraduationCap className="w-8 h-8 text-white" strokeWidth={1.75} />
            </div>
            <h2 className="text-xl font-bold font-display">Link Your Child's Record</h2>
            <p className="text-xs text-[#E5F6EE] mt-2 max-w-xs mx-auto">
              Please enter your child's school registration details below to activate full parental dashboards.
            </p>
          </div>

          <form onSubmit={handleLinkStudent} className="p-6 space-y-4 font-body">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5 font-display">Admission Number</label>
              <input
                type="text"
                placeholder="e.g. ADM-2026-0001"
                value={admissionNumber}
                onChange={(e) => setAdmissionNumber(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A] focus:border-transparent transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5 font-display">6-Digit Portal PIN</label>
              <input
                type="password"
                maxLength={6}
                placeholder="••••••"
                value={portalPin}
                onChange={(e) => setPortalPin(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A] focus:border-transparent tracking-widest text-center transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submittingLink}
              className="w-full py-3 bg-[#1D7A4A] hover:bg-[#155B37] text-white rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer font-display"
            >
              {submittingLink ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4" strokeWidth={1.75} />
                  Validating Credentials...
                </>
              ) : (
                'Link Student Account'
              )}
            </button>

            <p className="text-[11px] text-gray-400 text-center max-w-xs mx-auto leading-relaxed mt-2">
              Note: Contact the school administrative office if you do not have your child's Admission Number or Portal PIN.
            </p>
          </form>
        </div>
      ) : (
        /* ACTIVE PORTAL WORKSPACE */
        <div className="space-y-6">
          {/* Child Selection Bar */}
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 font-display">Linked Children</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {students.map((child) => {
                const isSelected = activeStudent?.id === child.id;
                return (
                  <button
                    key={child.id}
                    onClick={() => setActiveStudent(child)}
                    className={`flex items-center gap-4 p-4 text-left bg-white border rounded-2xl transition-all shadow-sm outline-none cursor-pointer ${
                      isSelected
                        ? 'border-[#1D7A4A] ring-2 ring-[#E5F6EE] translate-y-[-2px] shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border uppercase font-display ${
                      isSelected
                        ? 'bg-[#E5F6EE] text-[#1D7A4A] border-[#1D7A4A]/20'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}>
                      {child.firstName[0]}{child.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-905 text-sm truncate font-display">{child.firstName} {child.lastName}</h3>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">ADM: {child.admissionNumber}</p>
                      <p className={`text-[11px] font-semibold mt-1 px-1.5 py-0.5 rounded w-fit max-w-full truncate ${
                        isSelected
                          ? 'text-[#1D7A4A] bg-[#E5F6EE]'
                          : 'text-gray-505 bg-gray-100'
                      }`}>
                        {child.class?.name || 'Class Assigned'}{child.section?.name ? ` - ${child.section.name}` : ''}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Module Tab Grid */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
            {/* Horizontal Navigation Tabs */}
            <div className="flex border-b border-gray-200 overflow-x-auto divide-x divide-gray-100 scrollbar-none no-print font-display">
              {[
                { id: 'attendance', label: 'Attendance' },
                { id: 'fees', label: 'Fee Tracker' },
                { id: 'exams', label: 'Exam Results' },
                { id: 'homework', label: 'Homework' },
                { id: 'announcements', label: 'Announcements' },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-4 px-6 text-sm font-semibold tracking-wide border-b-2 transition-all outline-none text-center whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'border-[#1D7A4A] bg-[#E5F6EE]/30 text-[#1D7A4A] font-bold'
                        : 'border-transparent text-gray-500 hover:text-[#1D7A4A] hover:bg-gray-50/30'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Dashboard Panels Area */}
            <div className="p-6">
              {loadingData ? (
                <div className="py-24 text-center text-sm text-gray-400 font-body">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1D7A4A] mx-auto mb-3"></div>
                  Loading records...
                </div>
              ) : (
                <>
                  {/* TAB 1: ATTENDANCE */}
                  {activeTab === 'attendance' && (
                    <div className="space-y-6 font-body">
                      {/* Date Range Selector Filter */}
                      <div className="flex flex-col md:flex-row items-end justify-between gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-150 no-print">
                        <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 font-display">From Date</label>
                            <input
                              type="date"
                              value={fromDate}
                              onChange={(e) => setFromDate(e.target.value)}
                              className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A] bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 font-display">To Date</label>
                            <input
                              type="date"
                              value={toDate}
                              onChange={(e) => setToDate(e.target.value)}
                              className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A] bg-white"
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => activeStudent && fetchAttendance(activeStudent.id, fromDate, toDate)}
                          className="px-5 py-2.5 bg-[#1D7A4A] hover:bg-[#155B37] text-white rounded-xl text-sm font-semibold tracking-wide transition-all shadow-sm w-full md:w-auto text-center cursor-pointer font-display"
                        >
                          Apply Filter
                        </button>
                      </div>

                      {attendance ? (
                        <>
                          {/* Attendance Metrics Grid */}
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-body">
                            <div className="bg-gradient-to-tr from-[#E5F6EE]/30 to-[#E5F6EE]/70 p-5 rounded-2xl border border-[#1D7A4A]/10 text-center relative overflow-hidden shadow-sm">
                              <p className="text-[10px] font-bold text-[#1D7A4A] uppercase tracking-wider mb-1 font-display">Attendance Ratio</p>
                              <p className="text-3xl font-black text-[#1D7A4A] font-display">{attendance.summary.percentage}%</p>
                              <div className="w-1.5 h-full bg-[#1D7A4A] absolute left-0 top-0" />
                            </div>

                            <div className="bg-gradient-to-tr from-emerald-50 to-emerald-100/50 p-5 rounded-2xl border border-emerald-100 text-center relative overflow-hidden shadow-sm">
                              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1 font-display">Days Present</p>
                              <p className="text-3xl font-black text-emerald-950 font-display">{attendance.summary.present}</p>
                              <div className="w-1.5 h-full bg-emerald-500 absolute left-0 top-0" />
                            </div>

                            <div className="bg-gradient-to-tr from-rose-50 to-rose-100/50 p-5 rounded-2xl border border-rose-100 text-center relative overflow-hidden shadow-sm">
                              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-1 font-display">Days Absent</p>
                              <p className="text-3xl font-black text-rose-950 font-display">{attendance.summary.absent}</p>
                              <div className="w-1.5 h-full bg-rose-500 absolute left-0 top-0" />
                            </div>

                            <div className="bg-gradient-to-tr from-amber-50 to-amber-100/50 p-5 rounded-2xl border border-amber-100 text-center relative overflow-hidden shadow-sm">
                              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1 font-display">Late / Half Day</p>
                              <p className="text-3xl font-black text-amber-950 font-display">
                                {attendance.summary.late + attendance.summary.halfDay}
                              </p>
                              <div className="w-1.5 h-full bg-amber-500 absolute left-0 top-0" />
                            </div>
                          </div>

                          {/* Attendance Logs Table */}
                          <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="bg-gray-50 border-b border-gray-200 px-5 py-3.5">
                              <h3 className="font-semibold text-gray-800 text-sm">Attendance Timeline Logs</h3>
                            </div>
                            {attendance.records.length === 0 ? (
                              <div className="py-12 text-center text-sm text-gray-400">
                                No attendance records found for this date range.
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-sm">
                                  <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-150 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                      <th className="px-5 py-3">Date</th>
                                      <th className="px-5 py-3">Status</th>
                                      <th className="px-5 py-3">Notes / Remarks</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {attendance.records.map((r) => (
                                      <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-5 py-3.5 font-medium text-gray-700">
                                          {formatDateStr(r.date)}
                                        </td>
                                        <td className="px-5 py-3.5">
                                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ATTENDANCE_BADGES[r.status] || ''}`}>
                                            {r.status.replace('_', ' ')}
                                          </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-gray-500">
                                          {r.note || <span className="text-gray-300">—</span>}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="py-16 text-center text-sm text-gray-400">
                          Failed to load attendance summary reports.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: FEE TRACKER */}
                  {activeTab === 'fees' && (
                    <div className="space-y-8 font-body">
                      {fees ? (
                        <>
                          {/* Dues Progress Bar & Financial Overview */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Large visual progress card */}
                            <div className="md:col-span-2 bg-[#1A1D23] p-6 rounded-2xl text-white shadow-md relative overflow-hidden flex flex-col justify-between">
                              <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 font-display">Dues Clearance Progress</h3>
                                <p className="text-sm text-gray-300">
                                  You have paid <span className="font-semibold text-emerald-450">₹{fees.summary.totalPaid.toLocaleString('en-IN')}</span> out of <span className="font-semibold text-white">₹{fees.summary.totalStructure.toLocaleString('en-IN')}</span> overall structure.
                                </p>
                              </div>

                              {/* Modern Progress Bar */}
                              <div className="my-6">
                                <div className="w-full bg-slate-800 rounded-full h-3">
                                  <div
                                    className="bg-gradient-to-r from-[#1D7A4A] to-emerald-400 h-3 rounded-full transition-all"
                                    style={{
                                      width: `${
                                        fees.summary.totalStructure > 0
                                          ? Math.min(
                                              100,
                                              Math.round((fees.summary.totalPaid / fees.summary.totalStructure) * 100)
                                            )
                                          : 0
                                      }%`,
                                    }}
                                  ></div>
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-400 mt-2 font-medium">
                                  <span className="font-bold">
                                    {fees.summary.totalStructure > 0
                                      ? Math.round((fees.summary.totalPaid / fees.summary.totalStructure) * 100)
                                      : 0}
                                    % Cleared
                                  </span>
                                  <span>
                                    Remaining: ₹{fees.summary.totalDue.toLocaleString('en-IN')}
                                  </span>
                                </div>
                              </div>

                              <div className="text-[10px] text-gray-500 font-mono">
                                Current Academic Year: {fees.academicYear}
                              </div>
                            </div>

                            {/* Dues Balance Summary Boxes */}
                            <div className="space-y-4">
                              <div className="bg-[#E5F6EE] border border-[#1D7A4A]/10 rounded-2xl p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                                <p className="text-[10px] font-bold text-[#1D7A4A] uppercase tracking-wider mb-0.5 font-display">Total Dues Paid</p>
                                <p className="text-2xl font-black text-[#1D7A4A] font-display">₹{fees.summary.totalPaid.toLocaleString('en-IN')}</p>
                              </div>

                              <div className={`${fees.summary.totalDue > 0 ? 'bg-rose-50 border-rose-100' : 'bg-gray-50 border-gray-200'} border rounded-2xl p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]`}>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 font-display">Outstanding Balance</p>
                                <p className={`text-2xl font-black font-display ${fees.summary.totalDue > 0 ? 'text-rose-700' : 'text-gray-700'}`}>
                                  ₹{fees.summary.totalDue.toLocaleString('en-IN')}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Fee Structures Breakdown */}
                          <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                            <div className="bg-gray-50 border-b border-gray-200 px-5 py-3.5">
                              <h3 className="font-semibold text-gray-805 text-sm font-display">Fee Structure Breakdown</h3>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                  <tr className="bg-gray-50/50 border-b border-gray-150 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <th className="px-5 py-3">Fee Category</th>
                                    <th className="px-5 py-3">Installment Frequency</th>
                                    <th className="px-5 py-3 text-right">Structure Amount</th>
                                    <th className="px-5 py-3 text-right">Paid</th>
                                    <th className="px-5 py-3 text-right">Balance Due</th>
                                    <th className="px-5 py-3 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {fees.breakdown.map((item) => (
                                    <tr key={item.feeCategoryId} className="hover:bg-gray-50/50 transition-colors">
                                      <td className="px-5 py-3.5 font-semibold text-gray-750">{item.feeCategoryName}</td>
                                      <td className="px-5 py-3.5 text-gray-400 capitalize text-xs">{item.frequency.toLowerCase()}</td>
                                      <td className="px-5 py-3.5 text-right font-medium text-gray-900">₹{item.structureAmount.toLocaleString('en-IN')}</td>
                                      <td className="px-5 py-3.5 text-right text-emerald-600 font-medium">₹{item.paid.toLocaleString('en-IN')}</td>
                                      <td className="px-5 py-3.5 text-right text-rose-600 font-medium">₹{item.due.toLocaleString('en-IN')}</td>
                                      <td className="px-5 py-3.5 text-center">
                                        {item.due === 0 ? (
                                          <span className="inline-flex px-2 py-0.5 rounded bg-[#E5F6EE] text-[#1D7A4A] text-[10px] font-bold border border-[#1D7A4A]/10 uppercase tracking-wide">Paid</span>
                                        ) : item.paid > 0 ? (
                                          <span className="inline-flex px-2 py-0.5 rounded bg-amber-50 text-amber-750 text-[10px] font-bold border border-amber-100 uppercase tracking-wide">Partial</span>
                                        ) : (
                                          <span className="inline-flex px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-100 uppercase tracking-wide">Unpaid</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Fee Payments History Logs */}
                          <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                            <div className="bg-gray-50 border-b border-gray-200 px-5 py-3.5 flex items-center justify-between">
                              <h3 className="font-semibold text-gray-805 text-sm font-display">Payment Transaction History</h3>
                              <span className="text-xs bg-[#E5F6EE] text-[#1D7A4A] border border-[#1D7A4A]/10 px-2 py-0.5 rounded font-semibold font-display">
                                {fees.payments.length} paid transactions
                              </span>
                            </div>

                            {fees.payments.length === 0 ? (
                              <div className="py-12 text-center text-sm text-gray-400">
                                No fee payments recorded for this academic year yet.
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-sm">
                                  <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-150 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                      <th className="px-5 py-3">Receipt No</th>
                                      <th className="px-5 py-3">Date</th>
                                      <th className="px-5 py-3">Fee Category</th>
                                      <th className="px-5 py-3">Method</th>
                                      <th className="px-5 py-3 text-right">Amount Paid</th>
                                      <th className="px-5 py-3 text-right">Receipt Details</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 font-body">
                                    {fees.payments.map((p) => (
                                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-5 py-3.5 font-bold text-[#1D7A4A] font-display">{p.receiptNumber}</td>
                                        <td className="px-5 py-3.5 text-gray-400 text-xs">{formatDateStr(p.paidAt)}</td>
                                        <td className="px-5 py-3.5 font-semibold text-gray-700">{p.feeCategory.name}</td>
                                        <td className="px-5 py-3.5 text-gray-450 uppercase text-xs font-semibold font-mono">{p.method}</td>
                                        <td className="px-5 py-3.5 text-right font-black text-gray-900 font-display">₹{p.amount.toLocaleString('en-IN')}</td>
                                        <td className="px-5 py-3.5 text-right">
                                          <button
                                            onClick={() => handleViewReceipt(p)}
                                            className="px-3.5 py-1.5 bg-white hover:bg-[#E5F6EE] border border-[#1D7A4A]/25 hover:border-[#1D7A4A]/50 text-xs font-bold text-[#1D7A4A] hover:text-[#155B37] rounded-lg transition-all cursor-pointer font-display"
                                          >
                                            View Receipt
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="py-16 text-center text-sm text-gray-400">
                          Failed to load student fee accounts.
                        </div>
                      )}
                    </div>
                  )}
                                 {/* TAB 3: EXAM RESULTS */}
                  {activeTab === 'exams' && (
                    <div className="space-y-8 font-body">
                      {exams ? (
                        <>
                          {exams.examSummaries.length === 0 ? (
                            <div className="py-20 text-center border border-dashed border-gray-250 rounded-2xl bg-gray-50">
                              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.75} />
                              <p className="text-sm font-semibold text-gray-700 font-display">No Exams Completed Yet</p>
                              <p className="text-xs text-gray-405 max-w-xs mx-auto mt-1">
                                Report cards will automatically populate here as classes wrap up scheduled examinations.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-12">
                              {exams.examSummaries.map((summary) => (
                                <div key={summary.exam.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden relative group">
                                  {/* Report Card Header block */}
                                  <div className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 px-6 py-4.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div>
                                      <h3 className="font-bold text-gray-900 text-lg uppercase tracking-wide font-display">{summary.exam.name}</h3>
                                      <p className="text-xs text-gray-400 mt-1">
                                        Term Start: {formatDateStr(summary.exam.startDate)} • Passing limit: {summary.exam.passingMarks}%
                                      </p>
                                    </div>

                                    {/* Action button to print this single report card */}
                                    <button
                                      onClick={() => {
                                        const originalSec = document.getElementById('print-section');
                                        if (originalSec) originalSec.id = '';
                                        const card = document.getElementById(`report-card-${summary.exam.id}`);
                                        if (card) {
                                          card.id = 'print-section';
                                          window.print();
                                          // restore ID to prevent duplicates
                                          setTimeout(() => {
                                            card.id = `report-card-${summary.exam.id}`;
                                            if (originalSec) originalSec.id = 'print-section';
                                          }, 500);
                                        }
                                      }}
                                      className="px-4 py-2 border border-[#1D7A4A]/25 hover:bg-[#E5F6EE]/50 text-xs font-bold text-[#1D7A4A] rounded-xl transition-all shadow-sm flex items-center gap-1.5 self-start no-print cursor-pointer font-display"
                                    >
                                      <Printer className="w-3.5 h-3.5" strokeWidth={2} />
                                      Print Report Card
                                    </button>
                                  </div>

                                  {/* RENDERABLE PRINT SECTION TEMPLATE */}
                                  <div id={`report-card-${summary.exam.id}`} className="p-6 space-y-6 bg-white">
                                    {/* Official Header (Visible on print only) */}
                                    <div className="hidden print:block text-center border-b-2 border-gray-900 pb-4 mb-4 font-display">
                                      <h2 className="text-xl font-black uppercase text-gray-900 tracking-wider">Official Academic Record</h2>
                                      <p className="text-sm font-semibold text-gray-600 mt-1">AIPSA Multi-Tenant School ERP Systems</p>
                                      
                                      <div className="grid grid-cols-2 text-left text-xs text-gray-700 mt-4 border border-gray-300 p-3 rounded">
                                        <p><span className="font-bold">Student:</span> {activeStudent?.firstName} {activeStudent?.lastName}</p>
                                        <p><span className="font-bold">Adm No:</span> {activeStudent?.admissionNumber}</p>
                                        <p><span className="font-bold">Class:</span> {activeStudent?.class?.name} {activeStudent?.section?.name ? `(${activeStudent.section.name})` : ''}</p>
                                        <p><span className="font-bold">Academic Year:</span> {exams.academicYear}</p>
                                      </div>
                                    </div>

                                    {/* Subject Splits Table */}
                                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                                      <table className="w-full text-left border-collapse text-sm">
                                        <thead>
                                          <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            <th className="px-5 py-3">Subject Name</th>
                                            <th className="px-5 py-3 text-right">Max Marks</th>
                                            <th className="px-5 py-3 text-right">Marks Obtained</th>
                                            <th className="px-5 py-3 text-center">Grade</th>
                                            <th className="px-5 py-3">Teacher Remarks</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-150 font-body">
                                          {summary.results.map((r) => (
                                            <tr key={r.id} className="hover:bg-gray-50/20 transition-colors">
                                              <td className="px-5 py-3.5 font-semibold text-gray-800">
                                                {r.subject.name} {r.subject.code ? `(${r.subject.code})` : ''}
                                              </td>
                                              <td className="px-5 py-3.5 text-right font-medium text-gray-500">
                                                {summary.exam.maxMarks}
                                              </td>
                                              <td className="px-5 py-3.5 text-right font-black">
                                                {r.isAbsent ? (
                                                  <span className="text-red-500">ABS</span>
                                                ) : r.marksObtained !== null ? (
                                                  <span className={r.marksObtained >= (summary.exam.passingMarks / 100 * summary.exam.maxMarks) ? 'text-gray-900' : 'text-red-655'}>
                                                    {r.marksObtained}
                                                  </span>
                                                ) : (
                                                  <span className="text-gray-305">—</span>
                                                )}
                                              </td>
                                              <td className="px-5 py-3.5 text-center">
                                                <span className={`px-2.5 py-0.5 rounded font-black text-xs border ${
                                                  r.grade === 'F' || r.isAbsent 
                                                    ? 'bg-rose-50 text-rose-700 border-rose-100' 
                                                    : 'bg-[#E5F6EE] text-[#1D7A4A] border-[#1D7A4A]/10'
                                                }`}>
                                                  {r.isAbsent ? 'F' : r.grade || '—'}
                                                </span>
                                              </td>
                                              <td className="px-5 py-3.5 text-gray-505 text-xs italic">
                                                {r.remarks || <span className="text-gray-300">—</span>}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>

                                    {/* Consolidated Report Summary Block */}
                                    <div className="flex flex-col md:flex-row items-stretch justify-between gap-4 p-5 bg-[#E5F6EE]/40 rounded-xl border border-[#1D7A4A]/10">
                                      <div className="space-y-1.5 font-body">
                                        <p className="text-xs font-bold text-[#1D7A4A] uppercase tracking-widest font-display">Academic Summary Profile</p>
                                        <p className="text-sm text-gray-700">
                                          Cumulative scores sum: <span className="font-extrabold text-[#1D7A4A]">{summary.totalMarks}</span> marks obtained out of a maximum <span className="font-semibold text-gray-800">{summary.maxPossible}</span>.
                                        </p>
                                      </div>

                                      <div className="flex items-center gap-6 shrink-0 md:border-l md:border-[#1D7A4A]/20 md:pl-6">
                                        <div className="text-center font-display">
                                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Overall Grade</p>
                                          <p className="text-2xl font-black text-[#1D7A4A] mt-0.5">{summary.overallGrade || '—'}</p>
                                        </div>
                                        <div className="text-center font-display">
                                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Percentage</p>
                                          <p className="text-2xl font-black text-[#1D7A4A] mt-0.5">{summary.percentage}%</p>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Official Signature Lines (Print Only) */}
                                    <div className="hidden print:grid grid-cols-2 gap-12 mt-16 pt-12 border-t border-dashed border-gray-400 text-xs text-center font-display">
                                      <div>
                                        <div className="h-10 border-b border-gray-400 max-w-[200px] mx-auto"></div>
                                        <p className="font-bold text-gray-700 mt-2">Class Teacher Signature</p>
                                      </div>
                                      <div>
                                        <div className="h-10 border-b border-gray-400 max-w-[200px] mx-auto"></div>
                                        <p className="font-bold text-gray-700 mt-2">Principal Signature & Stamp</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="py-16 text-center text-sm text-gray-400">
                          Failed to load exam report cards.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: HOMEWORK FEED */}
                  {activeTab === 'homework' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between no-print">
                        <h3 className="font-semibold text-gray-800 text-sm font-display">Homework Tasks Feed</h3>
                        <span className="text-xs bg-[#E5F6EE] text-[#1D7A4A] border border-[#1D7A4A]/20 px-2.5 py-0.5 rounded-full font-bold font-display">
                          {homeworks.length} assignments
                        </span>
                      </div>

                      {homeworks.length === 0 ? (
                        <div className="py-20 text-center border-2 border-dashed border-[#1D7A4A]/15 rounded-2xl bg-gray-50/30">
                          <BookOpen className="w-12 h-12 text-[#1D7A4A]/50 mx-auto mb-3" strokeWidth={1.75} />
                          <p className="text-sm font-semibold text-gray-700 font-display">All Homework Completed!</p>
                          <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1">
                            Any new daily class assignments will show up right here. Keep up the good work!
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {homeworks.map((hw) => {
                            // Check if due date is approaching (within 48 hours)
                            const isApproaching = hw.dueDate
                              ? (new Date(hw.dueDate).getTime() - new Date().getTime()) < (48 * 60 * 60 * 1000)
                              : false;

                            return (
                              <div
                                key={hw.id}
                                className="bg-white border border-gray-200 hover:border-[#1D7A4A]/30 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-3">
                                    <h4 className="font-bold text-gray-900 text-base leading-snug font-display">{hw.title}</h4>
                                    {hw.subject && (
                                      <span className="px-2.5 py-0.5 bg-[#E5F6EE] border border-[#1D7A4A]/15 text-[#1D7A4A] rounded-md text-[10px] font-extrabold shrink-0 uppercase tracking-wider font-display">
                                        {hw.subject.name}
                                      </span>
                                    )}
                                  </div>

                                  {hw.description && (
                                    <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed mt-2.5 line-clamp-4 font-body">
                                      {hw.description}
                                    </p>
                                  )}
                                </div>

                                <div className="mt-5 pt-3.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                                  <div className="flex items-center gap-1.5 font-body">
                                    <span className="text-gray-400">Due:</span>
                                    {hw.dueDate ? (
                                      <span className={`font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 font-display ${
                                        isApproaching
                                          ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                      }`}>
                                        <Clock className="w-3 h-3" strokeWidth={2} />
                                        {formatDateStr(hw.dueDate)}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">—</span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3">
                                    {hw.attachmentUrl && (
                                      <a
                                        href={hw.attachmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#1D7A4A] hover:text-[#155B37] hover:underline font-bold inline-flex items-center gap-1 shrink-0 font-display transition-colors"
                                      >
                                        <Download className="w-3.5 h-3.5" strokeWidth={2} />
                                        Attachment
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 5: ANNOUNCEMENTS */}
                  {activeTab === 'announcements' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between no-print">
                        <h3 className="font-semibold text-gray-800 text-sm font-display">School Bulletin Announcements</h3>
                      </div>

                      {announcements.length === 0 ? (
                        <div className="py-20 text-center border-2 border-dashed border-[#1D7A4A]/15 rounded-2xl bg-gray-50/30">
                          <Bell className="w-12 h-12 text-[#1D7A4A]/50 mx-auto mb-3" strokeWidth={1.75} />
                          <p className="text-sm font-semibold text-gray-700 font-display">All Quiet on Board</p>
                          <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1">
                            No notifications have been broadcast recently. School announcements will post here.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          {announcements.map((ann) => (
                            <div
                              key={ann.id}
                              className={`bg-white border rounded-2xl p-5 hover:shadow-sm transition-all relative ${
                                ann.isPinned ? 'border-amber-300 bg-amber-50/20 shadow-sm' : 'border-gray-200 hover:border-[#1D7A4A]/30'
                              }`}
                            >
                              {ann.isPinned && (
                                <span className="absolute top-0 right-6 transform translate-y-[-50%] bg-amber-400 text-amber-950 border border-amber-300 font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1 font-display">
                                  <Pin className="w-2.5 h-2.5" strokeWidth={2} />
                                  Pinned Circular
                                </span>
                              )}

                              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                                <div>
                                  <h4 className="font-extrabold text-gray-900 text-base leading-snug font-display">{ann.title}</h4>
                                  <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1 font-body">
                                    <Calendar className="w-3 h-3 text-gray-400" strokeWidth={2} />
                                    Posted on {formatDateStr(ann.publishedAt)} by Admin
                                  </p>
                                </div>
                                <span className={`inline-flex px-2 py-0.5 text-[9px] font-extrabold tracking-wider rounded border uppercase font-display ${TYPE_BADGES[ann.type] || ''}`}>
                                  {ann.type}
                                </span>
                              </div>

                              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap font-body">
                                {ann.body}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: LINK STUDENT (Only triggered manually when students exist) */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn no-print">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden max-w-md w-full animate-scaleUp">
            <div className="bg-gradient-to-tr from-[#1D7A4A] to-[#155B37] p-6 text-center text-white relative">
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setError(null);
                }}
                className="absolute top-4 right-4 text-white hover:text-[#E5F6EE] transition-colors outline-none cursor-pointer"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
              <h3 className="text-lg font-bold font-display">Link Another Student</h3>
              <p className="text-xs text-[#E5F6EE] mt-1 max-w-xs mx-auto font-body">
                Add siblings or additional child student accounts under your parental login profile.
              </p>
            </div>

            <form onSubmit={handleLinkStudent} className="p-6 space-y-4 font-body">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5 font-display">Admission Number</label>
                <input
                  type="text"
                  placeholder="e.g. ADM-2026-0001"
                  value={admissionNumber}
                  onChange={(e) => setAdmissionNumber(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A] focus:border-transparent transition-all font-body bg-gray-50/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5 font-display">6-Digit Portal PIN</label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="••••••"
                  value={portalPin}
                  onChange={(e) => setPortalPin(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A] focus:border-transparent tracking-widest text-center transition-all font-body bg-gray-50/50"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submittingLink}
                className="w-full py-3 bg-[#1D7A4A] hover:bg-[#155B37] text-white rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer font-display"
              >
                {submittingLink ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 text-white" strokeWidth={2} />
                    Validating...
                  </>
                ) : (
                  'Confirm & Link sibling'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* POPUP OVERLAY: PRINTABLE OFFICIAL FEE RECEIPT */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden max-w-2xl w-full my-8 animate-scaleUp no-print">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800">
              <h3 className="font-bold text-sm tracking-wider uppercase font-display">Official Payment Voucher</h3>
              <button
                onClick={() => {
                  setSelectedReceipt(null);
                  setReceiptDetails(null);
                }}
                className="text-slate-400 hover:text-white transition-colors outline-none cursor-pointer"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            {loadingReceipt ? (
              <div className="py-24 text-center text-sm text-gray-400 font-body">
                <Loader2 className="animate-spin h-6 w-6 text-slate-700 mx-auto mb-2" strokeWidth={1.75} />
                Retrieving voucher...
              </div>
            ) : receiptDetails ? (
              <div className="p-6 space-y-6 font-body">
                {/* RENDERABLE RECEIPT CONTAINER FOR DYNAMIC HIDE-PRINT SHEET */}
                <div id="print-section" className="bg-white border border-gray-150 rounded-2xl p-6 space-y-6 text-sm text-gray-800 relative overflow-hidden">
                  {/* Watermark badge (Visible only on screen or beautifully printed) */}
                  <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[#1D7A4A]/5 font-black text-7xl tracking-widest uppercase border-4 border-[#1D7A4A]/10 p-4 select-none pointer-events-none rotate-12 z-0">
                    PAID
                  </span>

                  <div className="relative z-10 space-y-6">
                    {/* Voucher Header with logo place */}
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4 border-b border-gray-100 pb-4">
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-wide uppercase font-display">Fee Payment Receipt</h2>
                        <p className="text-xs text-gray-400 mt-0.5 font-display">
                          School Voucher • {receiptDetails.tenant.name}
                        </p>
                      </div>

                      <div className="text-left sm:text-right text-xs font-display">
                        <p className="font-bold text-slate-800">Receipt No: {receiptDetails.receiptNumber}</p>
                        <p className="text-gray-500 mt-0.5 font-body">Date: {formatDateStr(receiptDetails.paidAt)}</p>
                      </div>
                    </div>

                    {/* School Profile details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-gray-50 border border-gray-150 rounded-xl p-4">
                      <div>
                        <p className="font-bold text-gray-400 uppercase tracking-wider font-display">Institution Profile</p>
                        <h4 className="font-bold text-gray-800 text-sm mt-1 font-display">{receiptDetails.tenant.name}</h4>
                        <p className="text-gray-500 mt-0.5 leading-relaxed font-body">{receiptDetails.tenant.profile?.address || 'School Campus'}</p>
                        {receiptDetails.tenant.profile?.phone && <p className="text-gray-500 mt-0.5 font-body">Tel: {receiptDetails.tenant.profile.phone}</p>}
                      </div>

                      <div>
                        <p className="font-bold text-gray-400 uppercase tracking-wider font-display">Student Candidate</p>
                        <h4 className="font-bold text-gray-800 text-sm mt-1 font-display">
                          {receiptDetails.student.firstName} {receiptDetails.student.lastName}
                        </h4>
                        <p className="text-gray-500 mt-0.5 font-body">Adm No: {receiptDetails.student.admissionNumber}</p>
                        <p className="text-gray-500 mt-0.5 font-body">
                          Grade Enrolled: {receiptDetails.student.class?.name || 'Class Assigned'} {receiptDetails.student.section?.name ? `(${receiptDetails.student.section.name})` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Transaction breakdown details */}
                    <div className="border border-gray-150 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-150 text-xs font-bold text-gray-500 uppercase tracking-wider font-display">
                            <th className="px-4 py-2.5">Category description</th>
                            <th className="px-4 py-2.5">Method</th>
                            <th className="px-4 py-2.5">Reference No</th>
                            <th className="px-4 py-2.5 text-right font-display">Amount paid</th>
                          </tr>
                        </thead>
                        <tbody className="font-body text-xs text-gray-700">
                          <tr className="border-b border-gray-100">
                            <td className="px-4 py-3.5 font-semibold text-gray-800">{receiptDetails.feeCategory.name}</td>
                            <td className="px-4 py-3.5 text-gray-500 uppercase font-semibold">{receiptDetails.method}</td>
                            <td className="px-4 py-3.5 text-gray-500">{receiptDetails.referenceNumber || <span className="text-gray-300">—</span>}</td>
                            <td className="px-4 py-3.5 text-right font-bold text-gray-900">₹{receiptDetails.amount.toLocaleString('en-IN')}</td>
                          </tr>
                          <tr className="bg-[#E5F6EE]/40 font-bold border-t border-gray-200">
                            <td colSpan={3} className="px-4 py-3 text-[#1D7A4A] font-bold uppercase tracking-wider font-display">Net Paid Amount</td>
                            <td className="px-4 py-3 text-right text-[#1D7A4A] text-sm font-black font-display">₹{receiptDetails.amount.toLocaleString('en-IN')}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Note if any */}
                    {receiptDetails.note && (
                      <div className="text-xs bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                        <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1 font-display">Receipt Note</span>
                        <p className="text-slate-600 leading-relaxed italic font-body">"{receiptDetails.note}"</p>
                      </div>
                    )}

                    {/* Official Signatures */}
                    <div className="grid grid-cols-2 gap-8 text-xs text-center pt-16">
                      <div>
                        <div className="h-9 border-b border-gray-200 max-w-[150px] mx-auto"></div>
                        <p className="text-[10px] text-gray-400 mt-1.5 font-body">Collected By: {receiptDetails.collectedBy?.firstName} {receiptDetails.collectedBy?.lastName}</p>
                      </div>

                      <div>
                        <div className="h-9 border-b border-gray-300 max-w-[150px] mx-auto"></div>
                        <p className="text-[10px] font-bold text-gray-500 mt-1.5 font-display">Official Accounts Signature</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Print button at the bottom of the card preview modal */}
                <div className="flex justify-end gap-3 pt-2 font-display">
                  <button
                    onClick={() => {
                      setSelectedReceipt(null);
                      setReceiptDetails(null);
                    }}
                    className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 rounded-xl transition-all cursor-pointer"
                  >
                    Close Preview
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-5 py-2 bg-[#1D7A4A] hover:bg-[#155B37] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" strokeWidth={1.75} />
                    Print Payment Receipt
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-gray-400 font-body">
                Failed to load transaction voucher.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ParentDashboard() {
  return (
    <Suspense fallback={
      <div className="py-40 text-center text-sm text-gray-400 font-body">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1D7A4A] mx-auto mb-4"></div>
        Loading Portal Workspace...
      </div>
    }>
      <ParentDashboardContent />
    </Suspense>
  );
}
