import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { Prisma } from "@prisma/client";

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

// JSON Schema for structured output (chat-level, no events; events come from end-of-conversation analysis)
const responseSchema = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "Natural, empathetic conversational response to the patient",
    },
    conversationEnding: {
      type: "boolean",
      description: "True if the patient is indicating the conversation is ending. Look for: 'nope', 'no', 'nothing else', 'that's all', 'I'm good', 'all set', 'no thanks', 'I'm done', 'done', 'finished', goodbye phrases, or when they decline further questions in response to 'anything else?' type questions.",
    },
  },
  required: ["message", "conversationEnding"],
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
        content: `You are a helpful and empathetic healthcare assistant for a cardiac care patient. Your role is PURELY INFORMATION GATHERING - you do NOT diagnose, provide medical advice, or suggest treatments.

Your primary goals (in this order):
1. When the patient reports a symptom, FIRST understand the symptom itself (onset, change over time, frequency, severity, constant vs. intermittent, triggers/relievers, impact on daily life).
2. AFTER the symptom is clear, explore contributors: diet, exercise, sleep, smoking/alcohol, and stress.
3. THEN ask about medications: new meds/supplements, adherence (missed doses, timing issues, self-stopped meds), and dose/frequency changes.
4. Keep the focus on gathering information for the care team, not giving advice.

IMPORTANT BOUNDARIES (always follow):
- Do NOT diagnose conditions or symptoms or give treatment/medication advice.
- Do NOT suggest specific lifestyle changes as solutions.
- DO ask clarifying questions and connect symptoms to lifestyle/medication context.

Your approach:
- Be conversational, warm, and empathetic.
- Keep messages concise (1-3 short sentences).
- When exploring contributors, ask about ONE factor at a time with simple questions (diet, then activity, then sleep, then medications/adherence).
- Focus on gathering facts and context, not providing solutions.
- Before ending the conversation, ALWAYS ask "Is there anything else you would like to share?"

Patient Context:
- Name: ${patient?.name || "Patient"}
- Conditions: ${patient?.conditions?.join(", ") || "Not specified"}
- Current Medications: ${patient?.medications?.map((m: { name: string; dosage: string; frequency: string }) => `${m.name} (${m.dosage}, ${m.frequency})`).join(", ") || "None"}
- Goals: BP ${patient?.goals?.systolicGoal || 130}/${patient?.goals?.diastolicGoal || 80} mmHg

You will respond with a JSON object containing:
- "message": Your natural, empathetic conversational response (focused on information gathering, NOT advice)
- "conversationEnding": Boolean indicating if the conversation is ending

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
        conversationEnding = parsed.conversationEnding || false;

        console.log("OpenAI response:", { 
          message: assistantMessage, 
          conversationEnding,
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

    // Update chat timestamp
    await prisma.chat.update({
      where: { id: chat.id },
      data: { updatedAt: new Date() },
    });

    // Trigger patient analysis only if:
    // 1. AI detected conversation ending, OR
    // 2. Previous conversation timed out (abandoned chat)
    if (conversationEnding || previousConversationEnded) {
      console.log("Conversation ending detected - extracting events and generating analysis", {
        aiDetected: conversationEnding,
        timeoutDetected: previousConversationEnded,
      });

      // Run conversation-level event extraction, then analysis (fire-and-forget)
      extractConversationEvents(userId, chat.id)
        .then(() => generatePatientAnalysis(userId))
        .catch((error) => {
          console.error("Error in conversation event extraction or analysis:", error);
        });
    }

    return NextResponse.json({
      success: true,
      data: {
        chatId: chat.id,
        message: assistantMessage,
        events: [], // events now come only from end-of-conversation analysis
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

// Helper: extract 1-3 key events from full conversation history at end of conversation
async function extractConversationEvents(userId: string, chatId: string) {
  try {
    if (!openai) {
      console.error("OpenAI API key not configured - skipping conversation event extraction");
      return;
    }

    // Get full conversation history for this chat
    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
    });

    if (messages.length === 0) return;

    // Build a compact conversation transcript (user/assistant turns)
    const transcript = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const prompt = `You are a medical assistant helping summarize a cardiac care chat conversation.

Your task:
- Read the FULL conversation transcript between PATIENT and ASSISTANT.
- Identify the ONE most important symptom/event that matters for cardiology follow-up.
- Put the main symptom/event in "title" and "description".
- Put lifestyle contributors (diet, activity, sleep, smoking/alcohol, stress, etc.) in "lifestyleChanges".
- Put medication-related contributors (new meds/supplements, adherence issues, dose changes, stopped meds) in "medicationChanges".

