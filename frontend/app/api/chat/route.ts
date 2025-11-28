import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

// JSON Schema for structured output
const responseSchema = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "Natural, empathetic conversational response to the patient",
    },
    events: {
      type: "array",
      description: "Array of significant events extracted from the patient's message",
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
            description: "ISO date string in YYYY-MM-DD format or 'today' for today's date",
          },
          description: {
            type: "string",
            description: "Brief description of the event (can be empty string if not needed)",
          },
        },
        required: ["title", "type", "severity", "date", "description"],
        additionalProperties: false,
      },
    },
    conversationEnding: {
      type: "boolean",
      description: "True if the patient is indicating the conversation is ending. Look for: 'nope', 'no', 'nothing else', 'that's all', 'I'm good', 'all set', 'no thanks', 'I'm done', 'done', 'finished', goodbye phrases, or when they decline further questions in response to 'anything else?' type questions.",
    },
  },
  required: ["message", "events", "conversationEnding"],
  additionalProperties: false,
};

// POST: Handle chat messages
export async function POST(request: NextRequest) {
  try {
    // Authentication
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

    // Validation
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
        })
      : null;

    // Check if previous conversation ended (time-based detection for abandoned chats)
    // Do this BEFORE creating new chat or updating timestamp
    const CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    let previousConversationEnded = false;
    
    if (chat && chat.updatedAt) {
      const timeSinceLastUpdate = Date.now() - new Date(chat.updatedAt).getTime();
      previousConversationEnded = timeSinceLastUpdate > CONVERSATION_TIMEOUT;
      
      if (previousConversationEnded) {
        console.log("Previous conversation timed out - will generate analysis after processing this message");
      }
    }

    if (!chat) {
      chat = await prisma.chat.create({
        data: { userId },
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
    const conversationHistory = await prisma.message.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: "asc" },
    });

    // Prepare messages for OpenAI
    const openaiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: `You are a helpful and empathetic healthcare assistant for a cardiac care patient.

Your role:
- Listen to symptoms and ask thoughtful follow-up questions
- Collect information about lifestyle factors (diet, exercise, sleep, smoking)
- Ask about medication adherence and new medications/supplements
- Be conversational, warm, and ask one question at a time

Patient Context:
- Name: ${patient?.name || "Patient"}
- Conditions: ${patient?.conditions?.join(", ") || "Not specified"}
- Current Medications: ${patient?.medications?.map((m: { name: string; dosage: string; frequency: string }) => `${m.name} (${m.dosage}, ${m.frequency})`).join(", ") || "None"}
- Goals: BP ${patient?.goals?.systolicGoal || 130}/${patient?.goals?.diastolicGoal || 80} mmHg

You will respond with a JSON object containing:
- "message": Your natural, empathetic conversational response
- "events": An array of significant events extracted from what the PATIENT said
- "conversationEnding": Boolean indicating if the conversation is ending

Rules for events:
- Only extract significant events (symptoms, medication changes, lifestyle changes, supplements, adherence issues)
- If no events mentioned, return empty array: {"message": "...", "events": []}
- Severity: "high" for concerning symptoms (chest pain, shortness of breath, severe BP issues), "medium" for notable changes, "low" for minor updates
- Extract events from what the PATIENT said, not from your responses
- For dates: Use ISO format (YYYY-MM-DD) like "2024-11-25", or "today" for today's date

Rules for conversationEnding:
- Set "conversationEnding": true if the patient indicates the conversation is ending, such as:
  * Responding "nope", "no", "nothing else", "that's all", "I'm good", "all set", "no thanks", "I'm done", "done", "finished" to "anything else?" type questions
  * Saying goodbye, thanks, "talk to you later", "see you", etc.
  * Declining further questions or indicating they're done sharing
- Set "conversationEnding": false if they're continuing the conversation or asking questions
- Be conservative - only set to true when you're confident the conversation is ending`,
      },
    ];

    // Add conversation history (extract message text from previous structured responses)
    for (const msg of conversationHistory) {
      if (msg.role === "assistant" && msg.content.startsWith("{")) {
        try {
          const parsed = JSON.parse(msg.content);
          openaiMessages.push({
            role: "assistant",
            content: parsed.message || msg.content,
          });
        } catch {
          openaiMessages.push({
            role: "assistant",
            content: msg.content,
          });
        }
      } else {
        openaiMessages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        });
      }
    }

    // Call OpenAI
    let assistantMessage = "I'm having trouble processing your message right now. Please try again in a moment.";
    let extractedEvents: Array<{
      title: string;
      type: string;
      severity: string;
      date: string;
      description?: string;
    }> = [];
    let conversationEnding = false;

    if (!openai) {
      console.error("OpenAI API key not configured");
      assistantMessage = "I'm sorry, but the AI service is not configured. Please contact your administrator.";
    } else {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: openaiMessages,
          temperature: 0.7,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "chat_response",
              schema: responseSchema,
              strict: true,
            },
          },
          max_tokens: 500,
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Empty response from OpenAI");
        }

        const parsed = JSON.parse(content);
        assistantMessage = parsed.message || assistantMessage;
        extractedEvents = parsed.events || [];
        conversationEnding = parsed.conversationEnding || false;

        console.log("OpenAI response:", { 
          message: assistantMessage, 
          eventsCount: extractedEvents.length,
          conversationEnding 
        });
      } catch (error) {
        console.error("OpenAI API error:", error);
      }
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
    for (const event of extractedEvents) {
      let eventDate: Date;
      if (event.date === "today" || !event.date) {
        eventDate = new Date();
      } else {
        const parsed = new Date(event.date);
        eventDate = isNaN(parsed.getTime()) ? new Date() : parsed;
      }
      eventDate.setHours(0, 0, 0, 0);

      await prisma.event.create({
        data: {
          userId,
          date: eventDate,
          title: event.title,
          description: event.description || null,
          type: event.type,
          severity: event.severity,
          source: "chat",
        },
      });
    }

    // Update chat timestamp
    await prisma.chat.update({
      where: { id: chat.id },
      data: { updatedAt: new Date() },
    });

    // Trigger patient analysis only if:
    // 1. AI detected conversation ending, OR
    // 2. Previous conversation timed out (abandoned chat)
    if (conversationEnding || previousConversationEnded) {
      console.log("Conversation ending detected - generating analysis", {
        aiDetected: conversationEnding,
        timeoutDetected: previousConversationEnded,
      });
      generatePatientAnalysis(userId).catch((error) => {
        console.error("Error generating patient analysis:", error);
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        chatId: chat.id,
        message: assistantMessage,
        events: extractedEvents,
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
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
    console.error("Error fetching chat:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch chat" },
      { status: 500 }
    );
  }
}

