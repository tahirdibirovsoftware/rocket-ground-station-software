/**
 * FlightArtifactsPage — Flight Session Artifacts Archive
 *
 * Displays all recorded mission flight sessions, CSV logs, unified Excel-ready logs,
 * and MP4 video recordings with cross-platform folder/file access & dual video playback (In-App + System Player).
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import {
  FolderArchive,
  FolderOpen,
  Play,
  Trash2,
  RefreshCw,
  Search,
  FileSpreadsheet,
  Film,
  HardDrive,
  ExternalLink,
  X,
} from "lucide-react";
import { IPC_COMMANDS } from "@shared/config/constants";
import { PanelContainer } from "@shared/ui";

export interface ArtifactFile {
  name: string;
  path: string;
  size_bytes: number;
}

export interface FlightArtifact {
  folder_name: string;
  folder_path: string;
  created_at: string;
  files: ArtifactFile[];
  has_video: boolean;
  total_size_bytes: number;
}

/** Helper to format file sizes */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function FlightArtifactsPage() {
  const { t } = useTranslation();

  const [artifacts, setArtifacts] = useState<FlightArtifact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeVideoPath, setActiveVideoPath] = useState<string | null>(null);

  // Load flight artifacts from backend
  const loadArtifacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<FlightArtifact[]>(IPC_COMMANDS.LIST_FLIGHT_ARTIFACTS);
      setArtifacts(data || []);
    } catch (err) {
      console.error("Failed to list flight artifacts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArtifacts();
  }, [loadArtifacts]);

  // Cross-platform open folder in OS native file explorer (Linux/Windows/macOS)
  const handleOpenFolder = async (folderPath: string) => {
    try {
      await invoke(IPC_COMMANDS.OPEN_ARTIFACT_FOLDER, { folderPath });
    } catch (err) {
      console.error("Failed to open artifact folder:", err);
    }
  };

  // Cross-platform open individual file (CSV in Excel / MP4 in VLC)
  const handleOpenFile = async (filePath: string) => {
    try {
      await invoke(IPC_COMMANDS.OPEN_ARTIFACT_FILE, { filePath });
    } catch (err) {
      console.error("Failed to open artifact file:", err);
    }
  };

  // Delete flight session artifact folder
  const handleDeleteFolder = async (folderPath: string) => {
    if (!window.confirm("Are you sure you want to delete this flight recording & log folder?")) {
      return;
    }
    try {
      await invoke(IPC_COMMANDS.DELETE_ARTIFACT_FOLDER, { folderPath });
      await loadArtifacts();
    } catch (err) {
      console.error("Failed to delete artifact folder:", err);
    }
  };

  // Filter artifacts by search query
  const filteredArtifacts = useMemo(() => {
    if (!searchQuery.trim()) return artifacts;
    const q = searchQuery.toLowerCase();
    return artifacts.filter(
      (art) =>
        art.folder_name.toLowerCase().includes(q) ||
        art.created_at.toLowerCase().includes(q) ||
        art.files.some((f) => f.name.toLowerCase().includes(q)),
    );
  }, [artifacts, searchQuery]);

  // Calculate total disk storage of all flight artifacts
  const totalStorageBytes = useMemo(() => {
    return artifacts.reduce((sum, art) => sum + art.total_size_bytes, 0);
  }, [artifacts]);

  return (
    <div
      id="flight-artifacts-page"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.875rem",
        padding: "0.5rem",
        height: "100%",
      }}
    >
      {/* ── Top Header Controls Bar ── */}
      <PanelContainer
        id="artifacts-header-panel"
        title={t("nav.flightArtifacts", "Flight Session Artifacts Archive")}
        icon={<FolderArchive size={16} />}
        headerRight={
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span
              style={{
                fontSize: "0.6875rem",
                color: "var(--color-text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
              }}
            >
              <HardDrive size={13} style={{ color: "var(--color-status-nominal)" }} />
              Total Storage: <strong style={{ color: "var(--color-text-primary)" }}>{formatBytes(totalStorageBytes)}</strong>
            </span>
            <button
              onClick={loadArtifacts}
              disabled={loading}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-text-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.25rem",
                backgroundColor: "var(--color-bg-tertiary)",
              }}
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} style={{ marginRight: 4 }} />
              Refresh
            </button>
          </div>
        }
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Search Filter Input */}
          <div
            style={{
              position: "relative",
              flex: 1,
              display: "flex",
              alignItems: "center",
            }}
          >
            <Search
              size={14}
              style={{
                position: "absolute",
                left: "0.625rem",
                color: "var(--color-text-muted)",
              }}
            />
            <input
              type="text"
              placeholder="Search flight recordings by timestamp, CSV logs, or filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "0.375rem 0.625rem 0.375rem 2rem",
                fontSize: "0.75rem",
                backgroundColor: "var(--color-bg-tertiary)",
                border: "1px solid var(--color-border-default)",
                borderRadius: "0.25rem",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
          </div>
        </div>
      </PanelContainer>

      {/* ── Flight Artifacts Grid ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: "0.75rem",
          overflowY: "auto",
        }}
      >
        {filteredArtifacts.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "3rem 1rem",
              textAlign: "center",
              backgroundColor: "var(--color-bg-secondary)",
              borderRadius: "0.375rem",
              border: "1px dashed var(--color-border-default)",
            }}
          >
            <FolderArchive size={32} style={{ color: "var(--color-text-muted)", marginBottom: "0.5rem" }} />
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
              No Flight Artifacts Recorded Yet
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
              Connect RFD Receiver or start a Mock Simulation to automatically record flight CSV logs and camera videos.
            </div>
          </div>
        ) : (
          filteredArtifacts.map((artifact) => {
            const videoFile = artifact.files.find(
              (f) => f.name.endsWith(".mp4") || f.name.endsWith(".mkv") || f.name.endsWith(".avi"),
            );

            return (
              <div
                key={artifact.folder_name}
                style={{
                  backgroundColor: "var(--color-bg-secondary)",
                  border: "1px solid var(--color-border-default)",
                  borderRadius: "0.375rem",
                  padding: "0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.625rem",
                  transition: "border-color 150ms ease",
                }}
              >
                {/* Header info */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        color: "var(--color-text-primary)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {artifact.folder_name}
                    </div>
                    <div style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", marginTop: 2 }}>
                      Recorded: {artifact.created_at}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "0.625rem",
                      padding: "0.15rem 0.4rem",
                      borderRadius: "0.2rem",
                      backgroundColor: "var(--color-bg-tertiary)",
                      color: "var(--color-text-secondary)",
                      border: "1px solid var(--color-border-default)",
                      fontWeight: 600,
                    }}
                  >
                    {formatBytes(artifact.total_size_bytes)}
                  </span>
                </div>

                {/* File Badges */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                  <span
                    style={{
                      fontSize: "0.625rem",
                      padding: "0.2rem 0.4rem",
                      borderRadius: "0.25rem",
                      backgroundColor: "rgba(0, 255, 136, 0.1)",
                      color: "var(--color-status-nominal)",
                      border: "1px solid rgba(0, 255, 136, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <FileSpreadsheet size={10} /> Unified Log (CSV)
                  </span>
                  {artifact.has_video && (
                    <span
                      style={{
                        fontSize: "0.625rem",
                        padding: "0.2rem 0.4rem",
                        borderRadius: "0.25rem",
                        backgroundColor: "rgba(0, 200, 255, 0.15)",
                        color: "#00c8ff",
                        border: "1px solid rgba(0, 200, 255, 0.3)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontWeight: 600,
                      }}
                    >
                      <Film size={10} /> Video MP4
                    </span>
                  )}
                </div>

                {/* Files List — Click any file to open directly in OS default application */}
                <div
                  style={{
                    backgroundColor: "var(--color-bg-tertiary)",
                    borderRadius: "0.25rem",
                    padding: "0.375rem 0.5rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.375rem",
                    fontSize: "0.6875rem",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {artifact.files.map((file) => (
                    <div
                      key={file.name}
                      onClick={() => handleOpenFile(file.path)}
                      title="Click to open file in default system application"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontFamily: "var(--font-mono)",
                        cursor: "pointer",
                        padding: "0.15rem 0.25rem",
                        borderRadius: "0.2rem",
                        transition: "background 100ms ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%", display: "flex", alignItems: "center", gap: 4 }}>
                        <ExternalLink size={10} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                        {file.name}
                      </span>
                      <span style={{ color: "var(--color-text-muted)" }}>{formatBytes(file.size_bytes)}</span>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: "0.375rem", marginTop: "auto", paddingTop: "0.25rem" }}>
                  {videoFile && (
                    <button
                      onClick={() => setActiveVideoPath(videoFile.path)}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.375rem",
                        padding: "0.35rem 0.5rem",
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        backgroundColor: "var(--color-status-nominal)",
                        color: "#000",
                        border: "none",
                        borderRadius: "0.25rem",
                        cursor: "pointer",
                      }}
                    >
                      <Play size={12} fill="#000" /> Watch Video
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenFolder(artifact.folder_path)}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.375rem",
                      padding: "0.35rem 0.5rem",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      backgroundColor: "var(--color-bg-tertiary)",
                      color: "var(--color-text-primary)",
                      border: "1px solid var(--color-border-default)",
                      borderRadius: "0.25rem",
                      cursor: "pointer",
                    }}
                  >
                    <FolderOpen size={12} /> Open Folder
                  </button>
                  <button
                    onClick={() => handleDeleteFolder(artifact.folder_path)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0.35rem",
                      backgroundColor: "rgba(255, 68, 68, 0.1)",
                      color: "var(--color-status-critical)",
                      border: "1px solid rgba(255, 68, 68, 0.2)",
                      borderRadius: "0.25rem",
                      cursor: "pointer",
                    }}
                    title="Delete session recording"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Video Player Modal with Dual Playback Support ── */}
      {activeVideoPath && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 860,
              backgroundColor: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border-default)",
              borderRadius: "0.5rem",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem 1rem",
                backgroundColor: "var(--color-bg-tertiary)",
                borderBottom: "1px solid var(--color-border-default)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Film size={16} style={{ color: "var(--color-status-nominal)" }} />
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
                  Payload Camera Playback
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {/* External System Player Button (VLC / MPV / Totem) */}
                <button
                  onClick={() => handleOpenFile(activeVideoPath)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    backgroundColor: "var(--color-bg-secondary)",
                    color: "var(--color-status-nominal)",
                    border: "1px solid rgba(0, 255, 136, 0.3)",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                  }}
                  title="Open video in system default player (VLC / MPV)"
                >
                  <ExternalLink size={12} /> Open in VLC / System Player
                </button>
                <button
                  onClick={() => setActiveVideoPath(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-text-muted)",
                    cursor: "pointer",
                    padding: "0.25rem",
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Video Player Element */}
            <div style={{ width: "100%", backgroundColor: "#000", aspectRatio: "16/9", position: "relative" }}>
              <video
                src={convertFileSrc(activeVideoPath)}
                controls
                autoPlay
                style={{
                  width: "100%",
                  height: "100%",
                }}
                onError={() => {
                  console.warn("In-app video element failed. Use System Player button.");
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
