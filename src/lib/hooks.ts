// ─── JINTA Story Sequences ───
// Each batch tells a connected story: Hook → Problem → Pain → Shift → Resolution
// The LAST slide is always the CTA (added by the API route, not here).

export interface StorySlide {
  text: string;
  role: "hook" | "problem" | "deepen" | "shift" | "resolve";
}

export interface StorySequence {
  id: string;
  name: string;
  slides: StorySlide[];
}

/**
 * Pre-built narrative arcs. Each sequence is designed to flow
 * like a TikTok carousel — every slide connects to the next.
 *
 * Batches of 5: 4 story slides + 1 CTA (appended by the engine).
 * Batches of 10: 2 sequences joined + 1 CTA.
 * Batches of 15: 3 sequences joined + 1 CTA.
 * Batches of 20: 4 sequences joined + 1 CTA.
 */
export const STORY_SEQUENCES: StorySequence[] = [
  {
    id: "dopamine-trap",
    name: "The Dopamine Trap",
    slides: [
      { text: "The dopamine hit lasts 4 minutes. The damage lasts years.", role: "hook" },
      { text: "Every relapse resets your ability to feel real pleasure.", role: "problem" },
      { text: "You can't build an empire with a hijacked reward system.", role: "deepen" },
      { text: "Dopamine receptors take 90 days to reset. Most people quit on day 3.", role: "shift" },
    ],
  },
  {
    id: "2am-identity",
    name: "The 2AM Test",
    slides: [
      { text: "Who you are at 2am is who you actually are.", role: "hook" },
      { text: "The men you admire most don't spend their nights like this.", role: "problem" },
      { text: "Discipline in private creates confidence in public.", role: "deepen" },
      { text: "The version of you that quit is waiting on the other side.", role: "shift" },
    ],
  },
  {
    id: "silent-war",
    name: "The Silent War",
    slides: [
      { text: "40 million men report compulsive use. Most don't know it's a problem.", role: "hook" },
      { text: "85% of relapses happen in under 3 minutes of impulse.", role: "problem" },
      { text: "The average relapse happens on a phone. The same one you're on right now.", role: "deepen" },
      { text: "Porn isn't the habit. Escaping discomfort is. That's what needs fixing.", role: "shift" },
    ],
  },
  {
    id: "clarity-path",
    name: "The Clarity Path",
    slides: [
      { text: "Porn is programming your brain to fail. You just can't feel it yet.", role: "hook" },
      { text: "Free time isn't free if you waste it the same way every night.", role: "problem" },
      { text: "Your focus is worth more than anything you're consuming.", role: "deepen" },
      { text: "90 days clean. Watch what changes first — it's not what you expect.", role: "shift" },
    ],
  },
  {
    id: "future-self",
    name: "Your Future Self",
    slides: [
      { text: "Your future self is watching. He's disappointed or he's proud.", role: "hook" },
      { text: "Real men don't need a filter. They need a standard.", role: "problem" },
      { text: "The car. The clarity. The confidence. It starts with one decision.", role: "deepen" },
      { text: "The best version of you has already decided.", role: "shift" },
    ],
  },
];

/** The CTA text for the final slide in every batch. */
export const CTA_SLIDE_TEXT =
  "Ready to transform your life?\n\nSign up to our waitlist to get free access to JINTA when we launch.";

export const CTA_SLIDE_SUBTEXT = "Link in bio →";

/**
 * Selects story sequences to fill a batch of `count` slides.
 * Returns (count - 1) story slides — the last slot is reserved for the CTA.
 */
export function getStorySlides(count: number): StorySlide[] {
  const storySlots = count - 1; // Reserve 1 for CTA
  const shuffled = [...STORY_SEQUENCES].sort(() => Math.random() - 0.5);

  const result: StorySlide[] = [];
  let seqIndex = 0;

  while (result.length < storySlots) {
    const seq = shuffled[seqIndex % shuffled.length];
    // Add all slides from this sequence
    for (const slide of seq.slides) {
      if (result.length >= storySlots) break;
      result.push(slide);
    }
    seqIndex++;
  }

  return result.slice(0, storySlots);
}

/**
 * Returns the display name for a slide role.
 */
export function getRoleLabel(role: StorySlide["role"] | "cta"): string {
  const labels: Record<string, string> = {
    hook: "Hook",
    problem: "Problem",
    deepen: "Deepening",
    shift: "Shift",
    resolve: "Resolution",
    cta: "Call to Action",
  };
  return labels[role] || role;
}

// Slide dimensions (TikTok 9:16)
export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1920;
