"use client";

import React, { useState } from "react";
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
} from "recharts";
import { Calendar, Pill, Activity, User, Heart, MessageCircle } from "lucide-react";

type PhysicianStatus = "urgent" | "monitor" | "stable";
type ViewMode = "patient" | "physician";
type ActiveTab = "profile" | "data" | "chat" | "timeline";

type BpPoint = {
  date: string;
  systolic: number;
  diastolic: number;
  readable: string;
  event?: string;
};

type TooltipProps = {
  active?: boolean;
  payload?: { payload: BpPoint }[];
};

const CardiologyMVP = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("patient");
  const [activeTab, setActiveTab] = useState<ActiveTab>("profile");
  const [selectedPatientId, setSelectedPatientId] = useState("john-smith");

  // Sample patient data (for patient view and detailed physician report)
  const patientProfile = {
    id: "john-smith",
    name: "John Smith",
    dob: "1955-03-15",
    age: 70,
    conditions: ["Coronary Artery Disease", "Hypertension", "Type 2 Diabetes"],
    allergies: ["Penicillin"],
    familyHistory: "Father had MI at age 65",
    smokingStatus: "Former smoker",
    smokingDetails: "Quit 10 years ago, 20 pack-year history",
    medications: [
      { name: "Atorvastatin", dosage: "40mg", frequency: "Once daily" },
      { name: "Metoprolol", dosage: "50mg", frequency: "Twice daily" },
      { name: "Aspirin", dosage: "81mg", frequency: "Once daily" },
      { name: "Lisinopril", dosage: "10mg", frequency: "Once daily" },
    ],
    currentMetrics: {
      weight: "185 lbs",
      bloodPressure: "138/85 mmHg",
      glucose: "145 mg/dL",
      cholesterol: "190 mg/dL",
    },
    goals: {
      bloodPressure: "< 130/80 mmHg",
      weight: "175 lbs",
      glucose: "< 130 mg/dL",
      cholesterol: "< 200 mg/dL",
    },
  };

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

  // Sample BP data with events (for John Smith)
  const bpData: BpPoint[] = [
    { date: "10/1", systolic: 145, diastolic: 90, readable: "Oct 1" },
    { date: "10/8", systolic: 142, diastolic: 88, readable: "Oct 8" },
    { date: "10/15", systolic: 140, diastolic: 86, readable: "Oct 15" },
    {
      date: "10/22",
      systolic: 138,
      diastolic: 85,
      readable: "Oct 22",
      event: "Started Lisinopril 10mg",
    },
    { date: "10/29", systolic: 135, diastolic: 82, readable: "Oct 29" },
    { date: "11/5", systolic: 132, diastolic: 80, readable: "Nov 5" },
    { date: "11/12", systolic: 130, diastolic: 78, readable: "Nov 12" },
  ];

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

  const renderBPChart = () => (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={bpData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="readable" />
        <YAxis
          domain={[60, 160]}
          label={{ value: "mmHg", angle: -90, position: "insideLeft" }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <ReferenceLine y={130} stroke="#ef4444" strokeDasharray="3 3" label="Systolic Goal" />
        <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="3 3" label="Diastolic Goal" />
        <Line type="monotone" dataKey="systolic" stroke="#3b82f6" strokeWidth={3} name="Systolic BP" />
        <Line
          type="monotone"
          dataKey="diastolic"
          stroke="#22c55e"
          strokeWidth={3}
          name="Diastolic BP"
        />
      </LineChart>
    </ResponsiveContainer>
  );

  const renderCurrentMetricsVsGoals = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.keys(patientProfile.currentMetrics).map((metric) => {
        const metricName = metric
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase());
        const current = (patientProfile.currentMetrics as any)[metric];
        const goal = (patientProfile.goals as any)[metric];

        let isAtGoal = false;
        if (metric === "bloodPressure") {
          const systolic = parseInt((current as string).split("/")[0], 10);
          isAtGoal = systolic < 130;
        } else if (metric === "weight") {
          const weightVal = parseInt(current as string, 10);
          isAtGoal = weightVal <= 175;
        } else if (metric === "glucose") {
          const glucoseVal = parseInt(current as string, 10);
          isAtGoal = glucoseVal < 130;
        } else {
          const cholVal = parseInt(current as string, 10);
          isAtGoal = cholVal < 200;
        }

        return (
          <div
            key={metric}
            className={`p-4 rounded-lg ${isAtGoal ? "bg-green-50" : "bg-yellow-50"}`}
          >
            <p className="text-sm text-gray-600 mb-1">{metricName}</p>
            <p className="text-2xl font-bold text-gray-800">{current}</p>
            <p className="text-sm mt-1">
              <span className="text-gray-600">Goal: </span>
              <span className="font-medium">{goal}</span>
            </p>
            <div className="mt-2">
              {isAtGoal ? (
                <span className="text-green-600 text-sm font-medium">✓ At Goal</span>
              ) : (
                <span className="text-orange-600 text-sm font-medium">⚠ Above Goal</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

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
      {activeTab === "profile" && (
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
                  {patientProfile.dob} (Age {patientProfile.age})
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Allergies</p>
                <p className="text-lg font-semibold text-red-600">
                  {patientProfile.allergies.join(", ")}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Family History</p>
                <p className="text-lg">{patientProfile.familyHistory}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Smoking Status</p>
                <p className="text-lg font-semibold">{patientProfile.smokingStatus}</p>
                <p className="text-sm text-gray-500">{patientProfile.smokingDetails}</p>
              </div>
            </div>
          </div>

          {/* Current Conditions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">Current Conditions</h3>
            <div className="flex flex-wrap gap-2">
              {patientProfile.conditions.map((condition, idx) => (
                <span
                  key={idx}
                  className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium"
                >
                  {condition}
                </span>
              ))}
            </div>
          </div>

          {/* Current Medications */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <Pill className="w-5 h-5 mr-2 text-blue-600" />
              Current Medications
            </h3>
            <div className="space-y-3">
              {patientProfile.medications.map((med, idx) => (
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
              ))}
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
                <h2 className="text-2xl font-bold text-gray-800">Today's Measurements</h2>
                <p className="text-sm text-gray-600 mt-1">Enter your latest readings</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Blood Pressure */}
              <div className="p-4 border-2 border-blue-200 rounded-lg">
                <label className="block text-lg font-semibold text-gray-800 mb-3">
                  Blood Pressure
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      Systolic (top number)
                    </label>
                    <input
                      type="number"
                      placeholder="120"
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
                      className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">mmHg</p>
                  </div>
                </div>
              </div>

              {/* Weight */}
              <div className="p-4 border-2 border-green-200 rounded-lg">
                <label className="block text-lg font-semibold text-gray-800 mb-3">Weight</label>
                <input
                  type="number"
                  placeholder="185"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">pounds (lbs)</p>
              </div>

              {/* Glucose */}
              <div className="p-4 border-2 border-purple-200 rounded-lg">
                <label className="block text-lg font-semibold text-gray-800 mb-3">
                  Blood Glucose
                </label>
                <input
                  type="number"
                  placeholder="110"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">mg/dL (fasting)</p>
              </div>

              {/* Cholesterol */}
              <div className="p-4 border-2 border-orange-200 rounded-lg">
                <label className="block text-lg font-semibold text-gray-800 mb-3">
                  Total Cholesterol
                </label>
                <input
                  type="number"
                  placeholder="180"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">mg/dL (from lab test)</p>
              </div>

              {/* Date/Time */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  When were these measurements taken?
                </label>
                <input
                  type="datetime-local"
                  defaultValue={new Date().toISOString().slice(0, 16)}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Submit Button */}
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors">
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

          {/* Chat Interface Placeholder */}
          <div className="border-2 border-gray-200 rounded-lg h-96 flex flex-col">
            {/* Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
              <div className="space-y-4">
                {/* Sample AI Message */}
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <MessageCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm max-w-md">
                    <p className="text-sm text-gray-800">
                      Hello! I am here to help you track your health. How are you feeling today?
                      Have you noticed any new symptoms or changes since our last check-in?
                    </p>
                  </div>
                </div>

                {/* Sample User Message */}
                <div className="flex items-start space-x-3 justify-end">
                  <div className="bg-blue-600 p-3 rounded-lg shadow-sm max-w-md">
                    <p className="text-sm text-white">
                      I have been feeling pretty good. My chest pain has been much better since
                      starting the new medication.
                    </p>
                  </div>
                  <div className="bg-gray-300 p-2 rounded-full">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                </div>

                {/* Sample AI Follow-up */}
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <MessageCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm max-w-md">
                    <p className="text-sm text-gray-800">
                      That is great to hear! Let me ask you a few questions to update your records:
                    </p>
                    <ul className="text-sm text-gray-800 mt-2 space-y-1 list-disc list-inside">
                      <li>How many hours are you sleeping per night on average?</li>
                      <li>Have you been able to exercise this week?</li>
                      <li>Any changes to your diet or eating habits?</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Input Area */}
            <div className="border-t-2 border-gray-200 p-4 bg-white">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Type your message here..."
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
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
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Blood Pressure Timeline</h2>

            {/* Chart */}
            <div className="mb-4">{renderBPChart()}</div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Average Systolic (Last 30 days)</p>
                <p className="text-3xl font-bold text-blue-600">136</p>
                <p className="text-sm text-gray-600 mt-1">Goal: &lt;130 mmHg</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Average Diastolic (Last 30 days)</p>
                <p className="text-3xl font-bold text-green-600">83</p>
                <p className="text-sm text-gray-600 mt-1">Goal: &lt;80 mmHg</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Trend</p>
                <p className="text-3xl font-bold text-orange-600">↓ Improving</p>
                <p className="text-sm text-gray-600 mt-1">Since med change</p>
              </div>
            </div>

            {/* Events List */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800">Recent Events</h3>
                <p className="text-xs text-gray-500">
                  Events are automatically tracked from your chat conversations
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg">
                  <div className="bg-orange-200 p-2 rounded-full">
                    <Pill className="w-4 h-4 text-orange-800" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">Started Lisinopril 10mg</p>
                    <p className="text-sm text-gray-600">October 22, 2024</p>
                    <p className="text-xs text-gray-500 mt-1">From chat conversation</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

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
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Demo workspace • Stanford Cardiology</span>
              </div>
              {/* View toggle */}
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 overflow-hidden text-sm">
                <button
                  onClick={() => setViewMode("patient")}
                  className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${
                    viewMode === "patient"
                      ? "bg-blue-600 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <User className="w-4 h-4" />
                  Patient view
                </button>
                <button
                  onClick={() => setViewMode("physician")}
                  className={`px-3 py-1.5 flex items-center gap-1 border-l border-gray-200 transition-colors ${
                    viewMode === "physician"
                      ? "bg-blue-600 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  Physician view
                </button>
              </div>
            </div>
          </div>
        </div>

        {viewMode === "patient" ? renderPatientView() : renderPhysicianView()}
      </div>
    </div>
  );
};

export default CardiologyMVP;
