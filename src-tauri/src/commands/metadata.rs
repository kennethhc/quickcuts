use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{command, AppHandle};
use tokio::task::JoinSet;

use super::sidecar::{get_ffmpeg_path, get_ffprobe_path};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MediaMetadata {
    pub path: String,
    pub name: String,
    pub media_type: String, // "video" or "image"
    pub duration: f64,      // seconds
    pub width: u32,
    pub height: u32,
    pub timestamp: i64,     // file creation timestamp in milliseconds
    pub thumbnail: Option<String>, // base64 thumbnail - lazy loaded
    pub framerate: Option<f64>,    // frames per second
    pub bitrate: Option<u64>,      // bits per second
}

#[derive(Debug, Serialize, Deserialize)]
struct FFProbeFormat {
    duration: Option<String>,
    bit_rate: Option<String>,
    tags: Option<FFProbeTags>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FFProbeTags {
    creation_time: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FFProbeStream {
    width: Option<u32>,
    height: Option<u32>,
    codec_type: Option<String>,
    r_frame_rate: Option<String>,  // e.g., "30000/1001" for 29.97fps
    bit_rate: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FFProbeOutput {
    format: Option<FFProbeFormat>,
    streams: Option<Vec<FFProbeStream>>,
}

fn get_media_type(path: &str) -> &str {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "mp4" | "mov" | "avi" | "mkv" | "webm" => "video",
        "jpg" | "jpeg" | "png" | "webp" | "gif" => "image",
        _ => "unknown",
    }
}

fn get_file_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string()
}

fn get_file_timestamp(path: &str) -> i64 {
    std::fs::metadata(path)
        .ok()
        .and_then(|m| m.created().ok())
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0)
        })
        .unwrap_or(0)
}

/// Generate thumbnail - called lazily via separate command
fn generate_thumbnail_sync(path: &str, media_type: &str, ffmpeg_path: &PathBuf) -> Option<String> {
    if media_type == "image" {
        if let Ok(img) = image::open(path) {
            let thumbnail = img.thumbnail(200, 200);
            let mut buf = Vec::new();
            if thumbnail
                .write_to(
                    &mut std::io::Cursor::new(&mut buf),
                    image::ImageFormat::Jpeg,
                )
                .is_ok()
            {
                return Some(format!("data:image/jpeg;base64,{}", base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &buf)));
            }
        }
    } else if media_type == "video" {
        let temp_path = std::env::temp_dir().join(format!("thumb_{}.jpg", uuid::Uuid::new_v4()));

        let output = Command::new(ffmpeg_path)
            .args([
                "-i", path,
                "-ss", "00:00:01",
                "-vframes", "1",
                "-vf", "scale=200:-1",
                "-y",
                temp_path.to_str().unwrap_or(""),
            ])
            .output();

        if output.is_ok() {
            if let Ok(data) = std::fs::read(&temp_path) {
                let _ = std::fs::remove_file(&temp_path);
                return Some(format!("data:image/jpeg;base64,{}", base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &data)));
            }
        }
    }
    None
}

/// Extract metadata only (no thumbnail) - fast
fn get_metadata_fast(path: String, ffprobe_path: &PathBuf) -> Result<MediaMetadata, String> {
    let media_type = get_media_type(&path).to_string();

    if media_type == "unknown" {
        return Err("Unsupported media type".to_string());
    }

    let name = get_file_name(&path);
    let timestamp = get_file_timestamp(&path);

    // Get dimensions and duration using ffprobe
    let output = Command::new(ffprobe_path)
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            &path,
        ])
        .output()
        .map_err(|e| format!("Failed to run ffprobe: {}", e))?;

    let probe_output: FFProbeOutput = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse ffprobe output: {}", e))?;

    // Find the video stream
    let video_stream = probe_output
        .streams
        .as_ref()
        .and_then(|streams| {
            streams.iter().find(|s| {
                s.codec_type.as_ref().map_or(false, |t| t == "video")
            })
        });

    // Extract dimensions
    let (width, height) = video_stream
        .map(|s| (s.width.unwrap_or(0), s.height.unwrap_or(0)))
        .unwrap_or((0, 0));

    // Extract framerate
    let framerate = video_stream
        .and_then(|s| s.r_frame_rate.as_ref())
        .and_then(|fps| {
            let parts: Vec<&str> = fps.split('/').collect();
            if parts.len() == 2 {
                let num = parts[0].parse::<f64>().ok()?;
                let den = parts[1].parse::<f64>().ok()?;
                if den > 0.0 { Some(num / den) } else { None }
            } else {
                fps.parse::<f64>().ok()
            }
        });

    // Extract bitrate
    let bitrate = video_stream
        .and_then(|s| s.bit_rate.as_ref())
        .and_then(|br| br.parse::<u64>().ok())
        .or_else(|| {
            probe_output
                .format
                .as_ref()
                .and_then(|f| f.bit_rate.as_ref())
                .and_then(|br| br.parse::<u64>().ok())
        });

    // Extract duration
    let duration = if media_type == "image" {
        4.0
    } else {
        probe_output
            .format
            .as_ref()
            .and_then(|f| f.duration.as_ref())
            .and_then(|d| d.parse::<f64>().ok())
            .unwrap_or(0.0)
    };

    Ok(MediaMetadata {
        path,
        name,
        media_type,
        duration,
        width,
        height,
        timestamp,
        thumbnail: None, // Lazy loaded later
        framerate,
        bitrate,
    })
}