// Helper function to generate patient analysis
async function generatePatientAnalysis(userId: string) {
  try {
    if (!openai) {
      console.error("OpenAI API key not configured - skipping analysis");
      return;
    }

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

    const prompt = `You are a medical assistant helping a physician assess a patient's status.

Patient: ${patient.name}
Age: ${patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : "Unknown"}
Conditions: ${patient.conditions.join(", ") || "None specified"}
Medications: ${patient.medications.map((m: { name: string; dosage: string; frequency: string }) => `${m.name} (${m.dosage}, ${m.frequency})`).join(", ") || "None"}

Goals:
- BP: ${patient.goals?.systolicGoal || 130}/${patient.goals?.diastolicGoal || 80} mmHg
- Weight: ${patient.goals?.weightGoal || "Not set"} lbs
- Glucose: ${patient.goals?.glucoseGoal || 130} mg/dL

Recent Measurements (last 10):
${JSON.stringify(
      patient.measurements.map((m: { date: Date; systolic: number | null; diastolic: number | null; weight: number | null; glucose: number | null }) => ({
        date: m.date.toISOString().split("T")[0],
        systolic: m.systolic,
        diastolic: m.diastolic,
        weight: m.weight,
        glucose: m.glucose,
      })),
      null,
      2
    )}

Recent Events (last 30 days):
${JSON.stringify(
      patient.events.map((e: { date: Date; title: string; type: string | null; severity: string | null; description: string | null }) => ({
        date: e.date.toISOString().split("T")[0],
        title: e.title,
        type: e.type,
        severity: e.severity,
        description: e.description,
      })),
      null,
      2
    )}

Respond in JSON format:
{
  "summary": "2-3 paragraph clinical summary",
  "urgency": "urgent|monitor|stable",
  "urgencyScore": number between 0-10,
  "reasons": ["reason 1", "reason 2", ...],
  "keyConcerns": ["concern 1", "concern 2", ...]
}

Urgency Guidelines:
- "urgent": Score 8-10. Critical symptoms, high-severity events, significant deviations from goals
- "monitor": Score 4-7. Notable concerns, moderate deviations, medium-severity events
- "stable": Score 0-3. Generally stable, minor deviations, low-severity events`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a medical assistant providing clinical analysis. Respond only in valid JSON format.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const content = completion.choices[0]?.message?.content || "{}";
    const analysis = JSON.parse(content);

    await prisma.patientAnalysis.upsert({
      where: { userId },
      update: {
        summary: analysis.summary || "Unable to generate summary.",
        urgency: analysis.urgency || "stable",
        urgencyScore: analysis.urgencyScore || 0,
        reasons: analysis.reasons || [],
        keyConcerns: analysis.keyConcerns || [],
      },
      create: {
        userId,
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
