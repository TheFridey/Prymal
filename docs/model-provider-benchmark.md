# INTERNAL ONLY - Model and Media Provider Benchmarking

This document is for Prymal operator review only. It is not customer-facing marketing copy and must not be exposed in normal workspace surfaces.

## Current Internal Providers

- OpenAI
- Anthropic
- Gemini/Veo

## Optional Image Providers To Evaluate

- GPT Image
- Imagen 4

## Optional Video Providers To Evaluate

- Sora 2
- Runway
- Luma
- Kling

## Evaluation Criteria

- Cost
- Latency
- Quality
- Prompt adherence
- Brand consistency
- Text rendering
- Safety refusal rate
- API maturity
- Commercial rights
- Moderation

## Suggested Benchmark Workflow

1. Pick one scenario family at a time: grounded text, outbound copy, SEO audit, structured extraction, image generation, or video generation.
2. Freeze the prompt set and brand references before comparing providers.
3. Run the same scenario multiple times per provider to capture consistency, not just best-case output.
4. Record only internal operator notes, evidence artifacts, and commercial observations.
5. Keep customer-facing product copy Prymal-native even when the internal routing stack changes.

## Output Template

Use:

```bash
cd backend
node scripts/model-provider-benchmark-template.mjs
```

The script prints a JSON scaffold only. It does not call any external APIs, consume credits, or require secrets.