#[command]
pub async fn get_media_metadata(app: AppHandle, path: String) -> Result<MediaMetadata, String> {
    let ffmpeg_path = get_ffmpeg_path(&app)?;
    let ffprobe_path = get_ffprobe_path(&app)?;

    // Run in blocking thread to not block async runtime
    tokio::task::spawn_blocking(move || {
        let mut metadata = get_metadata_fast(path.clone(), &ffprobe_path)?;
        // Generate thumbnail synchronously for single file
        metadata.thumbnail = generate_thumbnail_sync(&path, &metadata.media_type, &ffmpeg_path);
        Ok(metadata)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

/// Parallel batch metadata extraction (#2 optimization)
#[command]
pub async fn get_media_metadata_batch(app: AppHandle, paths: Vec<String>) -> Result<Vec<MediaMetadata>, String> {
    let ffprobe_path = get_ffprobe_path(&app)?;

    // Use JoinSet for parallel execution
    let mut join_set: JoinSet<Result<MediaMetadata, String>> = JoinSet::new();

    // Spawn all metadata extraction tasks in parallel
    for path in paths {
        let ffprobe = ffprobe_path.clone();
        join_set.spawn(async move {
            tokio::task::spawn_blocking(move || get_metadata_fast(path, &ffprobe))
                .await
                .map_err(|e| format!("Task failed: {}", e))?
        });
    }

    // Collect results as they complete
    let mut results = Vec::new();
    while let Some(result) = join_set.join_next().await {
        match result {
            Ok(Ok(metadata)) => results.push(metadata),
            Ok(Err(e)) => log::warn!("Failed to get metadata: {}", e),
            Err(e) => log::warn!("Task panicked: {}", e),
        }
    }

    // Sort by timestamp to maintain order
    results.sort_by_key(|m| m.timestamp);

    Ok(results)
}

/// Lazy thumbnail generation - called separately after metadata (#4 optimization)
#[command]
pub async fn generate_thumbnail(app: AppHandle, path: String, media_type: String) -> Result<Option<String>, String> {
    let ffmpeg_path = get_ffmpeg_path(&app)?;

    tokio::task::spawn_blocking(move || {
        Ok(generate_thumbnail_sync(&path, &media_type, &ffmpeg_path))
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

/// Batch thumbnail generation - parallel
#[command]
pub async fn generate_thumbnails_batch(app: AppHandle, items: Vec<(String, String)>) -> Result<Vec<(String, Option<String>)>, String> {
    let ffmpeg_path = get_ffmpeg_path(&app)?;

    let mut join_set: JoinSet<(String, Option<String>)> = JoinSet::new();

    for (path, media_type) in items {
        let path_clone = path.clone();
        let ffmpeg = ffmpeg_path.clone();
        join_set.spawn(async move {
            let thumbnail = tokio::task::spawn_blocking(move || {
                generate_thumbnail_sync(&path, &media_type, &ffmpeg)
            })
            .await
            .ok()
            .flatten();
            (path_clone, thumbnail)
        });
    }

    let mut results = Vec::new();
    while let Some(result) = join_set.join_next().await {
        if let Ok(item) = result {
            results.push(item);
        }
    }

    Ok(results)
}
