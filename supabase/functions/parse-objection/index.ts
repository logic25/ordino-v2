import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("project_id") as string | null;

    if (!file || !projectId) {
      return new Response(JSON.stringify({ error: "file and project_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read PDF as text using a simple text extraction approach
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Extract text content from PDF binary
    // Simple approach: decode the bytes and extract readable text between stream markers
    const rawText = new TextDecoder("latin1").decode(bytes);
    
    // Extract text from PDF streams and text operators
    let extractedText = "";
    
    // Method 1: Extract text between BT/ET operators (text blocks)
    const textBlocks = rawText.match(/BT[\s\S]*?ET/g) || [];
    for (const block of textBlocks) {
      // Extract text from Tj, TJ, ', " operators
      const tjMatches = block.match(/\(([^)]*)\)\s*Tj/g) || [];
      for (const m of tjMatches) {
        const text = m.match(/\(([^)]*)\)/)?.[1] || "";
        extractedText += text + " ";
      }
      // Extract from TJ arrays
      const tjArrays = block.match(/\[([^\]]*)\]\s*TJ/g) || [];
      for (const arr of tjArrays) {
        const strings = arr.match(/\(([^)]*)\)/g) || [];
        for (const s of strings) {
          extractedText += (s.match(/\(([^)]*)\)/)?.[1] || "") + "";
        }
        extractedText += " ";
      }
    }
    
    // Method 2: Also try to find plain text content
    const plainTextMatches = rawText.match(/\/Type\s*\/Page[\s\S]*?endobj/g) || [];
    
    // If text extraction yielded very little, fall back to raw readable chars
    if (extractedText.trim().length < 50) {
      // Extract readable ASCII sequences
      const readable = rawText.replace(/[^\x20-\x7E\n\r\t]/g, " ")
        .replace(/\s{3,}/g, "\n")
        .trim();
      extractedText = readable;
    }

    // Clean up extracted text
    extractedText = extractedText
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\s+/g, " ")
      .trim();

    if (extractedText.length < 20) {
      return new Response(
        JSON.stringify({ error: "Could not extract text from PDF. The file may be scanned/image-based." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Truncate to ~15k chars for the AI prompt
    const textForAI = extractedText.substring(0, 15000);

    // Call Lovable AI to parse objection items
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert at parsing NYC DOB (Department of Buildings) objection letters. 
Given the text of an objection letter, identify each individual objection item and return structured data.
Each objection item typically has a number, the objection text describing what needs to be addressed, 
and a code reference (e.g., "ZR 33-42", "BC 1003.2", "AC 28-105.1").
Categories: zoning, egress, structural, fire, plumbing, mechanical, electrical, administrative, other.`,
          },
          {
            role: "user",
            content: `Parse the following DOB objection letter text and extract each individual objection item:\n\n${textForAI}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_objections",
              description: "Extract structured objection items from a DOB objection letter",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        item_number: { type: "number", description: "Sequential item number" },
                        objection_text: { type: "string", description: "The full text of the objection" },
                        code_reference: { type: "string", description: "Code section reference (e.g. ZR 33-42, BC 1003.2)" },
                        category: {
                          type: "string",
                          enum: ["zoning", "egress", "structural", "fire", "plumbing", "mechanical", "electrical", "administrative", "other"],
                        },
                      },
                      required: ["item_number", "objection_text", "category"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["items"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_objections" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI error:", status, await aiResponse.text());
      return new Response(JSON.stringify({ error: "AI parsing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let items: any[] = [];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        items = parsed.items || [];
      } catch {
        console.error("Failed to parse AI response");
      }
    }

    if (items.length === 0) {
      return new Response(
        JSON.stringify({ error: "No objection items could be identified in this document." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's company_id
    const { data: profileData } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!profileData?.company_id) {
      return new Response(JSON.stringify({ error: "No company found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload the PDF to universal_documents first
    const timestamp = Date.now();
    const storagePath = `${profileData.company_id}/${projectId}/objections/${timestamp}_${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from("universal-documents")
      .upload(storagePath, bytes, { contentType: "application/pdf" });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
    }

    // Create universal_document record
    const { data: docRecord, error: docError } = await supabase
      .from("universal_documents")
      .insert({
        company_id: profileData.company_id,
        project_id: projectId,
        filename: file.name,
        storage_path: storagePath,
        mime_type: "application/pdf",
        size_bytes: bytes.length,
        category: "Objection Letters",
        uploaded_by: user.id,
      })
      .select("id")
      .single();

    const docId = docRecord?.id || null;
    if (docError) {
      console.error("Doc record error:", docError);
    }

    // Insert objection items
    const rows = items.map((item: any) => ({
      project_id: projectId,
      company_id: profileData.company_id,
      objection_letter_id: docId,
      item_number: item.item_number,
      objection_text: item.objection_text,
      code_reference: item.code_reference || null,
      category: item.category || "other",
      status: "pending",
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("objection_items")
      .insert(rows)
      .select();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save objection items: " + insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        items: inserted,
        document_id: docId,
        items_count: inserted?.length || 0,
        extracted_text_length: extractedText.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("parse-objection error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
