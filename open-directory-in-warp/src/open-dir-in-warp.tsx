import { ActionPanel, Action, Icon, List, showToast, Toast, open, LocalStorage } from "@raycast/api";
import { useEffect, useMemo } from "react";
import fs from "fs";
import path from "path";
import { create } from "zustand";

interface Folder {
  name: string;
  path: string;
}

interface AppState {
  folders: Folder[];
  recentFolders: Folder[];
  isLoading: boolean;
  setFolders: (folders: Folder[]) => void;
  setRecentFolders: (folders: Folder[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  addRecentFolder: (folder: Folder) => void;
  clearRecentFolders: () => void;
}

const RECENT_FOLDERS_KEY = "recentFolders";
const MAX_RECENT_FOLDERS = 10;
const HOME_DIR = process.env.HOME || "";
const WORK_DIR = path.join(HOME_DIR, "Work");

const SEARCH_PATHS = [
  path.join(WORK_DIR, "bmads"),
  path.join(WORK_DIR, "pet-projects"),
  path.join(WORK_DIR, "projects"),
  path.join(WORK_DIR, "raycast-extensions"),
];

const useStore = create<AppState>((set) => ({
  folders: [],
  recentFolders: [],
  isLoading: true,
  setFolders: (folders) => set({ folders }),
  setRecentFolders: (recentFolders) => set({ recentFolders }),
  setIsLoading: (isLoading) => set({ isLoading }),
  addRecentFolder: (folder) =>
    set((state) => {
      const updatedRecentFolders = [folder, ...state.recentFolders.filter((f) => f.path !== folder.path)].slice(
        0,
        MAX_RECENT_FOLDERS,
      );
      LocalStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(updatedRecentFolders));
      return { recentFolders: updatedRecentFolders };
    }),
  clearRecentFolders: () => {
    LocalStorage.removeItem(RECENT_FOLDERS_KEY);
    set({ recentFolders: [] });
  },
}));

export default function Command() {
  const { folders, recentFolders, isLoading, setFolders, setRecentFolders, setIsLoading, addRecentFolder, clearRecentFolders } = useStore();

  useEffect(() => {
    const loadFolders = async () => {
      const getFoldersFromPath = (dirPath: string): Folder[] => {
        try {
          if (!fs.existsSync(dirPath)) {
            console.warn(`Path does not exist: ${dirPath}`);
            return [];
          }
          const entries = fs.readdirSync(dirPath, { withFileTypes: true });
          return entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => ({
              name: entry.name,
              path: path.join(dirPath, entry.name),
            }));
        } catch (err) {
          console.error(`Error reading directory ${dirPath}:`, err);
          return [];
        }
      };

      try {
        const allFolders = SEARCH_PATHS.flatMap(getFoldersFromPath);
        setFolders(allFolders);

        const storedRecentFolders = await LocalStorage.getItem<string>(RECENT_FOLDERS_KEY);
        if (storedRecentFolders) {
          setRecentFolders(JSON.parse(storedRecentFolders));
        }
      } catch (err) {
        showToast(Toast.Style.Failure, "Error reading folders", err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    };

    loadFolders();
  }, []);

  const openInWarp = async (folder: Folder) => {
    try {
      // Use Raycast's open API - returns immediately, no waiting for Warp to launch
      await open(folder.path, "Warp");
      await showToast(Toast.Style.Success, "Opened in Warp", folder.path);
      addRecentFolder(folder);
    } catch (error) {
      await showToast(Toast.Style.Failure, "Failed to open in Warp", String(error));
    }
  };

  const handleClearRecentFolders = async () => {
    clearRecentFolders();
    await showToast(Toast.Style.Success, "Recent folders cleared");
  };

  const getDisplayPath = (folderPath: string) => {
    return `~/Work/${path.relative(WORK_DIR, folderPath)}`;
  };

  const renderFolderItem = (folder: Folder, isRecent: boolean) => (
    <List.Item
      key={folder.path}
      icon={Icon.Folder}
      title={folder.name}
      subtitle={getDisplayPath(folder.path)}
      accessories={isRecent ? [{ icon: Icon.Clock, tooltip: "Recently opened" }] : []}
      actions={
        <ActionPanel>
          <Action title="Open in Warp" onAction={() => openInWarp(folder)} />
          <Action.CopyToClipboard content={folder.path} />
        </ActionPanel>
      }
    />
  );

  const otherFolders = useMemo(() => {
    const recentSet = new Set(recentFolders.map((f) => f.path));
    return folders.filter((f) => !recentSet.has(f.path));
  }, [recentFolders, folders]);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search folders...">
      <List.Section title="Recent Folders">
        {recentFolders.map((folder) => renderFolderItem(folder, true))}
      </List.Section>

      <List.Section title="All Folders" subtitle={`${otherFolders.length} folders`}>
        {otherFolders.map((folder) => renderFolderItem(folder, false))}
      </List.Section>

      {recentFolders.length > 0 && (
        <List.Section>
          <List.Item
            icon={Icon.Trash}
            title="Clear Recent Folders"
            subtitle="Remove all recent folders from history"
            actions={
              <ActionPanel>
                <Action title="Clear Recent Folders" onAction={handleClearRecentFolders} />
              </ActionPanel>
            }
          />
        </List.Section>
      )}
    </List>
  );
}
