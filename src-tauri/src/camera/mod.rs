//! Camera module — Native V4L2 / FFmpeg camera capture, streaming, and crash-resilient session recording.
//!
//! Provides automatic USB camera detection, streams JPEG frames to the
//! React frontend via Tauri IPC events, and records crash-resilient MP4 video directly
//! into the active flight session folder (`payload_camera.mp4`) with YUV420P browser compatibility.

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

/// Information about a detected video capture device.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CameraDeviceInfo {
    pub id: String,
    pub name: String,
    pub is_usb: bool,
}

/// Global managed state for native camera streaming.
pub struct CameraState {
    pub child_process: Arc<Mutex<Option<Child>>>,
    pub active_device: Arc<Mutex<Option<String>>>,
}

impl CameraState {
    pub fn new() -> Self {
        Self {
            child_process: Arc::new(Mutex::new(None)),
            active_device: Arc::new(Mutex::new(None)),
        }
    }

    /// Stop any active camera streaming process.
    pub fn stop(&self) {
        let mut child_guard = self.child_process.lock().unwrap();
        if let Some(mut child) = child_guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        let mut dev_guard = self.active_device.lock().unwrap();
        *dev_guard = None;
    }
}

/// List video capture devices on Linux using sysfs (`/sys/class/video4linux`).
pub fn list_video_devices() -> Vec<CameraDeviceInfo> {
    let mut devices = Vec::new();
    let sys_path = Path::new("/sys/class/video4linux");

    if let Ok(entries) = fs::read_dir(sys_path) {
        for entry in entries.flatten() {
            let dev_name = entry.file_name().to_string_lossy().to_string(); // e.g. "video2"
            if !dev_name.starts_with("video") {
                continue;
            }

            let path = entry.path();

            // Only consider primary video capture nodes (index == 0)
            let index_file = path.join("index");
            let index_str = fs::read_to_string(&index_file).unwrap_or_default();
            if index_str.trim() != "0" {
                continue;
            }

            let name_file = path.join("name");
            let name = fs::read_to_string(&name_file)
                .unwrap_or_else(|_| dev_name.clone())
                .trim()
                .to_string();

            let device_path = format!("/dev/{}", dev_name);
            let name_lower = name.to_lowercase();

            let internal_keywords = [
                "integrated",
                "internal",
                "facetime",
                "built-in",
                "front camera",
                "hd camera",
            ];
            let is_internal = internal_keywords.iter().any(|kw| name_lower.contains(kw));

            // External USB camera: index == 0 and not internal
            let is_usb = !is_internal;

            devices.push(CameraDeviceInfo {
                id: device_path,
                name: if is_usb {
                    format!("{} (USB Camera)", name)
                } else {
                    name
                },
                is_usb,
            });
        }
    }

    devices.sort_by(|a, b| a.id.cmp(&b.id));
    devices
}

/// Start streaming JPEG frames from `/dev/videoN` and optionally record crash-resilient MP4 video.
pub fn start_stream(
    app: AppHandle,
    state: &CameraState,
    device: String,
    session_dir: Option<PathBuf>,
) -> Result<(), String> {
    state.stop();

    let mut args = vec![
        "-y".to_string(),
        "-f".to_string(),
        "v4l2".to_string(),
        "-i".to_string(),
        device.clone(),
    ];

    // If a session directory is provided, output crash-resilient MP4 video to session_dir/payload_camera.mp4
    // Using pix_fmt yuv420p for HTML5 video & webview compatibility
    if let Some(ref dir) = session_dir {
        let mp4_path = dir.join("payload_camera.mp4").to_string_lossy().to_string();
        args.extend(vec![
            "-vf".to_string(),
            "format=yuv420p,scale=640:480".to_string(),
            "-c:v".to_string(),
            "libx264".to_string(),
            "-preset".to_string(),
            "ultrafast".to_string(),
            "-tune".to_string(),
            "zerolatency".to_string(),
            "-movflags".to_string(),
            "frag_keyframe+empty_moov+default_base_moof".to_string(),
            mp4_path,
        ]);
    }

    // Output live MJPEG stream to stdout pipe for frontend display
    args.extend(vec![
        "-vf".to_string(),
        "scale=640:480".to_string(),
        "-r".to_string(),
        "15".to_string(),
        "-f".to_string(),
        "image2pipe".to_string(),
        "-vcodec".to_string(),
        "mjpeg".to_string(),
        "-".to_string(),
    ]);

    let mut child = Command::new("ffmpeg")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg for device {}: {}", device, e))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture ffmpeg stdout".to_string())?;

    {
        let mut child_guard = state.child_process.lock().unwrap();
        *child_guard = Some(child);
        let mut dev_guard = state.active_device.lock().unwrap();
        *dev_guard = Some(device.clone());
    }

    let child_arc = state.child_process.clone();
    let active_dev_arc = state.active_device.clone();
    let stream_dev = device.clone();
    let app_handle = app.clone();

    thread::spawn(move || {
        let mut reader = std::io::BufReader::with_capacity(64 * 1024, stdout);
        let mut buffer = Vec::with_capacity(100 * 1024);
        let mut byte = [0u8; 1];

        while reader.read_exact(&mut byte).is_ok() {
            // Check if stream process is still the active device
            {
                let dev_guard = active_dev_arc.lock().unwrap();
                if dev_guard.as_ref() != Some(&stream_dev) {
                    break;
                }
            }

            buffer.push(byte[0]);
            let len = buffer.len();

            // Look for JPEG End-of-Image (EOI) marker: 0xFF 0xD9
            if len >= 2 && buffer[len - 2] == 0xFF && buffer[len - 1] == 0xD9 {
                let base64_str = base64::engine::general_purpose::STANDARD.encode(&buffer);
                let data_url = format!("data:image/jpeg;base64,{}", base64_str);

                let _ = app_handle.emit("camera_frame", data_url);
                buffer.clear();
            }

            // Prevent runaway memory allocation if stream sync breaks
            if len > 500 * 1024 {
                buffer.clear();
            }
        }

        // Cleanup process on thread exit and notify frontend of disconnection
        let mut child_guard = child_arc.lock().unwrap();
        if let Some(mut child) = child_guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        let mut dev_guard = active_dev_arc.lock().unwrap();
        if dev_guard.as_ref() == Some(&stream_dev) {
            *dev_guard = None;
            let _ = app_handle.emit("camera_disconnected", ());
        }
    });

    Ok(())
}
