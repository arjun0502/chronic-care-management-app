"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Label,
} from "recharts";
import { Pill, Activity, User, Heart, MessageCircle, LogOut, Stethoscope } from "lucide-react";

type ActiveTab = "profile" | "data" | "chat";

type BpPoint = {
  date: string;
  systolic: number;
  diastolic: number;
  readable: string;
  timestamp: number;
  event?: string;
};

type ChartDataPoint = {
  readable: string;
  timestamp: number;
};

type Goals = {
  // BP ranges
  systolicMin: number;
  systolicMax: number;
  diastolicMin: number;
  diastolicMax: number;
  // Glucose range
  glucoseMin: number;
  glucoseMax: number;
  // Weight baseline and thresholds
  weightBaseline: number | null;
  weightDailyAlertThreshold: number;
  weightWeeklyAlertThreshold: number;
};

type TooltipProps = {
  active?: boolean;
  payload?: { payload: BpPoint }[];
};

const CardiologyMVP = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("profile");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  
  // State for patient profile and measurements
  const [patientProfile, setPatientProfile] = useState<{
    id: string;
    name: string;
    dob: string | null;
    age: number | null;
    sex: string | null;
    height: number | null;
    weight: number | null;
    conditions: string[];
    allergies: string[];
    familyHistoryHeartDisease: string | null;
    smokingHistory: string | null;
    smokingDetails: string | null;
    alcoholUse: string | null;
    medications: Array<{ name: string; dosage: string; frequency: string }>;
    physician: { id: string; name: string; email: string } | null;
    goals: {
      systolicMin: number | null;
      systolicMax: number | null;
      diastolicMin: number | null;
      diastolicMax: number | null;
      glucoseMin: number | null;
      glucoseMax: number | null;
      weightBaseline: number | null;
      weightDailyAlertThreshold: number | null;
      weightWeeklyAlertThreshold: number | null;
    } | null;
  } | null>(null);
  const [events, setEvents] = useState<Array<{
    id: string;
    date: string;
    title: string;
    description: string | null;
    lifestyleChanges: string[];
    medicationChanges: string[];
  }>>([]);
  const [selectedEvent, setSelectedEvent] = useState<{
    id: string;
    date: string;
    title: string;
    description: string | null;
    lifestyleChanges: string[];
    medicationChanges: string[];
  } | null>(null);
  const [historicalMeasurements, setHistoricalMeasurements] = useState<Array<{
    id: string;
    userId: string;
    date: string;
    systolic: number | null;
    diastolic: number | null;
    glucose: number | null;
    weight: number | null;
  }>>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [metrics, setMetrics] = useState<{
    bp: {
      percentInRange14d: number;
      avgSys3d: number;
      avgDia3d: number;
    } | null;
    glucose: {
      percentInRange14d: number;
      avgGlucose3d: number;
    } | null;
    weight: {
      change7d: number | null;
      weeklyAlert: boolean;
    } | null;
  } | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<Array<{
    id?: string;
    role: "user" | "assistant";
    content: string;
    createdAt?: string;
  }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingChat, setLoadingChat] = useState(true);

  // State for physician patients (physician view) - must be before any returns
  const [physicianPatients, setPhysicianPatients] = useState<Array<{
    id: string;
    name: string;
    age: number | null;
    conditions: string[];
    urgency: "urgent" | "monitor" | "stable";
    summary: string;
    analysisDate: string | null;
  }>>([]);
  const [loadingPhysicianPatients, setLoadingPhysicianPatients] = useState(false);

  // State for selected patient detail (physician view)
  const [selectedPatientDetail, setSelectedPatientDetail] = useState<{
    profile: {
      id: string;
      name: string;
      dob: string | null;
      age: number | null;
      sex: string | null;
      height: number | null;
      weight: number | null;
      conditions: string[];
      allergies: string[];
      familyHistoryHeartDisease: string | null;
      smokingHistory: string | null;
      smokingDetails: string | null;
      alcoholUse: string | null;
      medications: Array<{ name: string; dosage: string; frequency: string }>;
      physician: { id: string; name: string; email: string } | null;
      goals: {
        systolicMin: number | null;
        systolicMax: number | null;
        diastolicMin: number | null;
        diastolicMax: number | null;
        glucoseMin: number | null;
        glucoseMax: number | null;
        weightBaseline: number | null;
        weightDailyAlertThreshold: number | null;
        weightWeeklyAlertThreshold: number | null;
      } | null;
    } | null;
    analysis: {
      summary: string;
      urgency: "urgent" | "monitor" | "stable";
      urgencyScore: number;
      reasons: string[];
      keyConcerns: string[];
      lastUpdated?: string;
    } | null;
    measurements: Array<{
      id: string;
      userId: string;
      date: string;
      systolic: number | null;
      diastolic: number | null;
      glucose: number | null;
      weight: number | null;
    }>;
    events: Array<{
      id: string;
      date: string;
      title: string;
      description: string | null;
      lifestyleChanges: string[];
      medicationChanges: string[];
    }>;
    metrics: {
      bp: {
        percentInRange14d: number;
        avgSys3d: number;
        avgDia3d: number;
      } | null;
      glucose: {
        percentInRange14d: number;
        avgGlucose3d: number;
      } | null;
      weight: {
        change7d: number | null;
        weeklyAlert: boolean;
      } | null;
    } | null;
    goals: {
      systolicMin: number | null;
      systolicMax: number | null;
      diastolicMin: number | null;
      diastolicMax: number | null;
      glucoseMin: number | null;
      glucoseMax: number | null;
      weightBaseline: number | null;
      weightDailyAlertThreshold: number | null;
      weightWeeklyAlertThreshold: number | null;
    } | null;
  } | null>(null);
  const [loadingPatientDetail, setLoadingPatientDetail] = useState(false);
  const [showPatientDetail, setShowPatientDetail] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [goalFormData, setGoalFormData] = useState<{
    systolicMin: number | null;
    systolicMax: number | null;
    diastolicMin: number | null;
    diastolicMax: number | null;
    glucoseMin: number | null;
    glucoseMax: number | null;
    weightBaseline: number | null;
    weightDailyAlertThreshold: number | null;
    weightWeeklyAlertThreshold: number | null;
  } | null>(null);

  // Helper to get today's local date/time in the format expected by datetime-local
  const getLocalDateTimeForInput = () => {
    const now = new Date();
    const tzOffsetMinutes = now.getTimezoneOffset();
    const localTime = new Date(now.getTime() - tzOffsetMinutes * 60 * 1000);
    return localTime.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm" in local time
  };

  // State for measurements (3 measurements per metric) - must be before any returns
  const [measurements, setMeasurements] = useState({
    bloodPressure: [
      { systolic: "", diastolic: "" },
      { systolic: "", diastolic: "" },
      { systolic: "", diastolic: "" },
    ],
    glucose: "",
    weight: "",
    dateTime: getLocalDateTimeForInput(),
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Fetch patient profile and measurements
  useEffect(() => {
    const fetchPatientData = async () => {
      if (status !== "authenticated" || !session?.user?.id) return;
      
      // Only fetch for patients
      if (session.user.role !== "patient") {
        setLoadingData(false);
        return;
      }

      try {
        setLoadingData(true);
        
        // Fetch patient profile
        const profileResponse = await fetch("/api/patient/profile");
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          if (profileData.success) {
            setPatientProfile(profileData.data);
          }
        }

        // Fetch measurements
        const measurementsResponse = await fetch("/api/measurements");
        if (measurementsResponse.ok) {
          const measurementsData = await measurementsResponse.json();
          if (measurementsData.success) {
            setHistoricalMeasurements(measurementsData.data || []);
          }
        }

        // Fetch events
        const eventsResponse = await fetch("/api/patient/events");
        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          if (eventsData.success) {
            setEvents(eventsData.data || []);
          }
        }

        // Fetch derived metrics
        const metricsResponse = await fetch("/api/patient/metrics");
        if (metricsResponse.ok) {
          const metricsData = await metricsResponse.json();
          if (metricsData.success) {
            setMetrics(metricsData.data);
          }
        }
      } catch (error) {
        console.error("Error fetching patient data:", error);
      } finally {
        setLoadingData(false);
      }
    };

    fetchPatientData();
  }, [status, session]);

  // Track last authenticated user ID to detect new logins
  const [lastAuthenticatedUserId, setLastAuthenticatedUserId] = useState<string | null>(null);
  
  // Reset chat state when user signs in (new session)
  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      // Check if this is a new login (user ID changed or was null)
      if (lastAuthenticatedUserId !== session.user.id) {
        console.log("=== NEW LOGIN SESSION - RESETTING CHAT ===");
        // Reset chat state for new login session
        setChatMessages([]);
        setChatId(null);
        setChatInput("");
        setLoadingChat(true);
        setLastAuthenticatedUserId(session.user.id);
      }
    } else if (status === "unauthenticated") {
      // Reset tracking when user logs out
      setLastAuthenticatedUserId(null);
      setChatMessages([]);
      setChatId(null);
      setChatInput("");
    }
  }, [status, session?.user?.id, lastAuthenticatedUserId]);

  // Load chat history when chat tab is opened (only if no chat loaded yet)
  useEffect(() => {
    if (activeTab === "chat" && session?.user?.id && loadingChat && chatMessages.length === 0 && chatId === null) {
      const loadChat = async () => {
        try {
          // Don't load old chat - start fresh on each login
          // Just set loading to false so user can start new chat
          setLoadingChat(false);
          setChatMessages([]);
          setChatId(null);
        } catch (error) {
          console.error("Error loading chat:", error);
          setLoadingChat(false);
        }
      };
      
      loadChat();
    }
  }, [activeTab, session?.user?.id, loadingChat, chatMessages.length, chatId]);


  const sendChatMessage = async () => {
    if (!chatInput.trim() || sendingMessage) {
      console.log("=== SEND CHAT MESSAGE BLOCKED ===");
      console.log("Chat input empty:", !chatInput.trim());
      console.log("Already sending:", sendingMessage);
      return;
    }

    console.log("=== SENDING CHAT MESSAGE (FRONTEND) ===");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Message:", chatInput.trim());
    console.log("Current chatId:", chatId);
    console.log("Current sendingMessage state:", sendingMessage);

    const userMessage = chatInput.trim();
    setChatInput("");
    
    // Add user message to UI immediately
    const tempUserMessage = {
      role: "user" as const,
      content: userMessage,
    };
    setChatMessages(prev => [...prev, tempUserMessage]);
    setSendingMessage(true);

    try {
      console.log("Making API call to /api/chat...");
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          chatId: chatId,
        }),
      });
      
      console.log("API response status:", response.status);

      const result = await response.json();
      console.log("API response result:", result);
      console.log("Events in response:", result.data?.events?.length || 0);
      
      if (result.success) {
        console.log("Chat message sent successfully");
        console.log("New chatId:", result.data.chatId);
        setChatId(result.data.chatId);
        setChatMessages(prev => [...prev, {
          role: "assistant",
          content: result.data.message,
        }]);
      } else {
        console.error("API returned error:", result.error);
        setChatMessages(prev => [...prev, {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        }]);
      }
    } catch (error) {
      console.error("=== ERROR SENDING MESSAGE ===");
      console.error("Error:", error);
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      }]);
    } finally {
      console.log("Setting sendingMessage to false");
      setSendingMessage(false);
      console.log("=== END SEND CHAT MESSAGE ===");
    }
  };

  // Fetch physician patients when physician view is active (must be before early returns)
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (session.user.role !== "physician") return;

    const fetchPhysicianPatients = async () => {
      try {
        setLoadingPhysicianPatients(true);
        const response = await fetch("/api/physician/patients");
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setPhysicianPatients(data.data);
            // Set first patient as selected if none selected
            if (data.data.length > 0 && selectedPatientId === null) {
              setSelectedPatientId(data.data[0].id);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching physician patients:", error);
      } finally {
        setLoadingPhysicianPatients(false);
      }
    };

    fetchPhysicianPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  // Fetch patient detail when a patient is selected (physician view)
  const fetchPatientDetail = async (patientId: string) => {
    try {
      setLoadingPatientDetail(true);
      
      // Fetch all data in parallel
      const [profileRes, analysisRes, measurementsRes, eventsRes, metricsRes, goalsRes] = await Promise.all([
        fetch(`/api/patient/profile?patientId=${patientId}`),
        fetch(`/api/patient/analysis?patientId=${patientId}`),
        fetch(`/api/measurements?patientId=${patientId}`),
        fetch(`/api/patient/events?patientId=${patientId}`),
        fetch(`/api/patient/metrics?patientId=${patientId}`),
        fetch(`/api/patient/goals?patientId=${patientId}`),
      ]);

      const profileData = profileRes.ok ? await profileRes.json() : null;
      const analysisData = analysisRes.ok ? await analysisRes.json() : null;
      const measurementsData = measurementsRes.ok ? await measurementsRes.json() : null;
      const eventsData = eventsRes.ok ? await eventsRes.json() : null;
      const metricsData = metricsRes.ok ? await metricsRes.json() : null;
      const goalsData = goalsRes.ok ? await goalsRes.json() : null;

      setSelectedPatientDetail({
        profile: profileData?.success ? profileData.data : null,
        analysis: analysisData?.success ? analysisData.data : null,
        measurements: measurementsData?.success ? (measurementsData.data || []) : [],
        events: eventsData?.success ? (eventsData.data || []) : [],
        metrics: metricsData?.success ? metricsData.data : null,
        goals: goalsData?.success ? {
          systolicMin: goalsData.data?.systolicMin ?? null,
          systolicMax: goalsData.data?.systolicMax ?? null,
          diastolicMin: goalsData.data?.diastolicMin ?? null,
          diastolicMax: goalsData.data?.diastolicMax ?? null,
          glucoseMin: goalsData.data?.glucoseMin ?? null,
          glucoseMax: goalsData.data?.glucoseMax ?? null,
          weightBaseline: goalsData.data?.weightBaseline ?? null,
          weightDailyAlertThreshold: goalsData.data?.weightDailyAlertThreshold ?? null,
          weightWeeklyAlertThreshold: goalsData.data?.weightWeeklyAlertThreshold ?? null,
        } : null,
      });
    } catch (error) {
      console.error("Error fetching patient detail:", error);
    } finally {
      setLoadingPatientDetail(false);
    }
  };

  // Fetch patient detail when selectedPatientId changes (physician view)
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (session.user.role !== "physician") return;
    if (!selectedPatientId) return;

    fetchPatientDetail(selectedPatientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId]);

  // Show loading while checking auth
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (status === "unauthenticated" || !session) {
    return null;
  }

  // Determine view based on user role
  const userRole = session.user?.role as "patient" | "physician";
  const isPatient = userRole === "patient";
  const isPhysician = userRole === "physician";

  // Show loading state while fetching data
  if (loadingData && isPatient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your data...</p>
        </div>
      </div>
    );
  }

  // Use personalized goals from database (Goal table). If goals don't exist at all,
  // fall back to reasonable defaults, but never override what is stored in the DB.
  const goals: Goals = patientProfile?.goals ? {
    // BP ranges - use DB values or defaults
    systolicMin: patientProfile.goals.systolicMin ?? 110,
    systolicMax: patientProfile.goals.systolicMax ?? 135,
    diastolicMin: patientProfile.goals.diastolicMin ?? 70,
    diastolicMax: patientProfile.goals.diastolicMax ?? 85,
    // Glucose range
    glucoseMin: patientProfile.goals.glucoseMin ?? 70,
    glucoseMax: patientProfile.goals.glucoseMax ?? 180,
    // Weight baseline and thresholds
    weightBaseline: patientProfile.goals.weightBaseline,
    weightDailyAlertThreshold: patientProfile.goals.weightDailyAlertThreshold ?? 2.0,
    weightWeeklyAlertThreshold: patientProfile.goals.weightWeeklyAlertThreshold ?? 5.0,
  } : {
    // Default ranges if no goals exist
    systolicMin: 110,
    systolicMax: 135,
    diastolicMin: 70,
    diastolicMax: 85,
    glucoseMin: 70,
    glucoseMax: 180,
    weightBaseline: null,
    weightDailyAlertThreshold: 2.0,
    weightWeeklyAlertThreshold: 5.0,
  };

  // Convert historical measurements to chart data format
  // For weight: use measurement weight or fallback to profile weight
  const profileWeight = patientProfile?.weight || null;
  
  const bpData: BpPoint[] = historicalMeasurements
    .filter(m => m.systolic !== null && m.diastolic !== null)
    .slice(0, 20) // Last 20 measurements
    .reverse() // Oldest first for chart
    .map((m) => {
      const date = new Date(m.date);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return {
        date: `${month}/${day}`,
        systolic: m.systolic as number,
        diastolic: m.diastolic as number,
        readable: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        timestamp: date.getTime(), // For event line positioning
      };
    });

  // Weight chart data (use measurement weight, fallback to profile weight if available)
  const weightData = historicalMeasurements
    .filter(m => m.weight !== null || profileWeight !== null)
    .slice(0, 20)
    .reverse()
    .map((m) => {
      const date = new Date(m.date);
      return {
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        weight: m.weight !== null ? m.weight : profileWeight,
        readable: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        timestamp: date.getTime(),
      };
    });

  // Glucose chart data
  const glucoseData = historicalMeasurements
    .filter(m => m.glucose !== null)
    .slice(0, 20)
    .reverse()
    .map((m) => {
      const date = new Date(m.date);
      return {
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        glucose: m.glucose as number,
        readable: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        timestamp: date.getTime(),
      };
    });


  const CustomTooltip = ({ active, payload }: TooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold">{data.readable}</p>
          <p className="text-blue-600">Systolic: {data.systolic} mmHg</p>
          <p className="text-green-600">Diastolic: {data.diastolic} mmHg</p>
          {data.event && (
            <p className="text-orange-600 mt-2 font-medium border-t pt-2">📍 {data.event}</p>
          )}
        </div>
      );
    }
    return null;
  };

  // Get event lines for charts
  const getEventLines = (chartData: ChartDataPoint[]) => {
    if (chartData.length === 0) return [];
    
    // Helper to get date string (YYYY-MM-DD) from any date input
    const getDateString = (dateInput: string | number | Date): string => {
      const d = new Date(dateInput);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    
    // Get date range from chart data (oldest to newest)
    const firstDate = getDateString(chartData[0].timestamp);
    const lastDate = getDateString(chartData[chartData.length - 1].timestamp);
    
    return events
      .filter((event) => {
        const eventDate = getDateString(event.date);
        // Simple string comparison: "2025-11-28" >= "2025-11-27" works correctly
        return eventDate >= firstDate && eventDate <= lastDate;
      })
      .map((event) => {
        const eventDate = new Date(event.date);
        // Find the index in chartData closest to this event
        const closestIndex = chartData.reduce((closest, point, index) => {
          const eventTime = eventDate.getTime();
          const currentDiff = Math.abs(point.timestamp - eventTime);
          const closestDiff = Math.abs(chartData[closest].timestamp - eventTime);
          return currentDiff < closestDiff ? index : closest;
        }, 0);
        
        return (
          <ReferenceLine
            key={event.id}
            x={chartData[closestIndex]?.readable}
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="5 5"
            label={
              <Label
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={(props: any) => {
                  if (!props || !props.viewBox) return null;
                  const viewBox = props.viewBox;
                  const x = typeof viewBox.x === 'number' ? viewBox.x : 0;
                  const y = typeof viewBox.y === 'number' ? viewBox.y : 0;
                  return (
                    <text
                      x={x}
                      y={y - 10}
                      fill="#f59e0b"
                      fontSize={16}
                      fontWeight="600"
                      textAnchor="middle"
                      style={{ cursor: "pointer" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(event);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = "0.8";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = "1";
                      }}
                    >
                      {event.title}
                    </text>
                  );
                }}
              />
            }
          />
        );
      });
  };

  // Helper function to calculate BP summary metrics
  const calculateBPMetrics = () => {
    // Prefer backend-computed metrics when available
    if (metrics?.bp) {
      return {
        percentInRange: metrics.bp.percentInRange14d,
        avgSys: metrics.bp.avgSys3d,
        avgDia: metrics.bp.avgDia3d,
      };
    }

    if (bpData.length === 0) return null;
    
    const last14Days = bpData.slice(0, 14); // Most recent 14 days
    const last3Days = bpData.slice(0, 3);
    
    // Count measurements in target range
    const inRangeCount = last14Days.filter(point => {
      const sysInRange = point.systolic >= goals.systolicMin && point.systolic <= goals.systolicMax;
      const diaInRange = point.diastolic >= goals.diastolicMin && point.diastolic <= goals.diastolicMax;
      return sysInRange && diaInRange;
    }).length;
    
    const percentInRange = last14Days.length > 0 ? Math.round((inRangeCount / last14Days.length) * 100) : 0;
    
    // Calculate 3-day averages
    const avgSys = last3Days.length > 0 
      ? Math.round(last3Days.reduce((sum, p) => sum + p.systolic, 0) / last3Days.length)
      : 0;
    const avgDia = last3Days.length > 0
      ? Math.round(last3Days.reduce((sum, p) => sum + p.diastolic, 0) / last3Days.length)
      : 0;
    
    return { percentInRange, avgSys, avgDia };
  };

  const renderBPChart = () => {
    if (bpData.length === 0) {
      return (
        <div className="flex items-center justify-center h-80 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No blood pressure data available yet. Record your first measurement to see trends here.</p>
        </div>
      );
    }
    
    const metrics = calculateBPMetrics();
    
    return (
      <div>
        {/* Summary Metrics */}
        {metrics && (
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-sm text-gray-700 mb-1">
                % of BP Readings in Target Range (Last 14 Days)
              </p>
              <p className="text-lg font-bold text-blue-700">
                {metrics.percentInRange}%
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-sm text-gray-700 mb-1">
                3-Day Average Systolic BP
              </p>
              <p className="text-lg font-bold text-blue-700">
                {metrics.avgSys} mmHg
              </p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
              <p className="text-sm text-gray-800 mb-1">
                3-Day Average Diastolic BP
              </p>
              <p className="text-lg font-bold text-orange-600">
                {metrics.avgDia} mmHg
              </p>
            </div>
          </div>
        )}
        
        <ResponsiveContainer width="100%" height={320} style={{ outline: 'none' }}>
          <LineChart data={bpData} margin={{ top: 40, right: 80, left: 60, bottom: 30 }} style={{ outline: 'none' }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="readable">
              <Label value="Date" position="bottom" offset={10} />
            </XAxis>
            <YAxis domain={[0, 160]} width={60}>
              <Label
                value="Blood Pressure (mmHg)"
                angle={-90}
                position="insideLeft"
                style={{ textAnchor: "middle" }}
              />
            </YAxis>
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" align="right" wrapperStyle={{ top: 0 }} />
            
            {/* Target range bands - green shaded areas */}
            <ReferenceArea
              y1={goals.systolicMin}
              y2={goals.systolicMax}
              fill="#86efac"
              fillOpacity={0.3}
              stroke="none"
            />
            <ReferenceArea
              y1={goals.diastolicMin}
              y2={goals.diastolicMax}
              fill="#86efac"
              fillOpacity={0.3}
              stroke="none"
            />
            
            {getEventLines(bpData)}
            {/* Show lines connecting points with visible colored dots */}
            <Line
              type="monotone"
              dataKey="systolic"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ r: 3, fill: "#3b82f6" }}
              name="Systolic BP"
            />
            <Line
              type="monotone"
              dataKey="diastolic"
              stroke="#f97316" // Orange to distinguish from green target band
              strokeWidth={3}
              dot={{ r: 3, fill: "#f97316" }}
              name="Diastolic BP"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Helper function to calculate weight summary metrics
  const calculateWeightMetrics = () => {
    if (weightData.length === 0 && !profileWeight) return null;

    // Prefer backend-computed metrics when available (7-day change only)
    if (metrics?.weight) {
      return {
        change7d: metrics.weight.change7d,
        weeklyAlert: metrics.weight.weeklyAlert,
      };
    }

    if (weightData.length === 0) return null;

    const today = weightData[0];
    const weekAgo = weightData.find((d, idx) => {
      if (idx === 0) return false;
      const daysDiff =
        (new Date(today.timestamp).getTime() -
          new Date(d.timestamp).getTime()) /
        (1000 * 60 * 60 * 24);
      return daysDiff >= 6 && daysDiff <= 8; // 6-8 days ago
    });

    const change7d =
      weekAgo && today.weight && weekAgo.weight
        ? today.weight - weekAgo.weight
        : null;

    const weeklyAlert =
      change7d !== null &&
      Math.abs(change7d) > (goals.weightWeeklyAlertThreshold ?? 5.0);

    return { change7d, weeklyAlert };
  };

  const renderWeightChart = () => {
    if (weightData.length === 0 && !profileWeight) {
      return (
        <div className="flex items-center justify-center h-80 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No weight data available yet.</p>
        </div>
      );
    }
    
    const metrics = calculateWeightMetrics();
    
    // Calculate dynamic Y-axis domain with 5-lb tick increments
    const weightValues = weightData.length > 0 
      ? weightData.map(d => d.weight).filter((w): w is number => typeof w === 'number' && !isNaN(w))
      : profileWeight ? [profileWeight] : [];
    const minWeight = weightValues.length > 0 ? Math.min(...weightValues) : 150;
    const maxWeight = weightValues.length > 0 ? Math.max(...weightValues) : 200;
    const padding = 10; // 10 lbs padding on each side
    const yMin = Math.max(0, Math.floor((minWeight - padding) / 5) * 5); // Round down to nearest 5
    const yMax = Math.ceil((maxWeight + padding) / 5) * 5; // Round up to nearest 5
    
    // Generate ticks every 5 lbs
    const ticks: number[] = [];
    for (let i = yMin; i <= yMax; i += 5) {
      ticks.push(i);
    }
    
    return (
      <div>
        {/* Summary Metrics - 7-day change only */}
        {metrics && (
          <div className="mb-4 grid grid-cols-1 gap-4">
            <div
              className={`rounded-lg p-3 border ${
                metrics.weeklyAlert
                  ? "bg-red-50 border-red-200"
                  : "bg-sky-50 border-sky-200"
              }`}
            >
              <p className="text-sm text-gray-700 mb-1">7-Day Change</p>
              <p
                className={`text-lg font-bold ${
                  metrics.weeklyAlert ? "text-red-700" : "text-sky-700"
                }`}
              >
                {metrics.change7d !== null
                  ? `${metrics.change7d > 0 ? "+" : ""}${metrics.change7d.toFixed(
                      1
                    )} lbs`
                  : "N/A"}
                {metrics.weeklyAlert && " ⚠️"}
              </p>
            </div>
          </div>
        )}
        
        <ResponsiveContainer width="100%" height={320} style={{ outline: 'none' }}>
          <LineChart
            data={weightData.length > 0 ? weightData : [{ readable: "Profile", weight: profileWeight }]}
            margin={{ top: 60, right: 80, left: 60, bottom: 30 }}
            style={{ outline: 'none' }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="readable">
              <Label value="Date" position="bottom" offset={10} />
            </XAxis>
            <YAxis domain={[yMin, yMax]} ticks={ticks} width={60}>
              <Label
                value="Weight (lbs)"
                angle={-90}
                position="insideLeft"
                style={{ textAnchor: "middle" }}
              />
            </YAxis>
            <Tooltip />
            
            {weightData.length > 0 && getEventLines(weightData)}
            {/* Show line connecting points with visible colored dots */}
            <Line
              type="monotone"
              dataKey="weight"
              stroke="#0ea5e9"
              strokeWidth={3}
              dot={{ r: 3, fill: "#0ea5e9" }}
              name="Weight"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Helper function to calculate Glucose summary metrics
  const calculateGlucoseMetrics = () => {
    if (glucoseData.length === 0) return null;
    
    const last14Days = glucoseData.slice(0, 14); // Most recent 14 days
    const last3Days = glucoseData.slice(0, 3);
    
    // Count measurements in target range
    const inRangeCount = last14Days.filter(point => {
      return point.glucose >= goals.glucoseMin && point.glucose <= goals.glucoseMax;
    }).length;
    
    const percentInRange = last14Days.length > 0 ? Math.round((inRangeCount / last14Days.length) * 100) : 0;
    
    // Calculate 3-day average
    const avgGlucose = last3Days.length > 0 
      ? Math.round(last3Days.reduce((sum, p) => sum + p.glucose, 0) / last3Days.length)
      : 0;
    
    return { percentInRange, avgGlucose };
  };

  const renderGlucoseChart = () => {
    if (glucoseData.length === 0) {
      return (
        <div className="flex items-center justify-center h-80 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No glucose data available yet. Record your first measurement to see trends here.</p>
        </div>
      );
    }
    
    const metrics = calculateGlucoseMetrics();
    
    // Calculate dynamic Y-axis domain with 10 mg/dL tick increments
    const glucoseValues = glucoseData.map(d => d.glucose).filter((g): g is number => typeof g === 'number' && !isNaN(g));
    const minGlucose = glucoseValues.length > 0 ? Math.min(...glucoseValues) : 80;
    const maxGlucose = glucoseValues.length > 0 ? Math.max(...glucoseValues) : 200;
    const padding = 20; // 20 mg/dL padding on each side
    const yMin = Math.max(0, Math.floor((minGlucose - padding) / 10) * 10); // Round down to nearest 10
    const yMax = Math.ceil((maxGlucose + padding) / 10) * 10; // Round up to nearest 10
    
    // Ensure range is included
    const finalYMin = Math.min(yMin, Math.floor((goals.glucoseMin - padding) / 10) * 10);
    const finalYMax = Math.max(yMax, Math.ceil((goals.glucoseMax + padding) / 10) * 10);
    
    // Generate ticks every 10 mg/dL
    const ticks: number[] = [];
    for (let i = finalYMin; i <= finalYMax; i += 10) {
      ticks.push(i);
    }
    
    return (
      <div>
        {/* Summary Metrics */}
        {metrics && (
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
              <p className="text-sm text-gray-700 mb-1">
                % of Glucose Readings in Target Range (Last 14 Days)
              </p>
              <p className="text-lg font-bold text-purple-700">
                {metrics.percentInRange}%
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
              <p className="text-sm text-gray-700 mb-1">3-Day Average Glucose</p>
              <p className="text-lg font-bold text-purple-700">
                {metrics.avgGlucose} mg/dL
              </p>
            </div>
          </div>
        )}
        
        <ResponsiveContainer width="100%" height={320} style={{ outline: 'none' }}>
          <LineChart
            data={glucoseData}
            margin={{ top: 60, right: 80, left: 60, bottom: 30 }}
            style={{ outline: 'none' }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="readable">
              <Label value="Date" position="bottom" offset={10} />
            </XAxis>
            <YAxis domain={[finalYMin, finalYMax]} ticks={ticks} width={60}>
              <Label
                value="Glucose (mg/dL)"
                angle={-90}
                position="insideLeft"
                style={{ textAnchor: "middle" }}
              />
            </YAxis>
            <Tooltip />
            
            {/* Target range band - green shaded area */}
            <ReferenceArea
              y1={goals.glucoseMin}
              y2={goals.glucoseMax}
              fill="#86efac"
              fillOpacity={0.3}
              stroke="none"
            />
            
            {getEventLines(glucoseData)}
            {/* Show line connecting points with visible colored dots */}
            <Line
              type="monotone"
              dataKey="glucose"
              stroke="#a855f7"
              strokeWidth={3}
              dot={{ r: 2, fill: "#a855f7" }}
              name="Glucose"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Form submission handler
  const handleSubmitMeasurements = async () => {
    // Validate that at least one measurement is provided
    const hasBP = measurements.bloodPressure.some(bp => bp.systolic && bp.diastolic);
    const hasGlucose = measurements.glucose && measurements.glucose.trim() !== "";

    if (!hasBP && !hasGlucose) {
      alert("Please enter at least one measurement");
      return;
    }

    // Get userId from session
    const userId = session?.user?.id;
    if (!userId) {
      alert("You must be logged in to save measurements");
      return;
    }

    try {
      const response = await fetch("/api/measurements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bloodPressure: measurements.bloodPressure,
          glucose: measurements.glucose,
          weight: measurements.weight,
          dateTime: measurements.dateTime,
          userId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Reset form (no popup message)
        setMeasurements({
          bloodPressure: [
            { systolic: "", diastolic: "" },
            { systolic: "", diastolic: "" },
            { systolic: "", diastolic: "" },
          ],
          glucose: "",
          weight: "",
          dateTime: getLocalDateTimeForInput(),
        });
        // Refresh measurements data
        const measurementsResponse = await fetch("/api/measurements");
        if (measurementsResponse.ok) {
          const measurementsData = await measurementsResponse.json();
          if (measurementsData.success) {
            setHistoricalMeasurements(measurementsData.data || []);
          }
        }
      } else {
        alert(`Error: ${data.error || "Failed to save measurements"}`);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error saving measurements");
    }
  };

  // ---------------- PATIENT VIEW ----------------
  const renderPatientView = () => (
    <>
      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
              activeTab === "profile"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <User className="w-5 h-5" />
            <span>Patient Profile</span>
          </button>
          <button
            onClick={() => setActiveTab("data")}
            className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
              activeTab === "data"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <Activity className="w-5 h-5" />
            <span>Record Data</span>
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
              activeTab === "chat"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            <span>Chat</span>
          </button>
        </div>
      </div>

      {/* Patient Profile Tab */}
      {activeTab === "profile" && patientProfile && (
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
              <User className="w-6 h-6 mr-2 text-blue-600" />
              Patient Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Full Name</p>
                <p className="text-lg font-semibold">{patientProfile.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Date of Birth</p>
                <p className="text-lg font-semibold">
                  {patientProfile.dob || "Not provided"} {patientProfile.age !== null ? `(Age ${patientProfile.age})` : ""}
                </p>
              </div>
              {patientProfile.physician && (
                <div>
                  <p className="text-sm text-gray-600">Primary Physician</p>
                  <p className="text-lg font-semibold">{patientProfile.physician.name}</p>
                </div>
              )}
              {patientProfile.sex && (
                <div>
                  <p className="text-sm text-gray-600">Sex</p>
                  <p className="text-lg font-semibold">{patientProfile.sex}</p>
                </div>
              )}
              {patientProfile.height !== null && (
                <div>
                  <p className="text-sm text-gray-600">Height</p>
                  <p className="text-lg font-semibold">{patientProfile.height} inches</p>
                </div>
              )}
              {patientProfile.weight !== null && (
                <div>
                  <p className="text-sm text-gray-600">Weight</p>
                  <p className="text-lg font-semibold">{patientProfile.weight} lbs</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Allergies</p>
                <p className="text-lg font-semibold text-red-600">
                  {patientProfile.allergies.length > 0 ? patientProfile.allergies.join(", ") : "None"}
                </p>
              </div>
              {patientProfile.familyHistoryHeartDisease && (
                <div>
                  <p className="text-sm text-gray-600">Family History of Heart Disease</p>
                  <p className="text-lg">{patientProfile.familyHistoryHeartDisease}</p>
                </div>
              )}
              {patientProfile.smokingHistory && (
                <div>
                  <p className="text-sm text-gray-600">Smoking History</p>
                  <p className="text-lg font-semibold">{patientProfile.smokingHistory}</p>
                  {patientProfile.smokingDetails && (
                    <p className="text-sm text-gray-500">{patientProfile.smokingDetails}</p>
                  )}
                </div>
              )}
              {patientProfile.alcoholUse && (
                <div>
                  <p className="text-sm text-gray-600">Alcohol Use</p>
                  <p className="text-lg">{patientProfile.alcoholUse}</p>
                </div>
              )}
            </div>
          </div>

          {/* Current Conditions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">Current Conditions</h3>
            <div className="flex flex-wrap gap-2">
              {patientProfile.conditions.length > 0 ? (
                patientProfile.conditions.map((condition, idx) => (
                  <span
                    key={idx}
                    className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium"
                  >
                    {condition}
                  </span>
                ))
              ) : (
                <p className="text-gray-500">No conditions listed</p>
              )}
            </div>
          </div>

          {/* Current Medications */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <Pill className="w-5 h-5 mr-2 text-blue-600" />
              Current Medications
            </h3>
            <div className="space-y-3">
              {patientProfile.medications.length > 0 ? (
                patientProfile.medications.map((med, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
                  >
                    <div>
                      <p className="font-semibold text-gray-800">{med.name}</p>
                      <p className="text-sm text-gray-600">
                        {med.dosage} - {med.frequency}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No medications listed</p>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Medication changes are tracked through your conversations with your care team.
            </p>
          </div>
        </div>
      )}

      {/* Data Entry Tab */}
      {activeTab === "data" && (
        <div className="space-y-6">
          {/* Today's Measurements Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Today&apos;s Measurements</h2>
                <p className="text-sm text-gray-600 mt-1">Enter your latest readings</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Blood Pressure */}
              <div className="p-4 border-2 border-blue-200 rounded-lg">
                <label className="block text-xl font-semibold text-gray-900 mb-2">
                  Blood Pressure
                </label>
                <p className="text-sm text-gray-700 mb-4">
                  Take 3 measurements and enter all values. We&apos;ll average them automatically.
                </p>
                {[0, 1, 2].map((index) => (
                  <div key={index} className="mb-4 pb-4 border-b border-gray-200 last:border-b-0">
                    <p className="text-base font-medium text-gray-700 mb-2">Measurement {index + 1}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-2">
                          Systolic (top number)
                        </label>
                        <input
                          type="number"
                          placeholder="120"
                          value={measurements.bloodPressure[index].systolic}
                          onChange={(e) => {
                            const newBP = [...measurements.bloodPressure];
                            newBP[index] = { ...newBP[index], systolic: e.target.value };
                            setMeasurements({ ...measurements, bloodPressure: newBP });
                          }}
                          className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                        />
                        <p className="text-sm text-gray-500 mt-1">mmHg</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-2">
                          Diastolic (bottom number)
                        </label>
                        <input
                          type="number"
                          placeholder="80"
                          value={measurements.bloodPressure[index].diastolic}
                          onChange={(e) => {
                            const newBP = [...measurements.bloodPressure];
                            newBP[index] = { ...newBP[index], diastolic: e.target.value };
                            setMeasurements({ ...measurements, bloodPressure: newBP });
                          }}
                          className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                        />
                        <p className="text-sm text-gray-500 mt-1">mmHg</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Weight */}
              <div className="p-4 border-2 border-green-200 rounded-lg">
                <label className="block text-lg font-semibold text-gray-800 mb-3">Weight</label>
                <input
                  type="number"
                  placeholder="185"
                  value={measurements.weight}
                  onChange={(e) => setMeasurements({ ...measurements, weight: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                />
                <p className="text-sm text-gray-500 mt-1">pounds (lbs)</p>
              </div>

              {/* Glucose */}
              <div className="p-4 border-2 border-purple-200 rounded-lg">
                <label className="block text-lg font-semibold text-gray-800 mb-3">
                  Blood Glucose
                </label>
                <input
                  type="number"
                  placeholder="110"
                  value={measurements.glucose}
                  onChange={(e) => setMeasurements({ ...measurements, glucose: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <p className="text-sm text-gray-500 mt-1">mg/dL (fasting)</p>
              </div>

              {/* Date/Time */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  When were these measurements taken?
                </label>
                <input
                  type="datetime-local"
                  value={measurements.dateTime}
                  onChange={(e) => setMeasurements({ ...measurements, dateTime: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmitMeasurements}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors"
              >
                Save Measurements
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Tab */}
      {activeTab === "chat" && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Chat with Your Care Team</h2>
            <p className="text-gray-600">
              Share symptoms, discuss lifestyle changes, or ask questions
            </p>
          </div>

          <div className="border-2 border-gray-200 rounded-lg h-[600px] flex flex-col">
            {/* Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
              {loadingChat ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-500">Loading chat...</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {chatMessages.length === 0 && (
                    <div className="flex items-start space-x-3">
                      <div className="bg-blue-100 p-2 rounded-full">
                        <Stethoscope className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="bg-white p-3 rounded-lg shadow-sm max-w-md">
                        <p className="text-sm text-gray-800">
                          Hello! I&apos;m here to help you track your health. How are you feeling today?
                          Have you noticed any new symptoms or changes since our last check-in?
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start space-x-3 ${
                        msg.role === "user" ? "justify-end" : ""
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="bg-blue-100 p-2 rounded-full">
                          <Stethoscope className="w-5 h-5 text-blue-600" />
                        </div>
                      )}
                      <div
                        className={`p-3 rounded-lg shadow-sm max-w-md ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-800"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      {msg.role === "user" && (
                        <div className="bg-gray-300 p-2 rounded-full">
                          <User className="w-5 h-5 text-gray-600" />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {sendingMessage && (
                    <div className="flex items-start space-x-3">
                      <div className="bg-blue-100 p-2 rounded-full">
                        <Stethoscope className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="bg-white p-3 rounded-lg shadow-sm">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t-2 border-gray-200 p-4 bg-white">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChatMessage();
                    }
                  }}
                  placeholder="Type your message here..."
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  disabled={sendingMessage || loadingChat}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={sendingMessage || !chatInput.trim() || loadingChat}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Event Details Popup */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setSelectedEvent(null)}
        >
          {/* Transparent backdrop - no dark overlay */}
          <div className="absolute inset-0" />
          {/* Popup positioned in center without dark background */}
          <div
            className="relative bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 p-6 border-2 border-orange-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-800">Event Details</h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-1">Title</p>
                <p className="text-lg text-gray-800">{selectedEvent.title}</p>
              </div>
              
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-1">Date</p>
                <p className="text-gray-800">{new Date(selectedEvent.date).toLocaleDateString()}</p>
              </div>
              
              {selectedEvent.description && (
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Symptom Description</p>
                  <p className="text-gray-800">{selectedEvent.description}</p>
                </div>
              )}
              
              {selectedEvent.lifestyleChanges.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Lifestyle Changes</p>
                  <ul className="list-disc list-inside text-gray-800 space-y-1">
                    {selectedEvent.lifestyleChanges.map((change, idx) => (
                      <li key={idx}>{change}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {selectedEvent.medicationChanges.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Medication Changes</p>
                  <ul className="list-disc list-inside text-gray-800 space-y-1">
                    {selectedEvent.medicationChanges.map((change, idx) => (
                      <li key={idx}>{change}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Helper functions to prepare chart data from selectedPatientDetail
  const prepareSelectedPatientChartData = () => {
    if (!selectedPatientDetail) return { bpData: [], weightData: [], glucoseData: [] };

    const measurements = selectedPatientDetail.measurements || [];
    const profileWeight = selectedPatientDetail.profile?.weight || null;
    const goals = selectedPatientDetail.goals || {
      systolicMin: null,
      systolicMax: null,
      diastolicMin: null,
      diastolicMax: null,
      glucoseMin: null,
      glucoseMax: null,
      weightBaseline: null,
      weightDailyAlertThreshold: null,
      weightWeeklyAlertThreshold: null,
    };

    // BP Chart Data
    const bpData: BpPoint[] = measurements
      .filter(m => m.systolic !== null && m.diastolic !== null)
      .slice(0, 20)
      .reverse()
      .map((m) => {
        const date = new Date(m.date);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return {
          date: `${month}/${day}`,
          systolic: m.systolic as number,
          diastolic: m.diastolic as number,
          readable: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          timestamp: date.getTime(),
        };
      });

    // Weight Chart Data
    const weightData = measurements
      .filter(m => m.weight !== null || profileWeight !== null)
      .slice(0, 20)
      .reverse()
      .map((m) => {
        const date = new Date(m.date);
        return {
          date: `${date.getMonth() + 1}/${date.getDate()}`,
          weight: m.weight !== null ? m.weight : profileWeight,
          readable: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          timestamp: date.getTime(),
        };
      });

    // Glucose Chart Data
    const glucoseData = measurements
      .filter(m => m.glucose !== null)
      .slice(0, 20)
      .reverse()
      .map((m) => {
        const date = new Date(m.date);
        return {
          date: `${date.getMonth() + 1}/${date.getDate()}`,
          glucose: m.glucose as number,
          readable: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          timestamp: date.getTime(),
        };
      });

    return { bpData, weightData, glucoseData, goals };
  };

  // Helper function to get event lines for selected patient charts
  const getSelectedPatientEventLines = (chartData: ChartDataPoint[]) => {
    if (!chartData.length || !selectedPatientDetail?.events) return [];
    
    const events = selectedPatientDetail.events;
    
    // Helper to get date string (YYYY-MM-DD) from any date input
    const getDateString = (dateInput: string | number | Date): string => {
      const d = new Date(dateInput);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    
    // Get date range from chart data (oldest to newest)
    const firstDate = getDateString(chartData[0].timestamp);
    const lastDate = getDateString(chartData[chartData.length - 1].timestamp);
    
    return events
      .filter((event) => {
        const eventDate = getDateString(event.date);
        return eventDate >= firstDate && eventDate <= lastDate;
      })
      .map((event) => {
        const eventDate = new Date(event.date);
        // Find the index in chartData closest to this event
        const closestIndex = chartData.reduce((closest, point, index) => {
          const eventTime = eventDate.getTime();
          const currentDiff = Math.abs(point.timestamp - eventTime);
          const closestDiff = Math.abs(chartData[closest].timestamp - eventTime);
          return currentDiff < closestDiff ? index : closest;
        }, 0);
        
        return (
          <ReferenceLine
            key={event.id}
            x={chartData[closestIndex]?.readable}
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="5 5"
            label={
              <Label
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={(props: any) => {
                  if (!props || !props.viewBox) return null;
                  const viewBox = props.viewBox;
                  const x = typeof viewBox.x === 'number' ? viewBox.x : 0;
                  const y = typeof viewBox.y === 'number' ? viewBox.y : 0;
                  return (
                    <text
                      x={x}
                      y={y - 10}
                      fill="#f59e0b"
                      fontSize={16}
                      fontWeight="600"
                      textAnchor="middle"
                      style={{ cursor: "pointer" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(event);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = "0.8";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = "1";
                      }}
                    >
                      {event.title}
                    </text>
                  );
                }}
              />
            }
          />
        );
      });
  };

  // Chart rendering functions for selected patient
  const renderSelectedPatientBPChart = () => {
    const { bpData, goals } = prepareSelectedPatientChartData();
    const patientMetrics = selectedPatientDetail?.metrics;

    if (bpData.length === 0) {
      return (
        <div className="flex items-center justify-center h-80 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No blood pressure data available yet.</p>
        </div>
      );
    }

    const metrics = patientMetrics?.bp ? {
      percentInRange: patientMetrics.bp.percentInRange14d,
      avgSys: patientMetrics.bp.avgSys3d,
      avgDia: patientMetrics.bp.avgDia3d,
    } : null;

    return (
      <div>
        {metrics && (
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-sm text-gray-700 mb-1">
                % of BP Readings in Target Range (Last 14 Days)
              </p>
              <p className="text-lg font-bold text-blue-700">{metrics.percentInRange}%</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-sm text-gray-700 mb-1">3-Day Average Systolic BP</p>
              <p className="text-lg font-bold text-blue-700">{metrics.avgSys} mmHg</p>
            </div>
            <div className="bg-rose-50 rounded-lg p-3 border border-rose-200">
              <p className="text-sm text-gray-800 mb-1">3-Day Average Diastolic BP</p>
              <p className="text-lg font-bold text-rose-600">{metrics.avgDia} mmHg</p>
            </div>
          </div>
        )}
        <ResponsiveContainer width="100%" height={320} style={{ outline: 'none' }}>
          <LineChart data={bpData} margin={{ top: 40, right: 80, left: 60, bottom: 30 }} style={{ outline: 'none' }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="readable">
              <Label value="Date" position="bottom" offset={10} />
            </XAxis>
            <YAxis domain={[0, 160]} width={60}>
              <Label value="Blood Pressure (mmHg)" angle={-90} position="insideLeft" style={{ textAnchor: "middle" }} />
            </YAxis>
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" align="right" wrapperStyle={{ top: 0 }} />
            {goals && goals.systolicMin !== null && goals.systolicMax !== null && (
              <ReferenceArea y1={goals.systolicMin} y2={goals.systolicMax} fill="#86efac" fillOpacity={0.3} stroke="none" />
            )}
            {goals && goals.diastolicMin !== null && goals.diastolicMax !== null && (
              <ReferenceArea y1={goals.diastolicMin} y2={goals.diastolicMax} fill="#86efac" fillOpacity={0.3} stroke="none" />
            )}
            {getSelectedPatientEventLines(bpData)}
            <Line type="monotone" dataKey="systolic" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3, fill: "#3b82f6" }} name="Systolic BP" />
            <Line type="monotone" dataKey="diastolic" stroke="#e11d48" strokeWidth={3} dot={{ r: 3, fill: "#e11d48" }} name="Diastolic BP" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderSelectedPatientWeightChart = () => {
    const { weightData, goals } = prepareSelectedPatientChartData();
    const profileWeight = selectedPatientDetail?.profile?.weight || null;
    const patientMetrics = selectedPatientDetail?.metrics;

    if (weightData.length === 0 && !profileWeight) {
      return (
        <div className="flex items-center justify-center h-80 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No weight data available yet.</p>
        </div>
      );
    }

    const weightValues = weightData.length > 0 
      ? weightData.map(d => d.weight).filter((w): w is number => typeof w === 'number' && !isNaN(w))
      : profileWeight ? [profileWeight] : [];
    const minWeight = weightValues.length > 0 ? Math.min(...weightValues) : 150;
    const maxWeight = weightValues.length > 0 ? Math.max(...weightValues) : 200;
    const padding = 10;
    const yMin = Math.max(0, Math.floor((minWeight - padding) / 5) * 5);
    const yMax = Math.ceil((maxWeight + padding) / 5) * 5;
    const ticks: number[] = [];
    for (let i = yMin; i <= yMax; i += 5) {
      ticks.push(i);
    }

    const metrics = patientMetrics?.weight ? {
      change7d: patientMetrics.weight.change7d,
      weeklyAlert: patientMetrics.weight.weeklyAlert,
    } : null;

    return (
      <div>
        {metrics && (
          <div className="mb-4 grid grid-cols-1 gap-4">
            <div className={`rounded-lg p-3 border ${metrics.weeklyAlert ? "bg-red-50 border-red-200" : "bg-teal-50 border-teal-200"}`}>
              <p className="text-sm text-gray-700 mb-1">7-Day Change</p>
              <p className={`text-lg font-bold ${metrics.weeklyAlert ? "text-red-700" : "text-teal-700"}`}>
                {metrics.change7d !== null ? `${metrics.change7d > 0 ? "+" : ""}${metrics.change7d.toFixed(1)} lbs` : "N/A"}
                {metrics.weeklyAlert && " ⚠️"}
              </p>
            </div>
          </div>
        )}
        <ResponsiveContainer width="100%" height={320} style={{ outline: 'none' }}>
          <LineChart data={weightData} margin={{ top: 60, right: 30, left: 80, bottom: 20 }} style={{ outline: 'none' }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="readable" />
            <YAxis domain={[yMin, yMax]} ticks={ticks} width={60}>
              <Label value="Weight (lbs)" angle={-90} position="insideLeft" style={{ textAnchor: "middle" }} />
            </YAxis>
            <Tooltip content={((props: { active?: boolean; payload?: Array<{ payload: { readable: string; weight: number } }> }) => {
              if (props.active && props.payload && props.payload.length) {
                const data = props.payload[0].payload;
                return (
                  <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
                    <p className="font-semibold">{data.readable}</p>
                    <p className="text-teal-600">Weight: {data.weight} lbs</p>
                  </div>
                );
              }
              return null;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }) as any} />
            {goals && goals.weightBaseline !== null && (
              <ReferenceLine y={goals.weightBaseline} stroke="#10b981" strokeDasharray="3 3" label={{ value: "Baseline", position: "right" }} />
            )}
            {getSelectedPatientEventLines(weightData)}
            <Line type="monotone" dataKey="weight" stroke="#14b8a6" strokeWidth={2} dot={{ r: 4, fill: "#14b8a6" }} name="Weight" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderSelectedPatientGlucoseChart = () => {
    const { glucoseData, goals } = prepareSelectedPatientChartData();
    const patientMetrics = selectedPatientDetail?.metrics;

    if (glucoseData.length === 0) {
      return (
        <div className="flex items-center justify-center h-80 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No glucose data available yet.</p>
        </div>
      );
    }

    const glucoseValues = glucoseData.map(d => d.glucose).filter((g): g is number => typeof g === 'number' && !isNaN(g));
    const minGlucose = glucoseValues.length > 0 ? Math.min(...glucoseValues) : 80;
    const maxGlucose = glucoseValues.length > 0 ? Math.max(...glucoseValues) : 200;
    const padding = 20;
    const yMin = Math.max(0, Math.floor((minGlucose - padding) / 10) * 10);
    const yMax = Math.ceil((maxGlucose + padding) / 10) * 10;
    const finalYMin = goals && goals.glucoseMin !== null ? Math.min(yMin, Math.floor((goals.glucoseMin - padding) / 10) * 10) : yMin;
    const finalYMax = goals && goals.glucoseMax !== null ? Math.max(yMax, Math.ceil((goals.glucoseMax + padding) / 10) * 10) : yMax;
    const ticks: number[] = [];
    for (let i = finalYMin; i <= finalYMax; i += 10) {
      ticks.push(i);
    }

    const metrics = patientMetrics?.glucose ? {
      percentInRange: patientMetrics.glucose.percentInRange14d,
      avgGlucose: patientMetrics.glucose.avgGlucose3d,
    } : null;

    return (
      <div>
        {metrics && (
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
              <p className="text-sm text-gray-700 mb-1">% of Glucose Readings in Target Range (Last 14 Days)</p>
              <p className="text-lg font-bold text-purple-700">{metrics.percentInRange}%</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
              <p className="text-sm text-gray-700 mb-1">3-Day Average Glucose</p>
              <p className="text-lg font-bold text-purple-700">{metrics.avgGlucose} mg/dL</p>
            </div>
          </div>
        )}
        <ResponsiveContainer width="100%" height={320} style={{ outline: 'none' }}>
          <LineChart data={glucoseData} margin={{ top: 60, right: 30, left: 20, bottom: 20 }} style={{ outline: 'none' }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="readable" />
            <YAxis domain={[finalYMin, finalYMax]} ticks={ticks} width={60}>
              <Label value="Glucose (mg/dL)" angle={-90} position="insideLeft" style={{ textAnchor: "middle" }} />
            </YAxis>
            <Tooltip content={((props: { active?: boolean; payload?: Array<{ payload: { readable: string; glucose: number } }> }) => {
              if (props.active && props.payload && props.payload.length) {
                const data = props.payload[0].payload;
                return (
                  <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
                    <p className="font-semibold">{data.readable}</p>
                    <p className="text-purple-600">Glucose: {data.glucose} mg/dL</p>
                  </div>
                );
              }
              return null;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }) as any} />
            {goals && goals.glucoseMin !== null && goals.glucoseMax !== null && (
              <ReferenceArea y1={goals.glucoseMin} y2={goals.glucoseMax} fill="#86efac" fillOpacity={0.3} stroke="none" />
            )}
            {getSelectedPatientEventLines(glucoseData)}
            <Line type="monotone" dataKey="glucose" stroke="#a855f7" strokeWidth={2} dot={{ r: 4, fill: "#a855f7" }} name="Glucose" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // ---------------- PHYSICIAN VIEW ----------------
  const renderPhysicianView = () => {
    if (loadingPhysicianPatients) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading patients...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Dashboard buckets */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Patient Triage Dashboard</h2>
            <p className="text-sm text-gray-500">Click on a patient card to view detailed information</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Urgent */}
            <div className="border border-red-200 rounded-lg p-3 bg-red-50/40">
              <p className="text-lg font-semibold text-red-700 mb-2">Urgent</p>
              <div className="space-y-2">
                {physicianPatients
                  .filter((p) => p.urgency === "urgent")
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={async () => {
                        setSelectedPatientId(p.id);
                        setShowPatientDetail(true);
                        await fetchPatientDetail(p.id);
                      }}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedPatientId === p.id ? "bg-red-100" : "bg-white hover:bg-red-50"
                      }`}
                    >
                      <p className="font-semibold text-gray-800">{p.name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {p.conditions.length > 0 ? p.conditions.join(", ") : "No conditions listed"}
                      </p>
                      <p className="text-sm text-gray-600 mt-2">{p.summary}</p>
                      {p.analysisDate && (
                        <p className="text-sm text-gray-400 mt-1">
                          {new Date(p.analysisDate).toLocaleDateString()}
                        </p>
                      )}
                    </button>
                  ))}
                {physicianPatients.filter((p) => p.urgency === "urgent").length === 0 && (
                  <p className="text-lg text-gray-500 text-center py-4">No urgent patients</p>
                )}
              </div>
            </div>

            {/* Monitor */}
            <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/40">
              <p className="text-lg font-semibold text-amber-700 mb-2">Monitor</p>
              <div className="space-y-2">
                {physicianPatients
                  .filter((p) => p.urgency === "monitor")
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={async () => {
                        setSelectedPatientId(p.id);
                        setShowPatientDetail(true);
                        await fetchPatientDetail(p.id);
                      }}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedPatientId === p.id ? "bg-amber-100" : "bg-white hover:bg-amber-50"
                      }`}
                    >
                      <p className="font-semibold text-gray-800">{p.name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {p.conditions.length > 0 ? p.conditions.join(", ") : "No conditions listed"}
                      </p>
                      <p className="text-sm text-gray-600 mt-2">{p.summary}</p>
                      {p.analysisDate && (
                        <p className="text-sm text-gray-400 mt-1">
                          {new Date(p.analysisDate).toLocaleDateString()}
                        </p>
                      )}
                    </button>
                  ))}
                {physicianPatients.filter((p) => p.urgency === "monitor").length === 0 && (
                  <p className="text-lg text-gray-500 text-center py-4">No patients to monitor</p>
                )}
              </div>
            </div>

            {/* Stable */}
            <div className="border border-emerald-200 rounded-lg p-3 bg-emerald-50/40">
              <p className="text-lg font-semibold text-emerald-700 mb-2">Stable</p>
              <div className="space-y-2">
                {physicianPatients
                  .filter((p) => p.urgency === "stable")
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={async () => {
                        setSelectedPatientId(p.id);
                        setShowPatientDetail(true);
                        await fetchPatientDetail(p.id);
                      }}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedPatientId === p.id ? "bg-emerald-100" : "bg-white hover:bg-emerald-50"
                      }`}
                    >
                      <p className="font-semibold text-gray-800">{p.name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {p.conditions.length > 0 ? p.conditions.join(", ") : "No conditions listed"}
                      </p>
                      <p className="text-sm text-gray-600 mt-2">{p.summary}</p>
                      {p.analysisDate && (
                        <p className="text-sm text-gray-400 mt-1">
                          {new Date(p.analysisDate).toLocaleDateString()}
                        </p>
                      )}
                    </button>
                  ))}
                {physicianPatients.filter((p) => p.urgency === "stable").length === 0 && (
                  <p className="text-lg text-gray-500 text-center py-4">No stable patients</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Patient Detail View */}
        {showPatientDetail && selectedPatientDetail && selectedPatientId && (
          <div className="bg-white rounded-lg shadow-md p-6">
            {loadingPatientDetail ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading patient details...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <User className="w-6 h-6 text-blue-600" />
                    {selectedPatientDetail.profile?.name || "Unknown Patient"}
                  </h2>
                </div>

                {/* Patient Profile Section */}
                {selectedPatientDetail.profile && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Patient Profile</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Left Column */}
                      <div className="space-y-3">
                        {selectedPatientDetail.profile.dob && (
                          <div>
                            <p className="text-xs text-gray-600">Date of Birth</p>
                            <p className="text-sm font-medium">{new Date(selectedPatientDetail.profile.dob).toLocaleDateString()}</p>
                          </div>
                        )}
                        {selectedPatientDetail.profile.sex && (
                          <div>
                            <p className="text-xs text-gray-600">Sex</p>
                            <p className="text-sm font-medium">{selectedPatientDetail.profile.sex}</p>
                          </div>
                        )}
                        {selectedPatientDetail.profile.height && (
                          <div>
                            <p className="text-xs text-gray-600">Height</p>
                            <p className="text-sm font-medium">{selectedPatientDetail.profile.height} cm</p>
                          </div>
                        )}
                        {selectedPatientDetail.profile.weight && (
                          <div>
                            <p className="text-xs text-gray-600">Weight</p>
                            <p className="text-sm font-medium">{selectedPatientDetail.profile.weight} lbs</p>
                          </div>
                        )}
                        {selectedPatientDetail.profile.conditions.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Conditions</p>
                            <ul className="space-y-0.5">
                              {selectedPatientDetail.profile.conditions.map((condition, idx) => (
                                <li key={idx} className="text-sm text-gray-700">
                                  {condition}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {selectedPatientDetail.profile.allergies.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Allergies</p>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedPatientDetail.profile.allergies.map((allergy, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs">
                                  {allergy}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Right Column */}
                      <div className="space-y-3">
                        {selectedPatientDetail.profile.medications.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Medications</p>
                            <ul className="space-y-0.5">
                              {selectedPatientDetail.profile.medications.map((med, idx) => (
                                <li key={idx} className="text-sm text-gray-700">
                                  <span className="font-medium">{med.name}</span> - {med.dosage}, {med.frequency}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {selectedPatientDetail.profile.familyHistoryHeartDisease && (
                          <div>
                            <p className="text-xs text-gray-600">Family History</p>
                            <p className="text-sm font-medium">{selectedPatientDetail.profile.familyHistoryHeartDisease}</p>
                          </div>
                        )}
                        {selectedPatientDetail.profile.smokingHistory && (
                          <div>
                            <p className="text-xs text-gray-600">Smoking History</p>
                            <p className="text-sm font-medium">{selectedPatientDetail.profile.smokingHistory}</p>
                            {selectedPatientDetail.profile.smokingDetails && (
                              <p className="text-xs text-gray-600 mt-0.5">{selectedPatientDetail.profile.smokingDetails}</p>
                            )}
                          </div>
                        )}
                        {selectedPatientDetail.profile.alcoholUse && (
                          <div>
                            <p className="text-xs text-gray-600">Alcohol Use</p>
                            <p className="text-sm font-medium">{selectedPatientDetail.profile.alcoholUse}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary Section */}
                {selectedPatientDetail.analysis && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Summary</h3>
                    <p className="text-base text-gray-700">{selectedPatientDetail.analysis.summary}</p>
                  </div>
                )}

                {/* Key Concerns Section */}
                {selectedPatientDetail.analysis && selectedPatientDetail.analysis.reasons.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Key Concerns</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {selectedPatientDetail.analysis.reasons.map((reason, idx) => (
                        <li key={idx} className="text-base text-gray-700">{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Timelines Section */}
                <div className="mb-6 space-y-6">
                    {/* Blood Pressure Chart */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">
                        Blood Pressure Timeline
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Green shaded band shows the target blood pressure range set for this patient; lines show actual systolic and diastolic readings over time.
                      </p>
                      <div className="mb-4">{renderSelectedPatientBPChart()}</div>
                    </div>

                    {/* Weight Chart */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">
                        Weight Timeline
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Line shows recorded weights over time; alerts are based on 7-day weight change relative to the patient&apos;s baseline.
                      </p>
                      <div className="mb-4">{renderSelectedPatientWeightChart()}</div>
                    </div>

                    {/* Glucose Chart */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">
                        Glucose (Fasting) Timeline
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Green shaded band shows the target fasting glucose range set for this patient; the line shows actual fasting glucose readings over time.
                      </p>
                      <div className="mb-4">{renderSelectedPatientGlucoseChart()}</div>
                    </div>
                  </div>

                {/* Target Ranges & Thresholds Section */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Target Ranges & Thresholds</h3>
                    {!editingGoals && (
                      <button
                        onClick={() => {
                          setGoalFormData(selectedPatientDetail.goals ? { ...selectedPatientDetail.goals } : {
                            systolicMin: null,
                            systolicMax: null,
                            diastolicMin: null,
                            diastolicMax: null,
                            glucoseMin: null,
                            glucoseMax: null,
                            weightBaseline: null,
                            weightDailyAlertThreshold: null,
                            weightWeeklyAlertThreshold: null,
                          });
                          setEditingGoals(true);
                        }}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Edit Goals
                      </button>
                    )}
                  </div>
                  {editingGoals ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Blood Pressure */}
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-gray-700">Blood Pressure (mmHg)</p>
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs text-gray-600">Systolic Min</label>
                              <input
                                type="number"
                                value={goalFormData?.systolicMin ?? ""}
                                onChange={(e) => setGoalFormData(prev => prev ? { ...prev, systolicMin: e.target.value ? parseFloat(e.target.value) : null } : null)}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                placeholder="e.g., 100"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Systolic Max</label>
                              <input
                                type="number"
                                value={goalFormData?.systolicMax ?? ""}
                                onChange={(e) => setGoalFormData(prev => prev ? { ...prev, systolicMax: e.target.value ? parseFloat(e.target.value) : null } : null)}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                placeholder="e.g., 130"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Diastolic Min</label>
                              <input
                                type="number"
                                value={goalFormData?.diastolicMin ?? ""}
                                onChange={(e) => setGoalFormData(prev => prev ? { ...prev, diastolicMin: e.target.value ? parseFloat(e.target.value) : null } : null)}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                placeholder="e.g., 60"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Diastolic Max</label>
                              <input
                                type="number"
                                value={goalFormData?.diastolicMax ?? ""}
                                onChange={(e) => setGoalFormData(prev => prev ? { ...prev, diastolicMax: e.target.value ? parseFloat(e.target.value) : null } : null)}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                placeholder="e.g., 80"
                              />
                            </div>
                          </div>
                        </div>
                        {/* Glucose */}
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-gray-700">Glucose (mg/dL)</p>
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs text-gray-600">Min</label>
                              <input
                                type="number"
                                value={goalFormData?.glucoseMin ?? ""}
                                onChange={(e) => setGoalFormData(prev => prev ? { ...prev, glucoseMin: e.target.value ? parseFloat(e.target.value) : null } : null)}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                placeholder="e.g., 70"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Max</label>
                              <input
                                type="number"
                                value={goalFormData?.glucoseMax ?? ""}
                                onChange={(e) => setGoalFormData(prev => prev ? { ...prev, glucoseMax: e.target.value ? parseFloat(e.target.value) : null } : null)}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                placeholder="e.g., 100"
                              />
                            </div>
                          </div>
                        </div>
                        {/* Weight */}
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-gray-700">Weight (lbs)</p>
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs text-gray-600">Baseline</label>
                              <input
                                type="number"
                                value={goalFormData?.weightBaseline ?? ""}
                                onChange={(e) => setGoalFormData(prev => prev ? { ...prev, weightBaseline: e.target.value ? parseFloat(e.target.value) : null } : null)}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                placeholder="e.g., 180"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Daily Alert Threshold</label>
                              <input
                                type="number"
                                value={goalFormData?.weightDailyAlertThreshold ?? ""}
                                onChange={(e) => setGoalFormData(prev => prev ? { ...prev, weightDailyAlertThreshold: e.target.value ? parseFloat(e.target.value) : null } : null)}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                placeholder="e.g., 3"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Weekly Alert Threshold</label>
                              <input
                                type="number"
                                value={goalFormData?.weightWeeklyAlertThreshold ?? ""}
                                onChange={(e) => setGoalFormData(prev => prev ? { ...prev, weightWeeklyAlertThreshold: e.target.value ? parseFloat(e.target.value) : null } : null)}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                placeholder="e.g., 5"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            setEditingGoals(false);
                            setGoalFormData(null);
                          }}
                          disabled={savingGoals}
                          className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            if (!goalFormData || !selectedPatientId) return;
                            try {
                              setSavingGoals(true);
                              const response = await fetch("/api/patient/goals", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  patientId: selectedPatientId,
                                  ...goalFormData,
                                }),
                              });
                              if (response.ok) {
                                const data = await response.json();
                                if (data.success) {
                                  // Refresh patient detail to get updated goals
                                  await fetchPatientDetail(selectedPatientId);
                                  setEditingGoals(false);
                                  setGoalFormData(null);
                                }
                              }
                            } catch (error) {
                              console.error("Error saving goals:", error);
                            } finally {
                              setSavingGoals(false);
                            }
                          }}
                          disabled={savingGoals}
                          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {savingGoals ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  ) : selectedPatientDetail.goals ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Systolic BP */}
                      <div>
                        <p className="text-base text-gray-600 mb-2">Systolic BP</p>
                        <div className="border-2 border-blue-500 rounded-lg p-3 bg-blue-50">
                          <p className="text-sm text-gray-600 mb-1">Target Range</p>
                          <p className="text-lg font-semibold text-blue-700">
                            {selectedPatientDetail.goals.systolicMin ?? "Not set"} - {selectedPatientDetail.goals.systolicMax ?? "Not set"} mmHg
                          </p>
                        </div>
                      </div>
                      {/* Diastolic BP */}
                      <div>
                        <p className="text-base text-gray-600 mb-2">Diastolic BP</p>
                        <div className="border-2 border-rose-500 rounded-lg p-3 bg-rose-50">
                          <p className="text-sm text-gray-600 mb-1">Target Range</p>
                          <p className="text-lg font-semibold text-rose-700">
                            {selectedPatientDetail.goals.diastolicMin ?? "Not set"} - {selectedPatientDetail.goals.diastolicMax ?? "Not set"} mmHg
                          </p>
                        </div>
                      </div>
                      {/* Glucose */}
                      <div>
                        <p className="text-base text-gray-600 mb-2">Glucose</p>
                        <div className="border-2 border-purple-500 rounded-lg p-3 bg-purple-50">
                          <p className="text-sm text-gray-600 mb-1">Target Range</p>
                          <p className="text-lg font-semibold text-purple-700">
                            {selectedPatientDetail.goals.glucoseMin ?? "Not set"} - {selectedPatientDetail.goals.glucoseMax ?? "Not set"} mg/dL
                          </p>
                        </div>
                      </div>
                      {/* Weight */}
                      <div>
                        <p className="text-base text-gray-600 mb-2">Weight</p>
                        <div className="border-2 border-teal-500 rounded-lg p-3 bg-teal-50">
                          <p className="text-sm text-gray-600 mb-1">Baseline</p>
                          <p className="text-lg font-semibold text-teal-700 mb-2">
                            {selectedPatientDetail.goals.weightBaseline ?? "Not set"} lbs
                          </p>
                          <p className="text-sm text-gray-600 mb-1">Daily Alert</p>
                          <p className="text-lg font-semibold text-teal-700 mb-2">
                            ±{selectedPatientDetail.goals.weightDailyAlertThreshold ?? "Not set"} lbs
                          </p>
                          <p className="text-sm text-gray-600 mb-1">Weekly Alert</p>
                          <p className="text-lg font-semibold text-teal-700">
                            ±{selectedPatientDetail.goals.weightWeeklyAlertThreshold ?? "Not set"} lbs
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No goals set for this patient.</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <Heart className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">CardioCare</h1>
                <p className="text-gray-600">AI-Powered Chronic Care Management for Cardiovascular Diseases</p>
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end gap-2">
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-800">{session?.user?.name || "User"}</p>
                  <p className="text-xs text-gray-500 capitalize">{userRole}</p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        {isPatient && renderPatientView()}
        {isPhysician && renderPhysicianView()}
      </div>
    </div>
  );
};

export default CardiologyMVP;
