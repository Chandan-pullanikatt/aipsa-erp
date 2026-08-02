'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getUser } from '@/lib/auth';
import api from '@/lib/api';
import { printElement } from '@/lib/print';
import ProgressCard, { type CardData } from '@/components/ProgressCard';
import ReportLetterhead from '@/components/ReportLetterhead';
import SubjectScoreChart from '@/components/SubjectScoreChart';
import ReportPhoto from '@/components/ReportPhoto';
import AttachmentUploader, { type Attachment } from '@/components/AttachmentUploader';
import AttachmentList from '@/components/AttachmentList';
import {
  Calendar,
  Clock,
  AlertCircle,
  FileText,
  CheckCircle,
  CreditCard,
  BookOpen,
  Bell,
  Printer,
  User,
  Award,
  Pin,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Info,
  Send,
  X,
  Loader2,
  CheckCircle2,
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
  photoUrl: string | null;
  classId: string | null;
  sectionId: string | null;
  feeAccessOverride: boolean;
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
  structureId: string;
  feeCategoryId: string;
  feeCategoryName: string;
  structureAmount: number;
  frequency: string;
  dueDate: string | null;
  paid: number;
  due: number;
  daysOverdue: number;
  lateFeeApplicable: boolean;
  lateFeeWaived: boolean;
  lateFee: number;
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
  lateFeePolicy: { lateFeeAmount: number; lateFeeGraceDays: number };
  summary: {
    totalStructure: number;
    totalPaid: number;
    totalDue: number;
    totalLateFee: number;
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
  attachments: Attachment[] | null;
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

function StudentPortalContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [student, setStudent] = useState<StudentItem | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'fees' | 'exams' | 'cca' | 'homework' | 'announcements'>('overview');
  const [ccaCard, setCcaCard] = useState<CardData | null>(null);

  // Loading States
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  // Tab Data States
  const [attendance, setAttendance] = useState<AttendanceReport | null>(null);
  const [fees, setFees] = useState<FeeAccount | null>(null);
  const [exams, setExams] = useState<ReportCard | null>(null);
  const [homeworks, setHomeworks] = useState<HomeworkItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);

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

  // Homework submission modal
  const [submitHwItem, setSubmitHwItem] = useState<HomeworkItem | null>(null);
  const [submitNote, setSubmitNote] = useState('');
  const [submitUrl, setSubmitUrl] = useState('');
  const [submitFiles, setSubmitFiles] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());

  // General Notification Banners
  const [error, setError] = useState<string | null>(null);

  // Fetch Student Profile
  useEffect(() => {
    async function loadProfile() {
      try {
        const { data } = await api.get('/sis/student/profile');
        setStudent(data);
        // Eagerly fetch fees so isFeeLocked is accurate from the start
        api.get(`/fees/students/${data.id}/account`)
          .then((r) => setFees(r.data))
          .catch(console.error);
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.error || 'No student profile linked to your user account.');
      } finally {
        setLoadingProfile(false);
      }
    }
    loadProfile();
  }, []);

  // Update active tab based on query param
  useEffect(() => {
    if (tabParam && ['overview', 'attendance', 'fees', 'exams', 'cca', 'homework', 'announcements'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [tabParam]);

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

  const fetchCca = useCallback(async (studentId: string) => {
    setLoadingData(true);
    try {
      const { data } = await api.get(`/progress/card/${studentId}`);
      setCcaCard(data);
    } catch (err) {
      console.error(err);
      setCcaCard(null);
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
      setAnnouncements(data.items || []);
    } catch (err) {
      console.error(err);
      setAnnouncements([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Fetch all overview data
  const fetchOverviewData = useCallback(async (studentId: string, classId: string | null) => {
    setLoadingData(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      const fromStr = from.toISOString().split('T')[0];
      const toStr = new Date().toISOString().split('T')[0];

      const [attRes, feeRes, hwRes, annRes] = await Promise.allSettled([
        api.get('/attendance/students/report', { params: { studentId, fromDate: fromStr, toDate: toStr } }),
        api.get(`/fees/students/${studentId}/account`),
        classId ? api.get('/homework', { params: { classId } }) : Promise.reject('No class'),
        api.get('/communication/announcements'),
      ]);

      if (attRes.status === 'fulfilled') setAttendance(attRes.value.data);
      if (feeRes.status === 'fulfilled') setFees(feeRes.value.data);
      if (hwRes.status === 'fulfilled') setHomeworks(hwRes.value.data.items);
      if (annRes.status === 'fulfilled') setAnnouncements(annRes.value.data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Sync data fetch on tab changes
  useEffect(() => {
    if (!student) return;

    if (activeTab === 'overview') {
      fetchOverviewData(student.id, student.classId);
    } else if (activeTab === 'attendance') {
      fetchAttendance(student.id, fromDate, toDate);
    } else if (activeTab === 'fees') {
      fetchFees(student.id);
    } else if (activeTab === 'exams') {
      fetchExams(student.id);
    } else if (activeTab === 'cca') {
      fetchCca(student.id);
    } else if (activeTab === 'homework') {
      if (student.classId) {
        fetchHomework(student.classId);
      } else {
        setHomeworks([]);
      }
    } else if (activeTab === 'announcements') {
      fetchAnnouncements();
    }
  }, [student, activeTab, fetchOverviewData, fetchAttendance, fetchFees, fetchExams, fetchCca, fetchHomework, fetchAnnouncements, fromDate, toDate]);

  // View Receipt Handler
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

  const handleSubmitHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitHwItem) return;
    setSubmitting(true);
    try {
      await api.post(`/homework/${submitHwItem.id}/submit`, {
        note: submitNote.trim() || undefined,
        attachmentUrl: submitUrl.trim() || undefined,
        attachments: submitFiles,
      });
      setSubmittedIds(prev => new Set([...prev, submitHwItem.id]));
      setSubmitHwItem(null);
      setSubmitNote('');
      setSubmitUrl('');
      setSubmitFiles([]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit homework.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateStr = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Block attendance + exams tabs when there are outstanding dues and no admin override
  const isFeeLocked =
    student?.feeAccessOverride !== true &&
    fees !== null &&
    fees.summary.totalDue > 0;

  const DuesWall = () => (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center border border-[#FCA5A5]/40 bg-[#FEF2F2] rounded-xl">
      <div className="w-14 h-14 rounded-full bg-[#FEF2F2] border-2 border-[#FCA5A5]/50 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7 text-[#DC2626]" strokeWidth={1.75} />
      </div>
      <h3 className="font-bold text-[#DC2626] text-base font-display mb-1">Access Restricted</h3>
      <p className="text-sm text-[#6B7280] font-body max-w-sm leading-relaxed">
        Your account has outstanding dues of{' '}
        <span className="font-bold text-[#DC2626]">₹{fees!.summary.totalDue.toLocaleString('en-IN')}</span>.
        Please clear your fees to access this section.
      </p>
      <p className="text-xs text-[#9CA3AF] font-body mt-3">
        Contact your school administrator if you need temporary access.
      </p>
      <button
        onClick={() => setActiveTab('fees')}
        className="mt-5 px-5 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold rounded-lg transition-all shadow-sm font-display"
      >
        View Fee Details
      </button>
    </div>
  );

  const ATTENDANCE_BADGES = {
    PRESENT: 'bg-[#E5F6EE] text-[#1D7A4A] border-[#1D7A4A]/10',
    ABSENT: 'bg-rose-50 text-rose-700 border-rose-100',
    LATE: 'bg-amber-50 text-amber-700 border-amber-100',
    HALF_DAY: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  };

  const TYPE_BADGES = {
    ANNOUNCEMENT: 'bg-[#E5F6EE] text-[#1D7A4A] border-[#1D7A4A]/10',
    CIRCULAR: 'bg-purple-50 text-purple-700 border-purple-100',
    EVENT: 'bg-blue-50 text-blue-705 border-blue-150',
    ALERT: 'bg-rose-50 text-rose-700 border-rose-100',
  };

  if (loadingProfile) {
    return (
      <div className="py-40 text-center text-sm text-gray-400 font-body">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1D7A4A] mx-auto mb-4"></div>
        Loading Student Portal Workspace...
      </div>
    );
  }

  // Account not linked UI
  if (!student || error) {
    return (
      <div className="max-w-md mx-auto my-20 bg-white rounded-xl border border-[#E5E7EB] shadow-lg overflow-hidden font-body animate-fadeIn">
        <div className="bg-[#1D7A4A] p-8 text-center text-white relative">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20">
            <AlertTriangle className="w-8 h-8 text-white" strokeWidth={1.75} />
          </div>
          <h2 className="text-xl font-bold font-display">Portal Setup Required</h2>
          <p className="text-xs text-[#E5F6EE] mt-2 max-w-xs mx-auto">
            Your login account is currently not mapped to a registered student profile in our system.
          </p>
        </div>
        <div className="p-6 text-center space-y-4">
          <p className="text-sm text-gray-650 leading-relaxed">
            Please ask your School Administrator or Registrar to link your user account to your student profile.
          </p>
          <div className="bg-gray-50 rounded-xl p-3 text-left text-xs font-mono border border-gray-200 text-gray-500 select-all">
            Email: {getUser()?.email} <br />
            User ID: {getUser()?.id}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* Welcome Banner Panel */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-gray-100 pb-6 no-print">
        <div className="space-y-1">
          <h1 className="font-display text-[32px] font-bold text-[#1A1D23] leading-tight">Hello, {student.firstName}!</h1>
          <p className="text-sm text-gray-550 font-body">
            Welcome to your student workspace. Here is a live summary of your active class records.
          </p>
        </div>

        <div className="bg-white border border-[#E5E7EB] px-5 py-3 rounded-xl flex items-center gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="w-10 h-10 rounded-lg bg-[#E5F6EE] border border-[#1D7A4A]/10 flex items-center justify-center text-[#1D7A4A] font-bold shrink-0 font-display">
            {student.firstName[0]}
          </div>
          <div className="font-body">
            <h4 className="font-semibold text-[#1A1D23] text-sm leading-snug">{student.firstName} {student.lastName}</h4>
            <p className="text-xs text-gray-400 mt-0.5">{student.class?.name || 'Unassigned'} • {student.admissionNumber}</p>
          </div>
        </div>
      </div>

      {/* Tabs list navigation */}
      <div className="flex overflow-x-auto gap-1 border-b border-[#E5E7EB] pb-px scrollbar-none no-print font-display">
        {(['overview', 'attendance', 'fees', 'exams', 'cca', 'homework', 'announcements'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 border-b-2 font-semibold text-xs tracking-wider uppercase transition-all shrink-0 cursor-pointer ${
              activeTab === tab
                ? 'border-[#1D7A4A] text-[#1D7A4A] font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-805 hover:border-gray-300'
            }`}
          >
            {tab === 'exams' ? 'Exams & Grades' : tab === 'cca' ? 'CCA' : tab}
          </button>
        ))}
      </div>

      {/* Main Tabs Container */}
      <div className="relative min-h-[300px]">
        {loadingData && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl no-print">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1D7A4A]"></div>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fadeIn no-print">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Attendance quick ring */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 flex items-center gap-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-sm transition-shadow font-body">
                <div className="relative w-20 h-20 shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path className="text-gray-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path
                      className={attendance?.summary?.percentage && attendance.summary.percentage >= 75 ? 'text-[#1D7A4A]' : 'text-amber-500'}
                      strokeWidth="3.5"
                      strokeDasharray={`${attendance?.summary?.percentage || 0}, 100`}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-[#1A1D23] text-sm font-display">
                    {attendance?.summary?.percentage !== undefined ? `${Math.round(attendance.summary.percentage)}%` : '—'}
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-[#1A1D23] text-base font-display">Monthly Attendance</h3>
                  <p className="text-xs text-gray-400">
                    {attendance?.summary?.present || 0} Present / {attendance?.summary?.total || 0} Total days
                  </p>
                </div>
              </div>

              {/* Outstanding fees quick card */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 flex items-center gap-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-sm transition-shadow font-body">
                <div className="w-14 h-14 rounded-lg bg-[#FFF8E6] border border-[#FFE2A3] flex items-center justify-center shrink-0 text-[#B25E00]">
                  <CreditCard className="w-6 h-6" strokeWidth={1.75} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-[#1A1D23] text-base font-display">Outstanding Fee</h3>
                  <p className="text-xs text-gray-450">₹{(fees?.summary?.totalDue || 0).toLocaleString('en-IN')} outstanding</p>
                  {(fees?.summary?.totalLateFee ?? 0) > 0 && (
                    <p className="text-[10px] text-[#854F0B] font-bold mt-0.5">+₹{fees!.summary.totalLateFee.toLocaleString('en-IN')} late fee</p>
                  )}
                </div>
              </div>

              {/* Homework quick task status */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 flex items-center gap-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-sm transition-shadow font-body">
                <div className="w-14 h-14 rounded-lg bg-[#E5F6EE] border border-[#1D7A4A]/10 flex items-center justify-center shrink-0 text-[#1D7A4A]">
                  <BookOpen className="w-6 h-6" strokeWidth={1.75} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-[#1A1D23] text-base font-display">Class Assignments</h3>
                  <p className="text-xs text-gray-400">{homeworks.length} active assignments</p>
                </div>
              </div>
            </div>

            {/* Quick feeds layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left col: Homework & announcements list */}
              <div className="lg:col-span-2 space-y-6">
                {/* Dynamic Homework Section */}
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                    <h3 className="font-semibold text-[#1A1D23] text-xs tracking-wider uppercase font-display">Active Homework</h3>
                    <button onClick={() => setActiveTab('homework')} className="text-xs font-semibold text-[#1D7A4A] hover:text-[#155B37] inline-flex items-center gap-1 cursor-pointer">
                      View all
                      <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </div>

                  {homeworks.length === 0 ? (
                    <p className="text-xs text-gray-400 py-6 text-center font-body">No outstanding assignments. Excellent job!</p>
                  ) : (
                    <div className="divide-y divide-[#E5E7EB] space-y-3.5 font-body">
                      {homeworks.slice(0, 3).map((hw) => (
                        <div key={hw.id} className="pt-3.5 first:pt-0 flex items-start justify-between gap-3 text-xs">
                          <div>
                            <h4 className="font-semibold text-[#1A1D23] text-sm tracking-tight font-display">{hw.title}</h4>
                            <p className="text-gray-450 mt-1">{hw.subject?.name || 'Class Subject'} • Assigned by {hw.teacher.firstName}</p>
                          </div>
                          {hw.dueDate && (
                            <span className="text-[10px] font-bold bg-[#FFF8E6] border border-[#FFE2A3] text-[#B25E00] px-2.5 py-0.5 rounded-full shrink-0">
                              Due {formatDateStr(hw.dueDate)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* dynamic notice board */}
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                    <h3 className="font-semibold text-[#1A1D23] text-xs tracking-wider uppercase font-display">Notice Board Circulars</h3>
                    <button onClick={() => setActiveTab('announcements')} className="text-xs font-semibold text-[#1D7A4A] hover:text-[#155B37] inline-flex items-center gap-1 cursor-pointer font-display">
                      View all
                      <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </div>

                  {announcements.length === 0 ? (
                    <p className="text-xs text-gray-400 py-6 text-center font-body">No active announcements available.</p>
                  ) : (
                    <div className="divide-y divide-[#E5E7EB] space-y-3.5 font-body">
                      {announcements.slice(0, 2).map((ann) => (
                        <div key={ann.id} className="pt-3.5 first:pt-0 text-xs space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 border rounded-md text-[9px] font-bold uppercase ${TYPE_BADGES[ann.type]}`}>
                              {ann.type}
                            </span>
                            <span className="text-[10px] text-gray-400">{formatDateStr(ann.publishedAt)}</span>
                          </div>
                          <h4 className="font-semibold text-[#1A1D23] leading-snug font-display">{ann.title}</h4>
                          <p className="text-gray-500 leading-relaxed line-clamp-2">{ann.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right col: Attendance breakdown list */}
              <div className="space-y-6">
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <h3 className="font-semibold text-[#1A1D23] text-xs tracking-wider uppercase mb-4 pb-2 border-b border-gray-100 font-display">Chronological Logs</h3>

                  {!attendance?.records || attendance.records.length === 0 ? (
                    <p className="text-xs text-gray-400 py-6 text-center font-body">No attendance logs available.</p>
                  ) : (
                    <div className="space-y-2.5 font-body">
                      {attendance.records.slice(0, 5).map((rec) => (
                        <div key={rec.id} className="flex items-center justify-between gap-3 text-xs bg-gray-50/50 border border-[#E5E7EB] p-2.5 rounded-lg">
                          <span className="font-medium text-gray-700">{formatDateStr(rec.date)}</span>
                          <span className={`px-2 py-0.5 border rounded text-[9px] font-bold uppercase ${ATTENDANCE_BADGES[rec.status]}`}>
                            {rec.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-6 animate-fadeIn no-print">
          {isFeeLocked ? <DuesWall /> : (<>
            {/* Header widgets */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h3 className="font-semibold text-gray-800 text-sm font-display">Attendance Logs</h3>
                <p className="text-xs text-gray-400 mt-0.5 font-body">Chronological list of class attendance entries</p>
              </div>

              <div className="flex items-center gap-3 font-body">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-xs text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A]"
                />
                <span className="text-gray-400 text-xs font-semibold">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-xs text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A]"
                />
              </div>
            </div>

            {/* Overall Ring summary */}
            {attendance && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 font-body">
                {[
                  { label: 'Overall ratio', val: `${Math.round(attendance.summary.percentage)}%`, color: 'text-[#1D7A4A] bg-[#E5F6EE] border-[#1D7A4A]/10' },
                  { label: 'Present Days', val: attendance.summary.present, color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                  { label: 'Late Entries', val: attendance.summary.late, color: 'text-amber-700 bg-amber-50 border-amber-105' },
                  { label: 'Half Days', val: attendance.summary.halfDay, color: 'text-purple-700 bg-purple-50 border-purple-100' },
                  { label: 'Absent Days', val: attendance.summary.absent, color: 'text-rose-700 bg-rose-50 border-rose-100' },
                ].map((s) => (
                  <div key={s.label} className={`border p-4 rounded-lg text-center ${s.color}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 font-display">{s.label}</p>
                    <p className="text-lg font-bold mt-1.5">{s.val}</p>
                  </div>
                ))}
              </div>
            )}

            {/* List logs */}
            {attendance?.records && attendance.records.length > 0 ? (
              <div className="border border-[#E5E7EB] rounded-lg overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <table className="w-full min-w-[640px] text-left text-xs border-collapse">
                  <thead className="bg-gray-50 border-b border-[#E5E7EB] text-gray-400 uppercase text-[10px] tracking-wider font-semibold font-display">
                    <tr>
                      <th className="px-5 py-3">Register Date</th>
                      <th className="px-5 py-3">Attendance Status</th>
                      <th className="px-5 py-3">Remarks / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] text-slate-800 font-body">
                    {attendance.records.map((rec) => (
                      <tr key={rec.id} className="hover:bg-gray-50/50">
                        <td className="px-5 py-3.5 font-semibold text-[#1A1D23]">{formatDateStr(rec.date)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-0.5 border rounded font-bold uppercase text-[9px] ${ATTENDANCE_BADGES[rec.status]}`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-400 italic">
                          {rec.note || <span className="text-gray-300">No teacher remarks</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-gray-400 py-12 text-center border border-dashed border-gray-200 rounded-lg font-body">
                No attendance logs found in the selected date range.
              </div>
            )}
          {/* end isFeeLocked gate */}
          </>)}
          </div>
        )}

        {/* TAB 3: FEES */}
        {activeTab === 'fees' && (
          <div className="space-y-6 animate-fadeIn no-print">
            {/* KPI Totals */}
            {fees && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 font-body">
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-5">
                  <div className="w-14 h-14 rounded-lg bg-[#E5F6EE] border border-[#1D7A4A]/10 text-[#1D7A4A] flex items-center justify-center shrink-0">
                    <span className="font-bold text-lg font-display">₹</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-display">Assigned Structure</p>
                    <p className="text-xl font-bold text-slate-800">₹{fees.summary.totalStructure.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-5">
                  <div className="w-14 h-14 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5 text-emerald-600" strokeWidth={2} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-display">Total Paid Amount</p>
                    <p className="text-xl font-bold text-slate-800">₹{fees.summary.totalPaid.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-5">
                  <div className="w-14 h-14 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <Info className="w-5 h-5 text-rose-600" strokeWidth={2} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-display">Outstanding Dues</p>
                    <p className="text-xl font-bold text-slate-800">₹{fees.summary.totalDue.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Categorized Breakdown */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
              <h3 className="font-semibold text-gray-800 text-sm font-display">Fee Structure Ledger</h3>
              {fees?.breakdown && fees.breakdown.length > 0 ? (
                <div className="border border-[#E5E7EB] rounded-lg overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <table className="w-full min-w-[640px] text-left text-xs border-collapse">
                    <thead className="bg-gray-50 border-b border-[#E5E7EB] text-gray-400 font-semibold uppercase tracking-wider text-[10px] font-display">
                      <tr>
                        <th className="px-5 py-3">Category</th>
                        <th className="px-5 py-3">Installment schedule</th>
                        <th className="px-5 py-3">Due Date</th>
                        <th className="px-5 py-3 text-right">Structure amount</th>
                        <th className="px-5 py-3 text-right">Net paid</th>
                        <th className="px-5 py-3 text-right">Net due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] text-slate-850 font-body">
                      {fees.breakdown.map((item) => (
                        <React.Fragment key={item.structureId}>
                          <tr className="hover:bg-gray-50/50">
                            <td className="px-5 py-3.5 font-bold text-[#1A1D23] font-display">{item.feeCategoryName}</td>
                            <td className="px-5 py-3.5 text-gray-400 capitalize">{item.frequency.toLowerCase()}</td>
                            <td className="px-5 py-3.5 font-body">
                              {item.dueDate ? (
                                <span className={`text-xs font-semibold ${item.due > 0 && new Date(item.dueDate) < new Date() ? 'text-rose-600 font-bold' : 'text-gray-700'}`}>
                                  {new Date(item.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  {item.due > 0 && new Date(item.dueDate) < new Date() && <span className="ml-1 text-rose-500">⚠</span>}
                                </span>
                              ) : (
                                <span className="text-gray-300 text-xs italic">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-right font-semibold">₹{item.structureAmount.toLocaleString('en-IN')}</td>
                            <td className="px-5 py-3.5 text-right font-semibold text-emerald-600">₹{item.paid.toLocaleString('en-IN')}</td>
                            <td className="px-5 py-3.5 text-right font-bold text-rose-600">₹{item.due.toLocaleString('en-IN')}</td>
                          </tr>
                          {item.lateFeeApplicable && (
                            <tr className="bg-[#FAEEDA]/30">
                              <td className="px-5 py-2.5 text-[#854F0B] font-semibold text-xs pl-8 font-body">
                                ↳ Late Fee {item.lateFeeWaived
                                  ? <span className="text-[#0F6E56] font-bold">(Waived by admin)</span>
                                  : `(${item.daysOverdue}d overdue)`}
                              </td>
                              <td className="px-5 py-2.5 text-[11px] text-[#854F0B] font-body">—</td>
                              <td colSpan={2} />
                              <td className="px-5 py-2.5 text-right font-bold text-[#854F0B] font-mono text-xs">
                                {item.lateFeeWaived
                                  ? <span className="line-through text-gray-400">₹{(fees.lateFeePolicy.lateFeeAmount).toLocaleString('en-IN')}</span>
                                  : `+₹${(fees.lateFeePolicy.lateFeeAmount).toLocaleString('en-IN')}`}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-10 text-center font-body">No fee structure entries configured.</p>
              )}
            </div>

            {/* Payment history */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
              <h3 className="font-semibold text-gray-800 text-sm font-display">Payment History Log</h3>
              {fees?.payments && fees.payments.length > 0 ? (
                <div className="border border-[#E5E7EB] rounded-lg overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <table className="w-full min-w-[640px] text-left text-xs border-collapse">
                    <thead className="bg-gray-50 border-b border-[#E5E7EB] text-gray-400 font-semibold uppercase tracking-wider text-[10px] font-display">
                      <tr>
                        <th className="px-5 py-3">Receipt No</th>
                        <th className="px-5 py-3">Category details</th>
                        <th className="px-5 py-3">Transaction Date</th>
                        <th className="px-5 py-3">Payment Type</th>
                        <th className="px-5 py-3 text-right">Paid amount</th>
                        <th className="px-5 py-3 text-center">Receipt actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] text-slate-855 font-body">
                      {fees.payments.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50/50">
                          <td className="px-5 py-3.5 font-bold font-mono text-[#1A1D23]">{p.receiptNumber}</td>
                          <td className="px-5 py-3.5 font-semibold text-slate-800 font-display">{p.feeCategory.name}</td>
                          <td className="px-5 py-3.5 text-gray-405">{formatDateStr(p.paidAt)}</td>
                          <td className="px-5 py-3.5 uppercase font-medium text-gray-400 text-[10px]">{p.method}</td>
                          <td className="px-5 py-3.5 text-right font-bold text-slate-900">₹{p.amount.toLocaleString('en-IN')}</td>
                          <td className="px-5 py-3.5 text-center">
                            <button
                              onClick={() => handleViewReceipt(p)}
                              className="px-3 py-1.5 bg-[#E5F6EE] border border-[#1D7A4A]/20 text-[#1D7A4A] hover:bg-[#1D7A4A]/10 rounded-lg transition-colors font-semibold text-[10px] font-display cursor-pointer"
                            >
                              Print receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-10 text-center font-body">No payment history entries found.</p>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: EXAMS */}
        {activeTab === 'exams' && (
          <div className="space-y-6 animate-fadeIn">
          {isFeeLocked ? <DuesWall /> : (<>
            {exams?.examSummaries && exams.examSummaries.length > 0 ? (
              <div className="space-y-8">
                {exams.examSummaries.map((summary) => (
                  <div key={summary.exam.id} className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-6 relative">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-4 no-print font-body">
                      <div>
                        <h3 className="font-bold text-[#1A1D23] text-lg font-display">{summary.exam.name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Term schedule • Started {formatDateStr(summary.exam.startDate)}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1.5 bg-[#E5F6EE] border border-[#1D7A4A]/10 text-[#1D7A4A] rounded-full font-semibold text-xs">
                          GPA Marks: {summary.percentage}%
                        </span>
                        {summary.overallGrade && (
                          <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full font-bold text-xs">
                            Grade: {summary.overallGrade}
                          </span>
                        )}
                        <button
                          onClick={() =>
                            // One exam mark sheet, one sheet of paper.
                            printElement(document.getElementById(`exam-sheet-${summary.exam.id}`), { fit: 'page' })
                          }
                          className="px-4 py-2 bg-white border border-[#E5E7EB] hover:bg-gray-50 text-xs font-semibold text-gray-700 rounded-lg transition-all shadow-sm shrink-0 flex items-center gap-1.5 font-display cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" strokeWidth={1.75} />
                          Print Report
                        </button>
                      </div>
                    </div>

                    {/* DYNAMIC DISPLAY REPORT CONTAINER */}
                    <div id={`exam-sheet-${summary.exam.id}`} className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-6 text-slate-800 relative text-xs font-body">
                      {/* Logo header */}
                      <div className="flex items-start justify-between border-b border-gray-200 pb-4 gap-4">
                        <ReportLetterhead
                          title={`Academic Progress Card • ${summary.exam.name}`}
                          subtitle={`Academic Session • ${exams.academicYear}`}
                        />
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <h4 className="font-semibold text-slate-850 font-display">{student.firstName} {student.lastName}</h4>
                            <p className="text-[10px] text-gray-400 mt-0.5">Adm No: {student.admissionNumber}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{student.class?.name || 'Class assigned'} {student.section?.name ? `(${student.section.name})` : ''}</p>
                          </div>
                          <ReportPhoto src={student.photoUrl} name={`${student.firstName} ${student.lastName}`} size={52} />
                        </div>
                      </div>

                      {/* Grades Table */}
                      <div className="border border-[#E5E7EB] rounded-lg overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                        <table className="w-full min-w-[600px] text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-gray-50 border-b border-[#E5E7EB] text-gray-400 font-bold uppercase tracking-wider text-[9px] font-display">
                              <th className="px-4 py-2">Subject course</th>
                              <th className="px-4 py-2 text-center">Attendance status</th>
                              <th className="px-4 py-2 text-right">Max marks</th>
                              <th className="px-4 py-2 text-right">Marks Obtained</th>
                              <th className="px-4 py-2 text-center">Grade</th>
                              <th className="px-4 py-2">Teacher comments</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E5E7EB]">
                            {summary.results.map((res) => (
                              <tr key={res.id} className="hover:bg-gray-50/50">
                                <td className="px-4 py-2.5 font-bold text-slate-900 font-display">{res.subject.name}</td>
                                <td className="px-4 py-2.5 text-center">
                                  {res.isAbsent ? (
                                    <span className="font-semibold text-rose-600 text-[10px] uppercase">Absent</span>
                                  ) : (
                                    <span className="text-[#1D7A4A] text-[10px] font-bold uppercase">Present</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-right font-medium text-gray-400">{summary.exam.maxMarks}</td>
                                <td className="px-4 py-2.5 text-right font-bold text-slate-850">
                                  {res.isAbsent || res.marksObtained === null ? '—' : res.marksObtained}
                                </td>
                                <td className="px-4 py-2.5 text-center font-bold text-[#1D7A4A]">
                                  {res.isAbsent ? 'F' : res.grade || '—'}
                                </td>
                                <td className="px-4 py-2.5 text-gray-400 italic">
                                  {res.remarks || <span className="text-gray-200">—</span>}
                                </td>
                              </tr>
                            ))}
                            {/* Total summary row */}
                            <tr className="bg-gray-50/50 font-bold border-t border-[#E5E7EB]">
                              <td colSpan={2} className="px-4 py-3 uppercase tracking-wider text-[10px] text-slate-700 font-display">Summary Statistics</td>
                              <td className="px-4 py-3 text-right text-gray-400">{summary.maxPossible}</td>
                              <td className="px-4 py-3 text-right text-slate-900">{summary.totalMarks}</td>
                              <td className="px-4 py-3 text-center text-[#1D7A4A] text-sm font-display">{summary.overallGrade}</td>
                              <td className="px-4 py-3 text-gray-400 text-[10px] font-semibold">GPA Percentage: {summary.percentage}%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Subject-wise marks */}
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-2 font-display">Subject-wise performance</p>
                        <SubjectScoreChart
                          scores={summary.results.map(r => ({ subject: r.subject.name, marks: r.marksObtained, isAbsent: r.isAbsent }))}
                          maxMarks={summary.exam.maxMarks}
                          passingPercent={summary.exam.passingMarks}
                        />
                      </div>

                      {/* Authorized Stamp Signatures */}
                      <div className="grid grid-cols-3 gap-6 text-[10px] text-center pt-16 font-body">
                        <div>
                          <div className="h-8 border-b border-gray-200 max-w-[120px] mx-auto"></div>
                          <p className="text-gray-400 mt-1.5">Class mentor signature</p>
                        </div>

                        <div>
                          <div className="h-8 border-b border-gray-300 max-w-[120px] mx-auto"></div>
                          <p className="text-gray-400 mt-1.5">Controller of Exams</p>
                        </div>

                        <div>
                          <div className="h-8 border-b border-gray-300 max-w-[120px] mx-auto"></div>
                          <p className="text-gray-600 font-bold mt-1.5">Principal Stamp</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-400 py-16 text-center border border-dashed border-gray-200 rounded-xl bg-white no-print font-body">
                No finalized exam report cards published for your academic class.
              </div>
            )}
          {/* end isFeeLocked gate */}
          </>)}
          </div>
        )}

        {/* TAB 5: CCA / CO-SCHOLASTIC */}
        {activeTab === 'cca' && (
          ccaCard ? (
            <ProgressCard card={ccaCard} />
          ) : (
            <div className="py-16 text-center text-sm text-gray-400">
              Failed to load co-curricular records.
            </div>
          )
        )}

        {/* TAB 6: HOMEWORK */}
        {activeTab === 'homework' && (
          <div className="space-y-6 animate-fadeIn no-print">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-semibold text-gray-800 text-sm font-display">Homework Assignments Feed</h3>
              <span className="text-xs bg-[#E5F6EE] border border-[#1D7A4A]/10 text-[#1D7A4A] px-2.5 py-0.5 rounded-full font-bold font-body">
                {homeworks.length} assignments
              </span>
            </div>

            {homeworks.length === 0 ? (
              <div className="py-20 text-center border border-[#E5E7EB] rounded-xl bg-white font-body p-6">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm font-semibold text-gray-800 font-display">All Homework Completed!</p>
                <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1 leading-relaxed">
                  Any new daily class assignments will show up right here. Keep up the great work!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-body">
                {homeworks.map((hw) => {
                  const isApproaching = hw.dueDate
                    ? (new Date(hw.dueDate).getTime() - new Date().getTime()) < (48 * 60 * 60 * 1000)
                    : false;

                  return (
                    <div
                      key={hw.id}
                      className="bg-white border border-[#E5E7EB] hover:border-gray-350 p-5 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-sm transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="font-bold text-gray-900 text-base leading-snug font-display">{hw.title}</h4>
                          {hw.subject && (
                            <span className="px-2.5 py-0.5 bg-[#E5F6EE] border border-[#1D7A4A]/10 text-[#1D7A4A] rounded-md text-[10px] font-bold shrink-0 uppercase tracking-wide font-display">
                              {hw.subject.name}
                            </span>
                          )}
                        </div>

                        {hw.description && (
                          <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed mt-2.5 line-clamp-4">
                            {hw.description}
                          </p>
                        )}

                        <div className="mt-3">
                          <AttachmentList
                            attachments={hw.attachments}
                            attachmentUrl={hw.attachmentUrl}
                            linkLabel="Open resource"
                          />
                        </div>
                      </div>

                      <div className="mt-5 pt-3.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400">Due Date:</span>
                          {hw.dueDate ? (
                            <span className={`font-semibold px-2 py-0.5 rounded-full ${
                              isApproaching
                                ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                : 'bg-[#FFF8E6] text-[#B25E00] border border-[#FFE2A3]'
                            }`}>
                              {formatDateStr(hw.dueDate)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          {submittedIds.has(hw.id) ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1D7A4A] bg-[#E5F6EE] border border-[#1D7A4A]/10 px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
                              Submitted
                            </span>
                          ) : (
                            <button
                              onClick={() => setSubmitHwItem(hw)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-[#1D7A4A] hover:bg-[#155B37] px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                            >
                              <Send className="w-3 h-3" strokeWidth={2.5} />
                              Submit
                            </button>
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

        {/* TAB 6: ANNOUNCEMENTS */}
        {activeTab === 'announcements' && (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-6 animate-fadeIn no-print">
            <h3 className="font-semibold text-gray-800 text-sm font-display">Notice Board & Circulars Feed</h3>

            {announcements.length === 0 ? (
              <div className="text-xs text-gray-400 py-10 text-center border border-dashed border-gray-200 rounded-lg font-body">
                No active announcements published.
              </div>
            ) : (
              <div className="space-y-4 font-body">
                {announcements.map((ann) => (
                  <div key={ann.id} className="border border-[#E5E7EB] p-5 rounded-xl hover:border-gray-300 transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.01)] bg-gray-50/20">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 border rounded text-[9px] font-bold uppercase ${TYPE_BADGES[ann.type]}`}>
                          {ann.type}
                        </span>
                        {ann.isPinned && (
                          <span className="bg-rose-50 border border-rose-100 text-rose-600 text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 flex items-center gap-1 font-display">
                            <Pin className="w-2.5 h-2.5 rotate-45 text-rose-600" strokeWidth={2.5} />
                            Pinned
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400">{formatDateStr(ann.publishedAt)}</span>
                    </div>

                    <h4 className="font-bold text-[#1A1D23] text-base leading-snug font-display">{ann.title}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap mt-3">{ann.body}</p>

                    <div className="mt-4 pt-3 border-t border-gray-100 text-[10px] text-gray-400 font-bold uppercase tracking-wider font-display">
                      Circular Issued By: {ann.createdBy.firstName} {ann.createdBy.lastName}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* POPUP: HOMEWORK SUBMISSION MODAL */}
      {submitHwItem && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn font-body">
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-2xl overflow-hidden max-w-md w-full">
            <div className="bg-[#1A1D23] px-6 py-4 flex items-center justify-between text-white">
              <div>
                <h3 className="font-bold text-sm font-display">Submit Homework</h3>
                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{submitHwItem.title}</p>
              </div>
              <button
                onClick={() => { setSubmitHwItem(null); setSubmitNote(''); setSubmitUrl(''); setSubmitFiles([]); }}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSubmitHomework} className="p-6 space-y-4">
              <AttachmentUploader
                value={submitFiles}
                onChange={setSubmitFiles}
                folder="homework-submissions"
                label="Photos of Your Work"
                hint="Take a photo of each page of your notebook. You can add up to 10."
                link={submitUrl}
                onLinkChange={setSubmitUrl}
                disabled={submitting}
              />
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 font-display">Notes for Your Teacher (optional)</label>
                <textarea
                  rows={3}
                  placeholder="Anything you want to tell your teacher about this work..."
                  value={submitNote}
                  onChange={(e) => setSubmitNote(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setSubmitHwItem(null); setSubmitNote(''); setSubmitUrl(''); setSubmitFiles([]); }}
                  className="px-4 py-2 border border-[#E5E7EB] hover:bg-gray-50 text-xs font-semibold text-gray-700 rounded-lg transition-all cursor-pointer font-display"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (!submitNote.trim() && !submitUrl.trim() && !submitFiles.length)}
                  className="px-5 py-2 bg-[#1D7A4A] hover:bg-[#155B37] text-white text-xs font-semibold rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 font-display"
                >
                  {submitting ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} /> Submitting...</>
                  ) : (
                    <><Send className="w-3.5 h-3.5" strokeWidth={2} /> Submit Homework</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP OVERLAY: PRINTABLE OFFICIAL FEE RECEIPT */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn no-print font-body">
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-2xl overflow-hidden max-w-2xl w-full my-8">
            <div className="bg-[#1A1D23] px-6 py-4 flex items-center justify-between text-white border-b border-[#1A1D23]">
              <h3 className="font-bold text-sm tracking-wider uppercase font-display">Official Payment Voucher</h3>
              <button
                onClick={() => {
                  setSelectedReceipt(null);
                  setReceiptDetails(null);
                }}
                className="text-gray-400 hover:text-white text-lg leading-none font-bold outline-none cursor-pointer p-1"
              >
                ×
              </button>
            </div>

            {loadingReceipt ? (
              <div className="py-24 text-center text-sm text-gray-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1D7A4A] mx-auto mb-2"></div>
                Retrieving voucher...
              </div>
            ) : receiptDetails ? (
              <div className="p-6 space-y-6">
                {/* RENDERABLE RECEIPT CONTAINER FOR DYNAMIC HIDE-PRINT SHEET */}
                <div id="receipt-print-section" className="bg-white border border-gray-200 rounded-xl p-6 space-y-6 text-sm text-gray-800 relative">
                  {/* Watermark badge */}
                  <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-emerald-500/5 font-black text-6xl tracking-widest uppercase border-4 border-emerald-500/10 p-4 select-none pointer-events-none rotate-12 z-0">
                    PAID
                  </span>

                  <div className="relative z-10 space-y-6">
                    {/* Voucher Header with logo place */}
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4 border-b border-gray-200 pb-4">
                      <div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-wide uppercase font-display">Fee Payment Receipt</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                          School Voucher • {receiptDetails.tenant.name}
                        </p>
                      </div>

                      <div className="text-left sm:text-right text-xs">
                        <p className="font-bold text-slate-800 font-display">Receipt No: {receiptDetails.receiptNumber}</p>
                        <p className="text-gray-500 mt-0.5">Date: {formatDateStr(receiptDetails.paidAt)}</p>
                      </div>
                    </div>

                    {/* School Profile details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-gray-50 border border-gray-200 rounded-lg p-3.5">
                      <div>
                        <p className="font-semibold text-gray-400 uppercase tracking-wider font-display">Institution Profile</p>
                        <h4 className="font-bold text-gray-800 text-sm mt-1 font-display">{receiptDetails.tenant.name}</h4>
                        <p className="text-gray-500 mt-0.5 leading-relaxed">{receiptDetails.tenant.profile?.address || 'School Campus'}</p>
                        {receiptDetails.tenant.profile?.phone && <p className="text-gray-550 mt-0.5">Tel: {receiptDetails.tenant.profile.phone}</p>}
                      </div>

                      <div>
                        <p className="font-semibold text-gray-400 uppercase tracking-wider font-display">Student Candidate</p>
                        <h4 className="font-bold text-gray-800 text-sm mt-1 font-display">
                          {receiptDetails.student.firstName} {receiptDetails.student.lastName}
                        </h4>
                        <p className="text-gray-500 mt-0.5 font-mono">Adm No: {receiptDetails.student.admissionNumber}</p>
                        <p className="text-gray-500 mt-0.5">
                          Grade Enrolled: {receiptDetails.student.class?.name || 'Class Assigned'} {receiptDetails.student.section?.name ? `(${receiptDetails.student.section.name})` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Transaction breakdown details */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider font-display">
                            <th className="px-4 py-2.5">Category description</th>
                            <th className="px-4 py-2.5">Method</th>
                            <th className="px-4 py-2.5">Reference No</th>
                            <th className="px-4 py-2.5 text-right">Amount paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-100">
                            <td className="px-4 py-3.5 font-semibold text-gray-700 font-display">{receiptDetails.feeCategory.name}</td>
                            <td className="px-4 py-3.5 text-xs text-gray-450 uppercase font-medium">{receiptDetails.method}</td>
                            <td className="px-4 py-3.5 text-xs text-gray-450 font-mono">{receiptDetails.referenceNumber || <span className="text-gray-300">—</span>}</td>
                            <td className="px-4 py-3.5 text-right font-bold text-gray-900">₹{receiptDetails.amount.toLocaleString('en-IN')}</td>
                          </tr>
                          <tr className="bg-gray-50 font-bold border-t border-gray-200">
                            <td colSpan={3} className="px-4 py-3 text-slate-800 text-xs font-bold uppercase tracking-wider font-display">Net Paid Amount</td>
                            <td className="px-4 py-3 text-right text-[#1D7A4A] text-base font-display">₹{receiptDetails.amount.toLocaleString('en-IN')}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Note if any */}
                    {receiptDetails.note && (
                      <div className="text-xs bg-slate-50 border border-gray-200 rounded-lg p-3.5">
                        <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1 font-display">Receipt Note</span>
                        <p className="text-slate-600 leading-relaxed italic">"{receiptDetails.note}"</p>
                      </div>
                    )}

                    {/* Official Signatures */}
                    <div className="grid grid-cols-2 gap-8 text-xs text-center pt-16">
                      <div>
                        <div className="h-9 border-b border-gray-300 max-w-[150px] mx-auto"></div>
                        <p className="text-[10px] text-gray-400 mt-1.5">Collected By: {receiptDetails.collectedBy?.firstName} {receiptDetails.collectedBy?.lastName}</p>
                      </div>

                      <div>
                        <div className="h-9 border-b border-gray-300 max-w-[150px] mx-auto"></div>
                        <p className="text-[10px] font-semibold text-gray-650 mt-1.5 font-display">Official Accounts Signature</p>
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
                    className="px-4 py-2 border border-[#E5E7EB] hover:bg-gray-50 text-xs font-semibold text-gray-700 rounded-lg transition-all cursor-pointer"
                  >
                    Close Preview
                  </button>
                  <button
                    onClick={() => printElement(document.getElementById('receipt-print-section'), { fit: 'page' })}
                    className="px-5 py-2 bg-[#1D7A4A] hover:bg-[#155B37] text-white text-xs font-semibold rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" strokeWidth={2} />
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

export default function StudentDashboard() {
  return (
    <Suspense fallback={
      <div className="py-40 text-center text-sm text-gray-400 font-body">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1D7A4A] mx-auto mb-4"></div>
        Loading Student Portal Workspace...
      </div>
    }>
      <StudentPortalContent />
    </Suspense>
  );
}
