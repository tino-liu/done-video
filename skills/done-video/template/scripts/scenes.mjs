// The voice script, one clip per scene. SCRIPT.md is the readable version; this file is what
// scripts/voice.mjs speaks. Edit a line here, run `npm run voice`, and the video re-times itself.
// Every id here needs a matching entry in src/scenes/index.tsx.
//
// lead / tail: seconds of picture before the voice starts and after it ends.
// minSeconds: the shortest the scene may be, for scenes whose animation needs more room than the line.
// transition: how the scene enters. "fade" crossfades from the previous scene (right for one browser
// window replacing another at the same zoom); "dip" fades the previous scene out before this one fades
// in, for any scene that starts or ends on a text card or a zoomed shot; "none" cuts, used where the
// picture carries straight on from the scene before.
// chapter: the "Step n of N" pill shown while the scene plays. Scenes that share a chapter share a step.
// captions: false for title cards, whose words are already on screen.
// captionBottom: pixels from the bottom, to lift captions over a bar along the bottom of the window.
// recording: the line is the presenter talking inside a screen recording; mixed drier, captioned in italics.
export const FPS = 30

export const scenes = [
  {
    id: "intro",
    lead: 0.5,
    tail: 0.6,
    minSeconds: 3.6,
    transition: "fade",
    captions: false,
    text: "Hi everyone, Alex here from Acme!",
  },
  {
    id: "title",
    lead: 0.3,
    tail: 1.2,
    minSeconds: 3.6,
    transition: "dip",
    captions: false,
    text: "Our latest PBI is done: you can now export your tasks to CSV.",
  },
  {
    id: "demo",
    lead: 0.5,
    tail: 2.6, // room after the last word for the toast
    minSeconds: 12,
    transition: "dip",
    chapter: "Export to CSV",
    text: "Open any project, click Export, and choose CSV. The file downloads straight away, with every task, its owner and its due date.",
  },
  {
    id: "outro",
    lead: 0.4,
    tail: 2.2,
    transition: "dip",
    captions: false,
    text: "That's done and ready for review. This is Alex, signing off.",
  },
]
