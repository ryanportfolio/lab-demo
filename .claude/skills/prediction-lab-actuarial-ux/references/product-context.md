# Prediction Lab product context

Last verified: 2026-08-06. Treat release details as time-sensitive and recheck official sources before making current-state claims.

## Product promise

Prediction Lab positions itself as predictive modeling software purpose-built for insurance professionals. The promise is faster time to insight across the full modeling lifecycle without giving up control: fast fits, versioned changes, context-aware AI, audit trails, collaboration, review, and deployment.

The relevant audience is a power user operating inside regulatory and business constraints, not a beginner using a generic AutoML product.

Official sources:

- [Prediction Lab](https://www.predictionlab.ai/)
- [Prediction Lab changelog](https://www.predictionlab.ai/changelog)
- [Terms of Service](https://www.predictionlab.ai/legal/terms)
- [Privacy Policy](https://www.predictionlab.ai/legal/privacy)

## Three AI layers from Ryan Style's ITC talk

The talk describes three complementary roles:

1. **Product expert:** understands how to use the product, returns transparent sources, and navigates the user to the relevant capability.
2. **Context expert:** assembles fit output, diagnostics, data context, and visualization so meaningful follow-up questions become cheap.
3. **Modeling agent:** performs bounded modeling tasks and experiments while collaborating with users through the same versioned, permissioned platform.

Source: [ITC talk](https://vimeo.com/1131288047), transcript supplied by the project owner.

## Current product direction

Recent official releases reinforce the same principles:

- AI agents can traverse the modeling pipeline, inspect artifacts, ingest data, set filters and partitions, fit models, and read results without raw queries.
- Review diffs show field-level and before/after changes, impact summaries, affected models, merge previews, and rebasing.
- Charts pair with exact table values and retain active filters, partitions, targets, and titles in shared output.
- Long-running work reports plain progress and remains cancelable where possible.
- Lorenz curves, Gini, feature importance, model effects, geographies, and distribution views reflect insurance modeling rather than generic ML alone.
- Model import/export supports handoff, archiving, and migration from legacy software.
- AI is optional and bounded by professional judgment. Customer data is not used to train shared AI models; BYOK and local-model options exist.

## Product implications

- AI should inhabit the workflow, not sit in a detached chat window.
- Versioning and review are product primitives, not engineering decoration.
- Fast computation matters because it changes how many questions an actuary can afford to ask.
- Transparency must cover both statistical evidence and agent action.
- Local, cloud, single-tenant, and BYOC modes make active environment and data boundaries part of context.
