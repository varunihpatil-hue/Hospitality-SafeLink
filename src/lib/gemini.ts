import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getCrisisAdvice(incidentType: string, description: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert hospitality emergency response coordinator for a luxury hotel. 
      A crisis has been reported on-site:
      SIGNAL TYPE: ${incidentType.toUpperCase()}
      SITUATION REPORT: ${description}

      Provide a high-precision actionable briefing in the following format:
      
      [IMMEDIATE STAFF ACTIONS]
      • Step 1 (Critical Safety)
      • Step 2 (Guest Coordination)
      • Step 3 (Containment)

      [COMMAND CENTER DIRECTIVES]
      • Tactical Point 1
      • Tactical Point 2
      • Tactical Point 3

      Keep it concise, professional, and authoritative. Avoid conversational filler.`,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI Advisor currently unavailable. Follow standard emergency protocols.";
  }
}

export async function analyzeGuestMessage(input: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are Hospitality SafeLink AI, a safety-first intelligent assistant for luxury hotel guests.
      
      CRITICAL OPERATING DIRECTIVES:
      1. Always prioritize safety.
      2. Detect distress, fear, or unsafe situations.
      3. Handle both concierge requests (service, food) and safety/navigation requests.
      4. For solo female travelers or elderly, provide extra reassurance and safety checkpoints.
      
      SCENARIO GUIDANCE:
      - If user asks for "Safe Navigation" -> Suggest a route using main elevators and well-lit hallways. Verify they are in their room if possible.
      - If user mentions "feeling watched" or "stranger at door" -> Category: Emergency, AI response: Acknowledge, advise to lock chain, offer SOS trigger.
      - If user asks for "Room Service" -> Category: Normal, AI response: Provide helpful confirmation and remind them they can check the courier's ID through the door viewer for safety.

      User message: "${input}"

      Respond strictly in JSON format:
      {
        "category": "Normal" | "Mild Concern" | "Unsafe Situation" | "Emergency",
        "emotion": "fear" | "panic" | "calm" | "confusion",
        "action": "suggested action string",
        "ai_response": "Supportive, actionable response focused on safety + service"
      }`
    });
    
    // Extract JSON from potential markdown response
    const text = response.text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Invalid AI response format");
  } catch (error) {
    console.error("Analysis Error:", error);
    return {
      category: "Normal",
      emotion: "calm",
      action: "Contact front desk",
      ai_response: "I'm here to help. How can I assist you today?"
    };
  }
}
