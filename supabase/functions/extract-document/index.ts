// Midi KYB Portal - Document Extraction Edge Function
// Uses Claude API to extract structured data from uploaded documents

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EXTRACTION_PROMPTS = {
  company_governance: `Extract the following fields from this corporate governance document. Return ONLY a JSON object with these fields:
{
  "entity_name": "Full legal name of the company",
  "trade_name": "Trade name or DBA if different from legal name, otherwise same as entity_name",
  "type_of_company": "LLC, Corporation, Partnership, Limited Liability Company, etc.",
  "country_of_registration": "Country where registered",
  "state_of_registration": "State/Province if applicable",
  "registration_number": "Registration or filing number",
  "tin_ein": "Tax ID or EIN if shown",
  "registration_date": "Date of registration (YYYY-MM-DD)",
  "entity_address": "Registered address of the company",
  "beneficial_owners": [{"name": "Full name", "title": "Title/Position", "ownership_percentage": "Percentage as number", "is_control_person": true}],
  "authorized_signatories": ["Name 1", "Name 2"]
}
If a field cannot be found, use null. For arrays, return empty array if not found.`,

  organization_chart: `Extract the following fields from this organization chart or ownership structure document. Return ONLY a JSON object with these fields:
{
  "entity_name": "Name of the main/parent company",
  "beneficial_owners": [{"name": "Full name of owner/shareholder", "title": "Title/Position", "ownership_percentage": "Percentage as number", "is_control_person": true}],
  "subsidiaries": [{"name": "Subsidiary name", "ownership_percentage": "Percentage owned", "country": "Country of incorporation"}],
  "control_persons": ["Name of person with significant control"]
}
If a field cannot be found, use null. For arrays, return empty array if not found.`,

  id_documents: `Extract the following fields from this government-issued photo ID. Return ONLY a JSON object:
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
  "bank_address": "Bank branch address if shown",
  "entity_address": "Account holder address if shown"
}
If a field cannot be found, use null. NEVER return the full account number, only last 4 digits.`,
}

// Helper: convert ArrayBuffer to base64 in chunks (avoids stack overflow)
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { file_path, document_type, company_id, document_id } = await req.json()

    console.log('[extract-document] Starting extraction:', { document_type, file_path, company_id, document_id })

    if (!file_path || !document_type || !company_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: file_path, document_type, company_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      console.error('[extract-document] ANTHROPIC_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('[extract-document] Downloading file from storage:', file_path)
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('kyb-documents')
      .download(file_path)

    if (downloadError || !fileData) {
      console.error('[extract-document] Download error:', downloadError?.message)
      return new Response(
        JSON.stringify({ error: 'Failed to download file', details: downloadError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const arrayBuffer = await fileData.arrayBuffer()
    console.log('[extract-document] File downloaded, size:', arrayBuffer.byteLength, 'bytes')
    
    // Use chunked base64 conversion to avoid stack overflow on large files
    const base64Data = arrayBufferToBase64(arrayBuffer)
    console.log('[extract-document] Base64 conversion complete, length:', base64Data.length)

    const extension = file_path.split('.').pop()?.toLowerCase()
    let mediaType = 'application/pdf'
    if (extension === 'jpg' || extension === 'jpeg') mediaType = 'image/jpeg'
    else if (extension === 'png') mediaType = 'image/png'
    else if (extension === 'webp') mediaType = 'image/webp'

    const extractionPrompt = EXTRACTION_PROMPTS[document_type] || EXTRACTION_PROMPTS['company_governance']
    console.log('[extract-document] Calling Claude API, type:', document_type, 'mediaType:', mediaType)

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
        messages: [{
          role: 'user',
          content: [
            {
              type: mediaType === 'application/pdf' ? 'document' : 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            { type: 'text', text: extractionPrompt },
          ],
        }],
      }),
    })

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text()
      console.error('[extract-document] Claude API error (' + claudeResponse.status + '):', errorText)
      return new Response(
        JSON.stringify({ error: 'Claude API error', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const claudeResult = await claudeResponse.json()
    const extractedText = claudeResult.content?.[0]?.text || '{}'
    console.log('[extract-document] Claude response received, text length:', extractedText.length)

    let extractedFields = {}
    try {
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        extractedFields = JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      console.error('[extract-document] Failed to parse extraction result:', extractedText)
      extractedFields = { _raw: extractedText, _parse_error: true }
    }

    console.log('[extract-document] Extracted fields keys:', Object.keys(extractedFields))

    if (document_id) {
      const { error: docUpdateError } = await supabase
        .from('kyb_documents')
        .update({ extracted_fields: extractedFields })
        .eq('id', document_id)
      if (docUpdateError) {
        console.error('[extract-document] Failed to update kyb_documents:', docUpdateError.message)
      } else {
        console.log('[extract-document] Updated kyb_documents for doc', document_id)
      }
    }

    const { data: app, error: appFetchError } = await supabase
      .from('kyb_applications')
      .select('extracted_data')
      .eq('company_id', company_id)
      .single()

    if (appFetchError) {
      console.error('[extract-document] Failed to fetch kyb_applications:', appFetchError.message)
    }

    const currentExtracted = app?.extracted_data || {}
    const mergedData = {
      ...currentExtracted,
      [document_type]: extractedFields,
      _last_updated: new Date().toISOString(),
    }

    const { error: appUpdateError } = await supabase
      .from('kyb_applications')
      .update({ extracted_data: mergedData })
      .eq('company_id', company_id)

    if (appUpdateError) {
      console.error('[extract-document] Failed to update kyb_applications:', appUpdateError.message)
    } else {
      console.log('[extract-document] Updated extracted_data with', document_type, 'data')
    }

    return new Response(
      JSON.stringify({ success: true, document_type, extracted_fields: extractedFields }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[extract-document] Internal error:', error.message, error.stack)
    return new Response(
      JSON.stringify({ error: 'Internal error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})