Event rules:
- Title: the MAIN clinical symptom/event (e.g., "New onset shortness of breath").
- Description: short description of the symptom itself (onset, pattern, severity, impact).
- LifestyleChanges: brief bullet-style phrases for lifestyle-related factors.
- MedicationChanges: brief bullet-style phrases for medication/adherence-related factors.
- Date: use "today" (the system will store this event as today's date on the timeline).
- Prefer ONE event only; do NOT list every small detail.

If there are no meaningful events, return an empty array.

Conversation transcript:
${transcript}

Respond ONLY in JSON with this shape:
{
  "events": [
    {
      "date": "YYYY-MM-DD or 'today'",
      "title": "main clinical symptom/event",
      "description": "short description of the symptom itself",
      "lifestyleChanges": ["brief lifestyle-related changes or factors"],
      "medicationChanges": ["brief medication-related changes or adherence issues"]
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a careful clinical summarizer. Respond ONLY in valid JSON with an 'events' array as specified.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    const content = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    const events = Array.isArray(parsed.events) ? parsed.events : [];

    if (events.length === 0) {
      console.log("No key events extracted from conversation");
      return;
    }

    // Remove previous conversation-derived events for the last 30 days to avoid duplicates
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await prisma.event.deleteMany({
      where: {
        userId,
        source: "chat_conversation",
        date: {
          gte: thirtyDaysAgo,
        },
      },
    });

    const limitedEvents = events.slice(0, 1); // only 1 event per conversation

    for (const event of limitedEvents) {
      if (!event?.title) continue;

      // ALWAYS default event date to today (midnight) instead of trying to infer
      const eventDate = new Date();
      eventDate.setHours(0, 0, 0, 0);

      const lifestyleChanges = Array.isArray(event.lifestyleChanges)
        ? event.lifestyleChanges.map((v: unknown) => String(v))
        : [];
      const medicationChanges = Array.isArray(event.medicationChanges)
        ? event.medicationChanges.map((v: unknown) => String(v))
        : [];

      await prisma.event.create({
        data: {
          userId,
          date: eventDate,
          title: event.title,
          description: event.description || null,
          lifestyleChanges,
          medicationChanges,
          source: "chat_conversation",
        } as unknown as Prisma.EventCreateInput,
      });
    }
  } catch (error) {
    console.error("Error extracting conversation events:", error);
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
      (patient.events as unknown as Array<{
        date: Date;
        title: string;
        description: string | null;
        lifestyleChanges: string[];
        medicationChanges: string[];
      }>).map((e) => ({
        date: e.date.toISOString().split("T")[0],
        title: e.title,
        description: e.description ?? null,
        lifestyleChanges: e.lifestyleChanges ?? [],
        medicationChanges: e.medicationChanges ?? [],
      })),
      null,
      2
    )}

Respond in JSON format (keep it concise and skimmable):
{
  "summary": "2-3 sentence clinical summary focused on the last few weeks",
  "urgency": "urgent|monitor|stable",
  "urgencyScore": number between 0-10,
  "reasons": ["short reasons explaining WHY you chose this urgency bucket (2-4 items max)"],
  "keyConcerns": ["very short one-line concerns the physician should keep in mind over time (1-3 items max)"]
}

Additional instructions:
- Do NOT repeat raw measurements or events; they are already available to the physician in the dashboard.
- Focus on compression and triage: what story should the physician see at a glance, and why is the urgency bucket appropriate?
- Keep all text concise and easily skimmable.

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

    // Optionally create or refresh key chat-derived events (at most 3) based on the analysis
    const keyEvents = Array.isArray(analysis.keyEvents) ? analysis.keyEvents : [];

    if (keyEvents.length > 0) {
      // Remove previous chat-analysis events for the last 30 days to avoid duplicates
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await prisma.event.deleteMany({
        where: {
          userId,
          source: "chat_analysis",
          date: {
            gte: thirtyDaysAgo,
          },
        },
      });

      const limitedEvents = keyEvents.slice(0, 3); // Hard cap at 3

      for (const event of limitedEvents) {
        if (!event?.date || !event?.title) continue;

        let eventDate: Date;
        if (event.date === "today") {
          eventDate = new Date();
        } else {
          const parsedDate = new Date(event.date);
          if (isNaN(parsedDate.getTime())) continue;
          eventDate = parsedDate;
        }
        eventDate.setHours(0, 0, 0, 0);

        await prisma.event.create({
          data: {
            userId,
            date: eventDate,
            title: event.title,
            description: event.description || null,
            type: event.type || null,
            severity: event.severity || null,
            source: "chat_analysis",
          },
        });
      }
    }
  } catch (error) {
    console.error("Error generating patient analysis:", error);
  }
}
