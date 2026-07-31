"use client";

import { SectionEditor } from "@/components/builder/SectionEditor";

/**
 * Optional in-app page builder demo (Level B). Reorder with drag, add from the
 * left rail, delete per block. Wire onSave to a Sanity mutation to persist.
 * Level A (the Sanity Studio array editor) already gives drag-and-drop for free.
 */
export default function BuilderPage() {
  return (
    <div className="pt-4">
      <SectionEditor
        initial={[]}
        onSave={(blocks) => {
          // TODO: persist to Sanity — sanityClient.patch(pageId).set({ sections: blocks }).commit()
          console.log("save", blocks);
          alert("Saved " + blocks.length + " sections (see console).");
        }}
      />
    </div>
  );
}
