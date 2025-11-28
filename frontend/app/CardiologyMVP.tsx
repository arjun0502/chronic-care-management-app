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
  ResponsiveContainer,
  Label,
} from "recharts";
import { Calendar, Pill, Activity, User, Heart, MessageCircle, LogOut } from "lucide-react";

type PhysicianStatus = "urgent" | "monitor" | "stable";
type ActiveTab = "profile" | "data" | "chat" | "timeline";

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
  bloodPressure: string;
  systolic: string;
  diastolic: string;
  weight: string;
  glucose: string;
  systolicGoal: number;
  diastolicGoal: number;
  weightGoal: number | null;
  glucoseGoal: number;
};

type TooltipProps = {
  active?: boolean;
  payload?: { payload: BpPoint }[];
};

const CardiologyMVP = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("profile");
  const [selectedPatientId, setSelectedPatientId] = useState("john-smith");
  
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
      systolicGoal: number | null;
      diastolicGoal: number | null;
      weightGoal: number | null;
      glucoseGoal: number | null;
    } | null;
  } | null>(null);
  const [events, setEvents] = useState<Array<{
    id: string;
    date: string;
    title: string;
    description: string | null;
    type: string | null;
  }>>([]);
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

  // State for patient analyses (physician view) - must be before any returns
  const [patientAnalyses, setPatientAnalyses] = useState<Record<string, {
    summary: string;
    urgency: "urgent" | "monitor" | "stable";
    urgencyScore: number;
    reasons: string[];
    keyConcerns: string[];
    lastUpdated?: Date;
  }>>({});

  // State for measurements (3 measurements per metric) - must be before any returns
  const [measurements, setMeasurements] = useState({
    bloodPressure: [
      { systolic: "", diastolic: "" },
      { systolic: "", diastolic: "" },
      { systolic: "", diastolic: "" },
    ],
    glucose: ["", "", ""],
    weight: "",
    dateTime: new Date().toISOString().slice(0, 16),
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

  // Load patient analyses when physician view is active (must be before early returns)
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (session.user.role !== "physician") return;

    const loadPatientAnalyses = async () => {
      // TODO: Replace with actual patient IDs from database
      // For now, this is a placeholder - will need to fetch actual patients from physician-patient relationships
      // The hardcoded physicianPatients array doesn't have real patient IDs
      // This will be implemented when we connect to real patient data
    };

    loadPatientAnalyses();
  }, [status, session]);

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

  // Get latest measurements for current metrics
  const getLatestMeasurement = () => {
    if (historicalMeasurements.length === 0) return null;
    return historicalMeasurements[0]; // Already sorted by date desc
  };

  const latestMeasurement = getLatestMeasurement();
  
  // Calculate current metrics from latest measurement, with weight fallback to profile weight
  // Separate systolic and diastolic for BP
  const currentMetrics = latestMeasurement ? {
    weight: latestMeasurement.weight 
      ? `${Math.round(latestMeasurement.weight)} lbs`
      : (patientProfile?.weight ? `${Math.round(patientProfile.weight)} lbs` : "N/A"),
    systolic: latestMeasurement.systolic 
      ? `${Math.round(latestMeasurement.systolic)} mmHg`
      : "N/A",
    diastolic: latestMeasurement.diastolic 
      ? `${Math.round(latestMeasurement.diastolic)} mmHg`
      : "N/A",
    glucose: latestMeasurement.glucose ? `${Math.round(latestMeasurement.glucose)} mg/dL` : "N/A",
  } : {
    weight: patientProfile?.weight ? `${Math.round(patientProfile.weight)} lbs` : "N/A",
    systolic: "N/A",
    diastolic: "N/A",
    glucose: "N/A",
  };

  // Use personalized goals from database (Goal table). If goals don't exist at all,
  // fall back to reasonable defaults, but never override what is stored in the DB.
  // Separate systolic and diastolic goals for display.
  const goals: Goals = patientProfile?.goals ? {
    bloodPressure: patientProfile.goals.systolicGoal !== null && patientProfile.goals.diastolicGoal !== null
      ? `< ${patientProfile.goals.systolicGoal}/${patientProfile.goals.diastolicGoal} mmHg`
      : patientProfile.goals.systolicGoal !== null
      ? `< ${patientProfile.goals.systolicGoal}/${patientProfile.goals.diastolicGoal ?? 80} mmHg`
      : "< 130/80 mmHg",
    systolic: patientProfile.goals.systolicGoal !== null ? `< ${patientProfile.goals.systolicGoal} mmHg` : "< 130 mmHg",
    diastolic: patientProfile.goals.diastolicGoal !== null ? `< ${patientProfile.goals.diastolicGoal} mmHg` : "< 80 mmHg",
    // Weight goal display: use weightGoal from DB if set, otherwise show "Not set"
    weight: patientProfile.goals.weightGoal !== null
      ? `${patientProfile.goals.weightGoal} lbs`
      : "Not set",
    glucose: patientProfile.goals.glucoseGoal !== null ? `< ${patientProfile.goals.glucoseGoal} mg/dL` : "< 130 mg/dL",
    // Raw goal values from database - use null if not set, fallback only if goals object doesn't exist
    systolicGoal: patientProfile.goals.systolicGoal ?? 130,
    diastolicGoal: patientProfile.goals.diastolicGoal ?? 80,
    // For numeric comparisons in charts, only use the weight goal stored in DB
    weightGoal: patientProfile.goals.weightGoal,
    glucoseGoal: patientProfile.goals.glucoseGoal ?? 130,
  } : {
    bloodPressure: "< 130/80 mmHg",
    systolic: "< 130 mmHg",
    diastolic: "< 80 mmHg",
    weight: "Not set",
    glucose: "< 130 mg/dL",
    systolicGoal: 130,
    diastolicGoal: 80,
    weightGoal: null,
    glucoseGoal: 130,
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

  // Physician dashboard patients
  const physicianPatients: {
    id: string;
    name: string;
    age: number;
    status: PhysicianStatus;
    lastCheckIn: string;
    keyIssue: string;
    summary: string;
    medChanges: string;
    lifestyle: string;
  }[] = [
    {
      id: "john-smith",
      name: "John Smith",
      age: 70,
      status: "urgent",
      lastCheckIn: "2 hours ago",
      keyIssue: "Rising systolic BP and new chest discomfort",
      summary:
        "Reports intermittent chest tightness with exertion and mild shortness of breath.",
      medChanges: "Started Lisinopril 10mg on Oct 22; Metoprolol titrated 1 month ago.",
      lifestyle: "Walking 10–15 min/day; sleep fragmented (5–6 hrs); diet high in sodium.",
    },
    {
      id: "maria-garcia",
      name: "Maria Garcia",
      age: 63,
      status: "monitor",
      lastCheckIn: "Yesterday",
      keyIssue: "Occasional palpitations, BP near goal",
      summary: "Stable CAD with rare palpitations; no chest pain reported.",
      medChanges: "No recent changes; adherent to beta-blocker and statin.",
      lifestyle: "Walking 30 min most days; working on reducing sugar intake.",
    },
    {
      id: "david-lee",
      name: "David Lee",
      age: 58,
      status: "stable",
      lastCheckIn: "4 days ago",
      keyIssue: "BP and lipids at goal, asymptomatic",
      summary: "Feels well, no chest pain, dyspnea, or edema.",
      medChanges: "On stable regimen for past 6 months.",
      lifestyle: "Regular cycling 3x/week; following low-sodium diet.",
    },
  ];

  const selectedPatient =
    physicianPatients.find((p) => p.id === selectedPatientId) || physicianPatients[0];


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
    
    return events
      .filter((event) => {
        const eventDate = new Date(event.date).getTime();
        const firstDataPoint = chartData[0].timestamp;
        const lastDataPoint = chartData[chartData.length - 1].timestamp;
        return eventDate >= firstDataPoint && eventDate <= lastDataPoint;
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
            label={{ value: event.title, position: "top", fill: "#f59e0b", fontSize: 12 }}
          />
        );
      });
  };

  const renderBPChart = () => {
    if (bpData.length === 0) {
      return (
        <div className="flex items-center justify-center h-80 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No blood pressure data available yet. Record your first measurement to see trends here.</p>
        </div>
      );
    }
    // Use goals from database (Goal table). If no goals row, fall back to defaults.
    const sysGoal = goals.systolicGoal;
    const diaGoal = goals.diastolicGoal;
    
    return (
      <ResponsiveContainer width="100%" height={320}>
        {/* Extra right margin so right-side goal labels are fully visible */}
        <LineChart data={bpData} margin={{ top: 40, right: 80, left: 60, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="readable">
            {/* Place Date label just below the X-axis ticks, outside the chart area */}
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
          <ReferenceLine
            y={sysGoal}
            stroke="#ef4444"
            strokeDasharray="3 3"
            label={{ value: `Goal: ${sysGoal}`, position: "right", offset: 5 }}
          />
          <ReferenceLine
            y={diaGoal}
            stroke="#22c55e"
            strokeDasharray="3 3"
            label={{ value: `Goal: ${diaGoal}`, position: "right", offset: 5 }}
          />
          {getEventLines(bpData)}
          {/* Show lines connecting points with visible colored dots */}
          <Line
            type="monotone"
            dataKey="systolic"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ r: 5, fill: "#3b82f6" }}
            name="Systolic BP"
          />
          <Line
            type="monotone"
            dataKey="diastolic"
            stroke="#22c55e"
            strokeWidth={3}
            dot={{ r: 5, fill: "#22c55e" }}
            name="Diastolic BP"
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderWeightChart = () => {
    if (weightData.length === 0 && !profileWeight) {
      return (
        <div className="flex items-center justify-center h-80 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No weight data available yet.</p>
        </div>
      );
    }
    // Use weight goal from database (Goal table)
    const weightGoal = goals.weightGoal;
    
    return (
      <ResponsiveContainer width="100%" height={320}>
        <LineChart
          data={weightData.length > 0 ? weightData : [{ readable: "Profile", weight: profileWeight }]}
          margin={{ top: 20, right: 80, left: 60, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="readable">
            <Label value="Date" position="bottom" offset={10} />
          </XAxis>
          <YAxis width={60}>
            <Label
              value="Weight (lbs)"
              angle={-90}
              position="insideLeft"
              style={{ textAnchor: "middle" }}
            />
          </YAxis>
          <Tooltip />
          {/* Single line, so legend not needed */}
          {weightGoal && (
            <ReferenceLine
              y={weightGoal}
              stroke="#ef4444"
              strokeDasharray="3 3"
              label={{ value: `Goal: ${weightGoal}`, position: "right", offset: 5 }}
            />
          )}
          {weightData.length > 0 && getEventLines(weightData)}
          {/* Show line connecting points with visible colored dots */}
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#10b981"
            strokeWidth={3}
            dot={{ r: 5, fill: "#10b981" }}
            name="Weight"
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderCurrentMetricsVsGoals = () => {
    const metrics = [
      { key: "systolic", label: "Systolic Blood Pressure", current: currentMetrics.systolic, goal: goals.systolic, goalValue: goals.systolicGoal },
      { key: "diastolic", label: "Diastolic Blood Pressure", current: currentMetrics.diastolic, goal: goals.diastolic, goalValue: goals.diastolicGoal },
      { key: "weight", label: "Weight", current: currentMetrics.weight, goal: goals.weight, goalValue: goals.weightGoal },
      { key: "glucose", label: "Glucose", current: currentMetrics.glucose, goal: goals.glucose, goalValue: goals.glucoseGoal },
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metrics.map((metric) => {
          let isAtGoal = false;
          const current = metric.current;
          const goalValue = metric.goalValue;

          if (current !== "N/A" && goalValue !== null && goalValue !== undefined) {
            if (metric.key === "systolic" || metric.key === "diastolic" || metric.key === "glucose") {
              const numVal = parseInt(current, 10);
              if (metric.key === "systolic" || metric.key === "glucose") {
                isAtGoal = numVal < goalValue;
              } else if (metric.key === "diastolic") {
                isAtGoal = numVal < goalValue;
              }
            } else if (metric.key === "weight") {
              const weightVal = parseFloat(current);
              isAtGoal = weightVal <= goalValue;
            }
          }

          return (
            <div
              key={metric.key}
              className={`p-4 rounded-lg ${current === "N/A" ? "bg-gray-50" : isAtGoal ? "bg-green-50" : "bg-yellow-50"}`}
            >
              <p className="text-sm text-gray-600 mb-1">{metric.label}</p>
              <p className="text-2xl font-bold text-gray-800">{current}</p>
              <p className="text-sm mt-1">
                <span className="text-gray-600">Goal: </span>
                <span className="font-medium">{metric.goal}</span>
              </p>
              {current !== "N/A" && goalValue !== null && goalValue !== undefined && (
                <div className="mt-2">
                  {isAtGoal ? (
                    <span className="text-green-600 text-sm font-medium">✓ At Goal</span>
                  ) : (
                    <span className="text-orange-600 text-sm font-medium">⚠ Above Goal</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Form submission handler
  const handleSubmitMeasurements = async () => {
    // Validate that at least one measurement is provided
    const hasBP = measurements.bloodPressure.some(bp => bp.systolic && bp.diastolic);
    const hasGlucose = measurements.glucose.some(g => g);

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
        alert("Measurements saved successfully!");
        // Reset form
        setMeasurements({
          bloodPressure: [
            { systolic: "", diastolic: "" },
            { systolic: "", diastolic: "" },
            { systolic: "", diastolic: "" },
          ],
          glucose: ["", "", ""],
          weight: "",
          dateTime: new Date().toISOString().slice(0, 16),
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
          <button
            onClick={() => setActiveTab("timeline")}
            className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
              activeTab === "timeline"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span>Timeline & Trends</span>
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
                  <p className="text-sm text-gray-500">{patientProfile.physician.email}</p>
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
                <label className="block text-lg font-semibold text-gray-800 mb-3">
                  Blood Pressure
                </label>
                <p className="text-xs text-gray-600 mb-4">
                  Take 3 measurements and enter all values. We&apos;ll average them automatically.
                </p>
                {[0, 1, 2].map((index) => (
                  <div key={index} className="mb-4 pb-4 border-b border-gray-200 last:border-b-0">
                    <p className="text-sm font-medium text-gray-700 mb-2">Measurement {index + 1}</p>
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
                        <p className="text-xs text-gray-500 mt-1">mmHg</p>
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
                        <p className="text-xs text-gray-500 mt-1">mmHg</p>
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
                <p className="text-xs text-gray-500 mt-1">pounds (lbs)</p>
              </div>

              {/* Glucose */}
              <div className="p-4 border-2 border-purple-200 rounded-lg">
                <label className="block text-lg font-semibold text-gray-800 mb-3">
                  Blood Glucose
                </label>
                <p className="text-xs text-gray-600 mb-4">
                  Take 3 measurements and enter all values.
                </p>
                {[0, 1, 2].map((index) => (
                  <div key={index} className="mb-4">
                    <label className="block text-sm text-gray-600 mb-2">
                      Measurement {index + 1}
                    </label>
                    <input
                      type="number"
                      placeholder="110"
                      value={measurements.glucose[index]}
                      onChange={(e) => {
                        const newGlucose = [...measurements.glucose];
                        newGlucose[index] = e.target.value;
                        setMeasurements({ ...measurements, glucose: newGlucose });
                      }}
                      className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">mg/dL (fasting)</p>
                  </div>
                ))}
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
                        <MessageCircle className="w-5 h-5 text-blue-600" />
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
                          <MessageCircle className="w-5 h-5 text-blue-600" />
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
                        <MessageCircle className="w-5 h-5 text-blue-600" />
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
              <p className="text-xs text-gray-500 mt-2">
                💡 Tip: Mention any symptoms, medication changes, or lifestyle updates. Your responses
                help us provide better care.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === "timeline" && (
        <div className="space-y-6">
          {/* Blood Pressure Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Blood Pressure Timeline</h2>
            <div className="mb-4">{renderBPChart()}</div>
          </div>

          {/* Weight Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Weight Timeline</h2>
            <div className="mb-4">{renderWeightChart()}</div>
          </div>

          {/* Events List */}
          {events.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800">Recent Events</h3>
                <p className="text-xs text-gray-500">
                  Events are shown as vertical lines in the charts above
                </p>
              </div>
              <div className="space-y-2">
                {events.slice().reverse().map((event) => (
                  <div key={event.id} className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg">
                    <div className="bg-orange-200 p-2 rounded-full">
                      <Pill className="w-4 h-4 text-orange-800" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{event.title}</p>
                      <p className="text-sm text-gray-600">{new Date(event.date).toLocaleDateString()}</p>
                      {event.description && (
                        <p className="text-xs text-gray-500 mt-1">{event.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Metrics vs Goals */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Current Metrics vs Goals</h3>
            {renderCurrentMetricsVsGoals()}
          </div>
        </div>
      )}
    </>
  );

  // ---------------- PHYSICIAN VIEW ----------------
  const renderPhysicianView = () => (
    <div className="space-y-6">
      {/* Dashboard buckets */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Patient Triage Dashboard</h2>
          <p className="text-sm text-gray-500">Grouped by clinical urgency</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Urgent */}
          <div className="border border-red-200 rounded-lg p-3 bg-red-50/40">
            <p className="text-sm font-semibold text-red-700 mb-2">Urgent</p>
            <div className="space-y-2">
              {physicianPatients
                .filter((p) => p.status === "urgent")
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedPatientId === p.id ? "bg-red-100" : "bg-white hover:bg-red-50"
                    }`}
                  >
                    <p className="font-semibold text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-500">
                      Age {p.age} • {p.lastCheckIn}
                    </p>
                    <p className="text-xs text-red-700 mt-1">{p.keyIssue}</p>
                  </button>
                ))}
            </div>
          </div>

          {/* Monitor */}
          <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/40">
            <p className="text-sm font-semibold text-amber-700 mb-2">Monitor</p>
            <div className="space-y-2">
              {physicianPatients
                .filter((p) => p.status === "monitor")
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedPatientId === p.id ? "bg-amber-100" : "bg-white hover:bg-amber-50"
                    }`}
                  >
                    <p className="font-semibold text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-500">
                      Age {p.age} • {p.lastCheckIn}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">{p.keyIssue}</p>
                  </button>
                ))}
            </div>
          </div>

          {/* Stable */}
          <div className="border border-emerald-200 rounded-lg p-3 bg-emerald-50/40">
            <p className="text-sm font-semibold text-emerald-700 mb-2">Stable</p>
            <div className="space-y-2">
              {physicianPatients
                .filter((p) => p.status === "stable")
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedPatientId === p.id ? "bg-emerald-100" : "bg-white hover:bg-emerald-50"
                    }`}
                  >
                    <p className="font-semibold text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-500">
                      Age {p.age} • {p.lastCheckIn}
                    </p>
                    <p className="text-xs text-emerald-700 mt-1">{p.keyIssue}</p>
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selected patient report */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <User className="w-6 h-6 text-blue-600" />
              {selectedPatient.name}
            </h2>
            <p className="text-sm text-gray-600">
              Age {selectedPatient.age} • Status:{" "}
              <span
                className={
                  selectedPatient.status === "urgent"
                    ? "text-red-600"
                    : selectedPatient.status === "monitor"
                    ? "text-amber-600"
                    : "text-emerald-600"
                }
              >
                {selectedPatient.status.charAt(0).toUpperCase() +
                  selectedPatient.status.slice(1)}
              </span>
            </p>
          </div>
          <p className="text-xs text-gray-500">Last check-in: {selectedPatient.lastCheckIn}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Quick profile */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700 mb-2">Quick Profile</p>
            <ul className="text-xs text-gray-700 space-y-1">
              <li>
                <span className="font-medium">Key diagnoses:</span> Coronary artery disease,
                hypertension, type 2 diabetes
              </li>
              <li>
                <span className="font-medium">Allergies:</span> Penicillin
              </li>
              <li>
                <span className="font-medium">Current meds:</span> Atorvastatin, Metoprolol, Aspirin,
                Lisinopril
              </li>
              <li>
                <span className="font-medium">Risk factors:</span> Age, diabetes, prior smoking
              </li>
            </ul>
          </div>

          {/* What you need to know */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <p className="text-sm font-semibold text-blue-800 mb-2">What you need to know</p>
            <ul className="text-xs text-gray-800 space-y-2 list-disc list-inside">
              <li>{selectedPatient.summary}</li>
              <li>
                We noticed symptoms worsened shortly after:{" "}
                <span className="font-medium">
                  {selectedPatient.id === "john-smith"
                    ? "Lisinopril initiation and recent weight gain."
                    : "recent lifestyle and medication changes."}
                </span>
              </li>
              <li>
                Blood pressure trend is{" "}
                <span className="font-medium">downward overall but still above goal.</span>
              </li>
            </ul>
          </div>

          {/* Medication & lifestyle links */}
          <div className="border rounded-lg p-4 bg-emerald-50">
            <p className="text-sm font-semibold text-emerald-800 mb-2">
              Meds & lifestyle context
            </p>
            <ul className="text-xs text-gray-800 space-y-2 list-disc list-inside">
              <li>
                <span className="font-medium">Medication changes:</span> {selectedPatient.medChanges}
              </li>
              <li>
                <span className="font-medium">Lifestyle:</span> {selectedPatient.lifestyle}
              </li>
              <li>Consider asking about adherence, sodium intake, and exertional symptoms.</li>
            </ul>
          </div>
        </div>

        {/* Timeline & trends reused from patient view */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Blood Pressure Timeline
            </h3>
            <div className="bg-gray-50 rounded-lg p-3 border">{renderBPChart()}</div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              Current Metrics vs Goals
            </h3>
            <div className="bg-gray-50 rounded-lg p-3 border max-h-[360px] overflow-y-auto">
              {renderCurrentMetricsVsGoals()}
            </div>
          </div>
        </div>

        {/* Patient Summary from Analysis */}
        {patientAnalyses[selectedPatientId] && (
          <div className="mt-6 bg-blue-50 rounded-lg p-6 border border-blue-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-600" />
              AI-Generated Patient Summary
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {patientAnalyses[selectedPatientId].summary}
                </p>
              </div>
              <div className="flex items-center gap-4 pt-2 border-t border-blue-200">
                <div>
                  <span className="text-xs text-gray-600">Urgency: </span>
                  <span className={`text-sm font-semibold ${
                    patientAnalyses[selectedPatientId].urgency === "urgent"
                      ? "text-red-600"
                      : patientAnalyses[selectedPatientId].urgency === "monitor"
                      ? "text-amber-600"
                      : "text-emerald-600"
                  }`}>
                    {patientAnalyses[selectedPatientId].urgency.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    (Score: {patientAnalyses[selectedPatientId].urgencyScore}/10)
                  </span>
                </div>
              </div>
              {patientAnalyses[selectedPatientId].reasons.length > 0 && (
                <div className="pt-2 border-t border-blue-200">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Key Reasons:</p>
                  <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                    {patientAnalyses[selectedPatientId].reasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

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
                <h1 className="text-3xl font-bold text-gray-800">CardioTrack</h1>
                <p className="text-gray-600">AI-Assisted Cardiac Care Monitoring</p>
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end gap-2">
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-800">{session.user?.name}</p>
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
