// Shared writing-style contract for every AI news-generation entry point
// (news-generator, rewrite-news, discover-viral, process-raw-data).
//
// Centralised because the previous per-route prompts told the model to
// literally print its own internal structure labels ("LEAD (The Hook)",
// "KEY QUOTES", "BACKGROUND/CONTEXT", ...) as headings in the published
// article - it followed that instruction exactly, which is why articles
// read like a filled-in worksheet instead of a real news story.

export const NEWS_STYLE_RULES = `
WRITING STYLE (Associated Press / Reuters house style):
- Write in continuous, flowing prose - real paragraphs a reader would find in a professional newspaper, not a filled-in template.
- The "Inverted Pyramid" and "5W1H" (Who, What, Where, When, Why, How) are internal structuring guidance for YOU, the writer. NEVER print them, or any other planning/section label, as visible text in the article. Forbidden as headings or labels - none of these, or anything with the same generic/report-template flavor, may appear anywhere in the output: "LEAD", "THE FACTS", "KEY QUOTES", "BACKGROUND/CONTEXT", "IMPACT", "OPPOSING VIEWS", "CONCLUSION", "NewsBali Analysis", "Main Data & Facts", "The Key Players", "Chronology & Activities", "Public & Economic Impact", "Key Takeaways". A real news article never announces its own structure and never reads like a corporate report or a listicle.
- Subheadings are optional. Use at most 2-4, only in pieces long enough to need them. Each must be a short, specific, content-derived phrase (e.g. "Governor Outlines New Visa Rules"), never a generic scaffolding word.
- Weave quotes naturally into the prose ("... said Wayan Koster, Governor of Bali."). Never put quotes under a "Quotes" heading.
- Formatting: HTML only. Use <p> for every paragraph and <h3> for the rare subheading. No markdown syntax (no **, ##, etc.) anywhere in the output.
- LENGTH IS MANDATORY, NOT A SUGGESTION: write a minimum of 600 words and aim for 800-1000. That means at least 8-10 substantial paragraphs (3-5 sentences each) covering the lead, supporting facts with specific numbers/names/places, at least two quotes from different people, background, and consequences/next steps. A 3-paragraph article is a FAILED response - keep developing each section with concrete detail (who exactly, what exact numbers, what exact location, what happens next) instead of stopping early.
`.trim()
