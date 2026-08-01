import { getPreferenceValues, open } from "@raycast/api";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export type Editor = "Cursor" | "Zed";

interface Preferences {
  editor: Editor;
}

export function getPreferredEditor(): Editor {
  const { editor } = getPreferenceValues<Preferences>();
  return editor ?? "Cursor";
}

export async function openInEditor(pathToOpen: string, editor: Editor = getPreferredEditor()): Promise<void> {
  if (editor === "Zed") {
    await execAsync(`zed "${pathToOpen}"`);
  } else {
    await open(pathToOpen, "Cursor");
  }
}
