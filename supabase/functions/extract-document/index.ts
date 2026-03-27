// Midi KYB Portal - Document Extraction Edge Function
// Uses Claude API to extract structured data from uploaded documents

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Field extraction prompts per document type
const EXTRACTION_PROMPTS: Record<string, string> = {
  corporate_document: `Extract the following fields from this corporate document (Operating Agreement, Bylaws, Articles of Incorporation, or Partnership Agreement). Return ONLY a JSON object with these fields:
{
  "entity_name": "Full legal name of the company",
  "type_of_company": "LLC, Corporation, Partnership, etc.",
  "country_of_registration": "Country where registered",
  "state_of_registration": "State/Province if applicable",
  "registration_number": "Registration or filing number",
  "registration_date": "Date of registration (YYYY-MM-DD)",
  "registered_address": "Registered address of the company",
  "beneficial_owners": [
    {
      "name": "Full name",
      "title": "Title/Position",
      "ownership_percentage": "Percentage as number",
      "is_control_person": true/false
    }
  ],
  "authorized_signatories": ["Name 1", "Name 2"]
}
If a field cannot be found, use null. For arrays, return empty array if not found.`,

  ein_tax_id: `Extract the following fields from this EIN/Tax ID document (IRS Letter CP575, SS-4 Confirmation, or similar tax identification document). Return ONLY a JSON object:
{
  "entity_name": "Full legal name as registered with IRS",
  "tin_ein": "EIN or Tax ID number (XX-XXXXXXX format)",
  "entity_type": "Type of entity (LLC, Corporation, etc.)",
  "tax_year_end": "Fiscal year end month if shown",
  "responsible_party": "Name of responsible party if shown",
  "address": "Address shown on document"
}
If a field cannot be found, use null.`,

  id_representative: `Extract the following fields from this government-issued photo ID (passport, driver's license, national ID). Return ONLY a JSON object:
{
  "full_name": "Full legal name as shown on ID",
  "first_name": "First name",
  "last_name": "Last name",
  "date_of_birth": "Date of birth (YYYY-MM-DD)",
  "id_number": "ID/Passport number",
  "id_type": "passport, drivers_license, national_id, etc.",
  "nationality": "Nationality/Country of issuance",
  "expiration_date": "Expiration date (YYYY-MM-DD)",
  "address": "Address if shown on ID (null if not present)",
  "gender": "M or F if shown"
}
If a field cannot be found, use null.`,

  bank_statement: `Extract the following fields from this bank statement. Return ONLY a JSON object:
{
  "bank_name": "Name of the bank",
  "account_holder_name": "Name on the account",
  "account_number_last4": "Last 4 digits of account number only",
  "routing_number": "Routing/ABA number if shown",
  "swift_code": "SWIFT/BIC code if shown",
  "account_type": "checking, savings, etc.",
  "statement_date": "Statement date (YYYY-MM-DD)",
  "currency": "Currency of the account (USD, EUR, etc.)",
  "bank_address": "Bank branch address if shown"
}
If a field cannot be found, use null. NEVER return the full account number, only last 4 digits.`,

  proof_of_address: `Extract the following fields from this proof of address document (utility bill, bank letter, government letter). Return ONLY a JSON object:
{
  "entity_or_person_name": "Name of person or entity on document",
  "address_line1": "Street address line 1",
  "address_line2": "Apt/Suite/Unit if applicable",
  "city": "City",
  "state": "State/Province",
  "zip_code": "ZIP/Postal code",
  "country": "Country",
  "document_date": "Date of document (YYYY-MM-DD)",
  "issuer": "Who issued the document (utility company, bank, etc.)"
}
If a field cannot be found, use null.`,
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { file_path, document_type, company_id, document_id } = await req.json()

    if (!file_path || !document_type || !company_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: file_path, document_type, company_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role for storage access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('kyb-documents')
      .download(file_path)

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({ error: 'Failed to download file', details: downloadError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Convert file to base64
    const arrayBuffer = await fileData.arrayBuffer()
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    // Determine media type
    const extension = file_path.split('.').pop()?.toLowerCase()
    let mediaType = 'application/pdf'
    if (extension === 'jpg' || extension === 'jpeg') mediaType = 'image/jpeg'
    else if (extension === 'png') mediaType = 'image/png'
    else if (extension === 'webp') mediaType = 'image/webp'

    // Get extraction prompt
    const extractionPrompt = EXTRACTION_PROMPTS[document_type] || EXTRACTION_PROMPTS['corporate_document']

    // Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: mediaType === 'application/pdf' ? 'document' : 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: extractionPrompt,
              },
            ],
          },
        ],
      }),
    })

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text()
      return new Response(
        JSON.stringify({ error: 'Claude API error', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const claudeResult = await claudeResponse.json()
    const extractedText = claudeResult.content?.[0]?.text || '{}'

    // Parse extracted JSON (Claude sometimes wraps in markdown code blocks)
    let extractedFields: Record<string, unknown> = {}
    try {
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        extractedFields = JSON.parse(jsonMatch[0])
      }
    } catch {
      console.error('Failed to parse extraction result:', extractedText)
      extractedFields = { _raw: extractedText, _parse_error: true }
    }

    // Save extracted fields to kyb_documents table
    if (document_id) {
      await supabase
        .from('kyb_documents')
        .update({ extracted_fields: extractedFields })
        .eq('id', document_id)
    }

    // Merge extracted data into kyb_applications.extracted_data
    const { data: app } = await supabase
      .from('kyb_applications')
      .select('extracted_data')
      .eq('company_id', company_id)
      .single()

    const currentExtracted = (app?.extracted_data as Record<string, unknown>) || {}
    const mergedData = {
      ...currentExtracted,
      [document_type]: extractedFields,
      _last_updated: new Date().toISOString(),
    }

    await supabase
      .from('kyb_applications')
      .update({ extracted_data: mergedData })
      .eq('company_id', company_id)

    return new Response(
      JSON.stringify({
        success: true,
        document_type,
        extracted_fields: extractedFields,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal error', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
