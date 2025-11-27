import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// JSON Schema for OpenAI structured outputs
const llmResponseSchema = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "Natural, empathetic conversational response to the patient",
    },
    events: {
      type: "array",
      description: "Array of extracted events from the conversation",
      default: [],
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short event title (e.g., 'Started experiencing chest pain')",
          },
          type: {
            type: "string",
            enum: ["symptom", "medication_change", "lifestyle_change", "supplement", "adherence_issue", "other"],
            description: "Type of event",
          },
          severity: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Severity level of the event",
          },
          date: {
            type: "string",
            description: "ISO date string in YYYY-MM-DD format (e.g., '2024-11-25') or 'today' for today's date. Must be parseable for chart plotting.",
          },
          description: {
            type: "string",
            description: "Brief description of the event",
          },
        },
        required: ["title", "type", "severity", "date"],
      },
    },
  },
  required: ["message", "events"],
  additionalProperties: false,
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "patient") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const { message, chatId } = body;

    console.log("=== CHAT API POST CALLED ===");
    console.log("Timestamp:", new Date().toISOString());
    console.log("UserId:", userId);
    console.log("Message:", message);
    console.log("ChatId:", chatId);

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    // Get or create chat
    let chat = chatId 
      ? await prisma.chat.findUnique({ 
          where: { id: chatId },
          include: { messages: { orderBy: { createdAt: "asc" } } }
        })
      : null;
    
    if (!chat) {
      chat = await prisma.chat.create({
        data: { userId },
        include: { messages: true },
      });
    }

    // Save user message
    await prisma.message.create({
      data: {
        chatId: chat.id,
        role: "user",
        content: message.trim(),
      },
    });

    // Get patient profile for context
    const patient = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        medications: true,
        goals: true,
      },
    });

    // Get conversation history
    const messages = await prisma.message.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: "asc" },
    });

    // Build system prompt for structured output
    // Note: With structured outputs, OpenAI enforces the schema, so we can focus on behavior
    const systemPrompt = `You are a helpful and empathetic healthcare assistant for a cardiac care patient. 

You will respond with a JSON object containing:
- "message": Your natural, empathetic conversational response to the patient
- "events": An array of significant events extracted from what the PATIENT said

Rules for events:
- If no events mentioned in this conversation turn, return empty events array: {"message": "...", "events": []}
- Only extract significant events (symptoms, medication changes, new supplements, adherence issues, lifestyle changes)
- Be conversational and empathetic in your message
- Severity: "high" for concerning symptoms (chest pain, shortness of breath, severe BP issues), "medium" for notable changes, "low" for minor updates
- Extract events from what the PATIENT said, not from your responses
- For dates: Use ISO format (YYYY-MM-DD) like "2024-11-25", or "today" for today's date

Your role:
1. Listen to symptoms and ask thoughtful follow-up questions
2. Collect information about Life's Essential 8 lifestyle factors (diet, exercise, sleep, smoking)
3. Ask about medication adherence and new medications/supplements
4. Be conversational, warm, and ask one question at a time

Patient Context:
- Name: ${patient?.name || "Patient"}
- Conditions: ${patient?.conditions?.join(", ") || "Not specified"}
- Current Medications: ${patient?.medications?.map(m => `${m.name} (${m.dosage}, ${m.frequency})`).join(", ") || "None"}
- Goals: BP ${patient?.goals?.systolicGoal || 130}/${patient?.goals?.diastolicGoal || 80} mmHg`;

    // Prepare messages for OpenAI (extract just the message text from previous structured responses)
    const conversationMessages = messages.map(m => {
      if (m.role === "assistant" && m.content.startsWith("{")) {
        try {
          const parsed = JSON.parse(m.content);
          return {
            role: "assistant" as const,
            content: parsed.message || m.content,
          };
        } catch {
          return {
            role: "assistant" as const,
            content: m.content,
          };
        }
      }
      return {
        role: (m.role === "user" ? "user" : "assistant") as const,
        content: m.content,
      };
    });

    // Call OpenAI with structured output using JSON Schema
    let assistantMessage: string;
    let extractedEvents: any[] = [];

    try {
      // Use structured outputs with JSON Schema for guaranteed schema compliance
      // Note: gpt-4o-mini supports structured outputs
      const completion = await openai.beta.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationMessages,
        ],
        temperature: 0.7,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "llm_response",
            schema: llmResponseSchema,
            strict: true, // Enforces exact schema match - OpenAI will reject if it can't match
          },
        },
        max_tokens: 500,
      });

      const rawResponse = completion.choices[0].message.content;
      if (!rawResponse) {
        throw new Error("Empty response from OpenAI");
      }

      // Parse response - OpenAI structured outputs guarantee schema compliance
      const parsedResponse = JSON.parse(rawResponse);
      
      assistantMessage = parsedResponse.message;
      extractedEvents = parsedResponse.events || [];

      // Log LLM output for debugging
      console.log("=== LLM RESPONSE ===");
      console.log("Full JSON response:", JSON.stringify(parsedResponse, null, 2));
      console.log("Number of events extracted:", extractedEvents.length);
      console.log("Events details:", extractedEvents.map(e => ({
        title: e.title,
        type: e.type,
        severity: e.severity,
        date: e.date,
        description: e.description
      })));
      console.log("===================");
    } catch (error) {
      console.error("=== OPENAI API ERROR ===");
      console.error("OpenAI API error:", error);
      assistantMessage = "I'm having trouble processing your message right now. Please try again in a moment.";
      extractedEvents = [];
    }

    // Save assistant response
    await prisma.message.create({
      data: {
        chatId: chat.id,
        role: "assistant",
        content: assistantMessage,
      },
    });

    // Save extracted events
    console.log("=== SAVING EVENTS ===");
    console.log("Number of events to save:", extractedEvents.length);
    console.log("Events array:", JSON.stringify(extractedEvents, null, 2));
    
    let eventsCreated = 0;
    for (const event of extractedEvents) {
      console.log(`Creating event ${eventsCreated + 1}/${extractedEvents.length}:`, event.title);
      console.log(`Raw date from LLM: "${event.date}"`);
      
      // Parse date - handle various formats from LLM
      let eventDate: Date;
      if (event.date === "today" || !event.date) {
        eventDate = new Date();
        console.log("Using today's date");
      } else {
        // Try parsing the date string
        const parsedDate = new Date(event.date);
        if (isNaN(parsedDate.getTime())) {
          // If parsing fails, use today's date
          console.warn(`Failed to parse date "${event.date}", using today's date`);
          eventDate = new Date();
        } else {
          eventDate = parsedDate;
        }
      }
      
      // Normalize to start of day (midnight) for consistent plotting
      eventDate.setHours(0, 0, 0, 0);
      
      console.log(`Parsed event date: ${eventDate.toISOString()}`);
      console.log(`Event date timestamp: ${eventDate.getTime()}`);
      
      const createdEvent = await prisma.event.create({
        data: {
          userId: userId,
          date: eventDate,
          title: event.title,
          description: event.description || null,
          type: event.type,
          severity: event.severity,
          source: "chat",
        },
      });
      eventsCreated++;
      console.log(`Event created with ID: ${createdEvent.id}, Title: ${createdEvent.title}, Date: ${createdEvent.date.toISOString()}`);
    }
    
    console.log(`Total events created in this API call: ${eventsCreated}`);
    console.log("=====================");

    // Update chat timestamp
    await prisma.chat.update({
      where: { id: chat.id },
      data: { updatedAt: new Date() },
    });

    // Trigger automatic analysis generation after chat message
    // This will update patient summary and urgency based on new events
    generatePatientAnalysis(userId).catch(error => {
      console.error("Error generating analysis:", error);
    });

    return NextResponse.json({
      success: true,
      data: {
        chatId: chat.id,
        message: assistantMessage,
        events: extractedEvents,
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}

// GET: Retrieve chat history
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("chatId");

    if (chatId) {
      const messages = await prisma.message.findMany({
        where: { chatId },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json({ success: true, data: messages });
    }

    // Get most recent chat for user
    const chat = await prisma.chat.findFirst({
      where: { userId: session.user.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ 
      success: true, 
      data: chat ? chat.messages : [],
      chatId: chat?.id || null,
    });
  } catch (error) {
    console.error("Error fetching chats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}

// Helper function to generate patient analysis (called automatically after chat)
async function generatePatientAnalysis(userId: string) {
  try {
    const patient = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        medications: true,
        goals: true,
        measurements: {
          orderBy: { date: "desc" },
          take: 10,
        },
        events: {
          where: {
            date: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
          orderBy: { date: "desc" },
        },
      },
    });

    if (!patient) return;

    const latestMeasurement = patient.measurements[0];
    const measurementsData = patient.measurements.map(m => ({
      date: m.date.toISOString().split('T')[0],
      systolic: m.systolic,
      diastolic: m.diastolic,
      weight: m.weight,
      glucose: m.glucose,
      cholesterol: m.cholesterol,
    }));

    const eventsData = patient.events.map(e => ({
      date: e.date.toISOString().split('T')[0],
      title: e.title,
      type: e.type,
      severity: e.severity,
      description: e.description,
    }));

    const analysisPrompt = `You are a medical assistant helping a physician assess a patient's status. Analyze the following data and provide:

1. A clinical summary (2-3 paragraphs)
2. Urgency assessment (urgent/monitor/stable)
3. Key reasons for the urgency level

Patient: ${patient.name}
Age: ${patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : "Unknown"}
Conditions: ${patient.conditions.join(", ") || "None specified"}
Medications: ${patient.medications.map(m => `${m.name} (${m.dosage}, ${m.frequency})`).join(", ") || "None"}

Goals:
- BP: ${patient.goals?.systolicGoal || 130}/${patient.goals?.diastolicGoal || 80} mmHg
- Weight: ${patient.goals?.weightGoal || "Not set"} lbs
- Glucose: ${patient.goals?.glucoseGoal || 130} mg/dL
- Cholesterol: ${patient.goals?.cholesterolGoal || 200} mg/dL

Latest Measurement:
${latestMeasurement ? JSON.stringify({
  date: latestMeasurement.date.toISOString().split('T')[0],
  systolic: latestMeasurement.systolic,
  diastolic: latestMeasurement.diastolic,
  weight: latestMeasurement.weight,
  glucose: latestMeasurement.glucose,
  cholesterol: latestMeasurement.cholesterol,
}, null, 2) : "No measurements available"}

Recent Measurements (last 10):
${JSON.stringify(measurementsData, null, 2)}

Recent Events (last 30 days):
${JSON.stringify(eventsData, null, 2)}

Respond in JSON format:
{
  "summary": "2-3 paragraph clinical summary covering: overall status, key concerns, recent changes, recommendations",
  "urgency": "urgent|monitor|stable",
  "urgencyScore": number between 0-10,
  "reasons": ["reason 1", "reason 2", ...],
  "keyConcerns": ["concern 1", "concern 2", ...]
}

Urgency Guidelines:
- "urgent": Score 8-10. Critical symptoms (chest pain, severe BP elevation), high-severity events, significant deviations from goals
- "monitor": Score 4-7. Notable concerns, moderate deviations, medium-severity events, trends to watch
- "stable": Score 0-3. Generally stable, minor deviations, low-severity events

Be clinically accurate and consider both measurements vs goals AND recent events.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a medical assistant providing clinical analysis. Respond only in valid JSON format.",
        },
        {
          role: "user",
          content: analysisPrompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const analysis = JSON.parse(completion.choices[0].message.content || '{}');

    // Save or update analysis
    await prisma.patientAnalysis.upsert({
      where: { userId: userId },
      update: {
        summary: analysis.summary || "Unable to generate summary.",
        urgency: analysis.urgency || "stable",
        urgencyScore: analysis.urgencyScore || 0,
        reasons: analysis.reasons || [],
        keyConcerns: analysis.keyConcerns || [],
      },
      create: {
        userId: userId,
        summary: analysis.summary || "Unable to generate summary.",
        urgency: analysis.urgency || "stable",
        urgencyScore: analysis.urgencyScore || 0,
        reasons: analysis.reasons || [],
        keyConcerns: analysis.keyConcerns || [],
      },
    });
  } catch (error) {
    console.error("Error generating patient analysis:", error);
  }
}

