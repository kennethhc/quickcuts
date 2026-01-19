use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;
use std::process::Stdio;
use tauri::{command, AppHandle, Emitter};

use super::sidecar::{get_ffmpeg_path, get_ffprobe_path};

fn debug_log(msg: &str) {
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open("/tmp/snappy-ffmpeg-debug.log")
    {
        let _ = writeln!(file, "{}", msg);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportConfig {
    pub preset_id: String,
    pub width: u32,
    pub height: u32,
    pub codec: String,
    pub framerate: Option<f64>,
    pub bitrate: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaItem {
    pub path: String,
    pub media_type: String,
    pub duration: f64,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub framerate: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverConfig {
    pub enabled: bool,
    pub text: String,
    pub duration: f64,
    pub color_scheme: Option<String>, // "blackOnWhite" or "whiteOnBlack"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportProgress {
    pub stage: String,
    pub progress: f64,
    pub current_file: Option<String>,
    pub error: Option<String>,
}

fn emit_progress(app: &AppHandle, progress: ExportProgress) {
    let _ = app.emit("export-progress", progress);
}

/// Check if VideoToolbox hardware encoder is available
fn is_videotoolbox_available(app: &AppHandle) -> bool {
    let ffmpeg_path = match get_ffmpeg_path(app) {
        Ok(p) => p,
        Err(_) => return false,
    };

    let output = std::process::Command::new(&ffmpeg_path)
        .args(["-hide_banner", "-encoders"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout.contains("h264_videotoolbox")
        }
        Err(_) => false,
    }
}

/// Check if a video segment can be stream-copied
fn can_stream_copy(item: &MediaItem, target_width: u32, target_height: u32, target_fps: f64) -> bool {
    if item.media_type != "video" {
        return false;
    }

    let width_matches = item.width.map_or(false, |w| w == target_width);
    let height_matches = item.height.map_or(false, |h| h == target_height);
    let fps_matches = item.framerate.map_or(false, |f| (f - target_fps).abs() < 0.5);

    width_matches && height_matches && fps_matches
}

/// Check if all media items can use fast concat (stream copy)
/// Returns true if: all items are videos, no cover, and all have same resolution/fps
fn can_fast_concat(media_items: &[MediaItem], cover: &CoverConfig) -> bool {
    // Need cover disabled
    if cover.enabled && !cover.text.is_empty() {
        return false;
    }

    // Need at least 2 videos
    if media_items.len() < 2 {
        return false;
    }

    // All items must be videos (no images)
    if media_items.iter().any(|m| m.media_type != "video") {
        return false;
    }

    // Get reference dimensions from first video
    let first = &media_items[0];
    let ref_width = first.width;
    let ref_height = first.height;
    let ref_fps = first.framerate;

    // All videos must have same dimensions and framerate
    media_items.iter().all(|m| {
        m.width == ref_width && m.height == ref_height &&
        m.framerate.map_or(false, |f| ref_fps.map_or(false, |rf| (f - rf).abs() < 0.5))
    })
}

/// Fast concat using stream copy (no re-encoding) - like iOS Shortcuts
fn export_fast_concat(
    app: &AppHandle,
    media_items: &[MediaItem],
    output_path: &str,
) -> Result<String, String> {
    use std::fs::File;
    use std::io::Write as IoWrite;

    debug_log("=== FAST CONCAT MODE (stream copy) ===");

    emit_progress(app, ExportProgress {
        stage: "processing".to_string(),
        progress: 10.0,
        current_file: Some("Fast concat (no re-encoding)...".to_string()),
        error: None,
    });

    // Create temp file list for concat demuxer
    let temp_dir = std::env::temp_dir();
    let list_path = temp_dir.join("snappy_concat_list.txt");

    {
        let mut file = File::create(&list_path)
            .map_err(|e| format!("Failed to create concat list: {}", e))?;

        for item in media_items {
            // Escape single quotes in path
            let escaped_path = item.path.replace("'", "'\\''");
            writeln!(file, "file '{}'", escaped_path)
                .map_err(|e| format!("Failed to write concat list: {}", e))?;
        }
    }

    debug_log(&format!("Concat list: {:?}", list_path));

    // Determine output extension from first input
    let input_ext = Path::new(&media_items[0].path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("mp4");

    let final_output = if output_path.ends_with(".mp4") && input_ext.to_lowercase() == "mov" {
        output_path.replace(".mp4", ".mov")
    } else {
        output_path.to_string()
    };

    // FFmpeg concat with stream copy - super fast!
    let args = vec![
        "-hide_banner".to_string(),
        "-v".to_string(), "error".to_string(),
        "-stats".to_string(),
        "-f".to_string(), "concat".to_string(),
        "-safe".to_string(), "0".to_string(),
        "-i".to_string(), list_path.to_string_lossy().to_string(),
        "-c".to_string(), "copy".to_string(),
        "-y".to_string(), final_output.clone(),
    ];

    run_ffmpeg(app, args, "Fast concat")?;

    // Clean up temp file
    let _ = std::fs::remove_file(&list_path);

    emit_progress(app, ExportProgress {
        stage: "complete".to_string(),
        progress: 100.0,
        current_file: None,
        error: None,
    });

    Ok(final_output)
}

/// Run FFmpeg (synchronous for reliability)
fn run_ffmpeg(
    app: &AppHandle,
    args: Vec<String>,
    stage_msg: &str,
) -> Result<(), String> {
    emit_progress(app, ExportProgress {
        stage: "processing".to_string(),
        progress: 50.0,
        current_file: Some(format!("{}...", stage_msg)),
        error: None,
    });

    let ffmpeg_path = get_ffmpeg_path(app)?;

    // Log the full command for debugging
    debug_log(&format!("=== FFmpeg command ===\n{} {}\n", ffmpeg_path.display(), args.join(" ")));

    let output = std::process::Command::new(&ffmpeg_path)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to start ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        debug_log(&format!("=== FFmpeg FAILED ===\nstderr:\n{}\n", stderr));

        // Find the actual error line (usually contains "Error" or is near the end)
        let error_msg = stderr.lines()
            .filter(|line| !line.trim().is_empty())
            .filter(|line| line.contains("Error") || line.contains("error") || line.contains("Invalid") || line.contains("No such"))
            .last()
            .or_else(|| stderr.lines().filter(|line| !line.trim().is_empty()).last())
            .unwrap_or("Unknown FFmpeg error");

        debug_log(&format!("Extracted error: {}", error_msg));
        return Err(format!("{}", error_msg));
    }

    debug_log("=== FFmpeg SUCCESS ===");

    Ok(())
}

/// Build complex filter graph for single-pass encoding
fn build_filter_graph(
    media_items: &[MediaItem],
    cover: &CoverConfig,
    width: u32,
    height: u32,
    framerate: f64,
) -> (Vec<String>, String) {
    let mut inputs: Vec<String> = Vec::new();
    let mut filter_parts: Vec<String> = Vec::new();
    let mut concat_inputs: Vec<String> = Vec::new();
    let mut stream_idx = 0;

    if cover.enabled && !cover.text.is_empty() {
        // Determine colors based on scheme
        let is_black_on_white = cover.color_scheme.as_deref() != Some("whiteOnBlack");
        let bg_color = if is_black_on_white { "white" } else { "black" };
        let font_color = if is_black_on_white { "black" } else { "white" };

        // Generate cover background
        inputs.extend(["-f".to_string(), "lavfi".to_string(), "-i".to_string()]);
        inputs.push(format!(
            "color={}:s={}x{}:d={}:r={}",
            bg_color, width, height, cover.duration, framerate
        ));

        inputs.extend(["-f".to_string(), "lavfi".to_string(), "-i".to_string()]);
        inputs.push(format!("anullsrc=r=48000:cl=stereo:d={}", cover.duration));

        // Responsive font size based on text length and line count
        let line_count = cover.text.lines().count().max(1);
        let base_size = height as f64 / 12.0;
        let text_len = cover.text.len() as f64;
        let size_factor = if text_len > 50.0 { 0.6 } else if text_len > 30.0 { 0.75 } else { 1.0 };
        // Reduce font size for multiline text
        let line_factor = if line_count > 3 { 0.7 } else if line_count > 1 { 0.85 } else { 1.0 };
        let font_size = (base_size * size_factor * line_factor).round() as u32;

        // Escape special characters for FFmpeg drawtext filter
        // Note: newlines are handled by replacing with actual newline escape sequence
        let escaped_text = cover.text
            .replace('\\', "\\\\")
            .replace('\'', "'\\''")
            .replace(':', "\\:")
            .replace('[', "\\[")
            .replace(']', "\\]")
            .replace('\n', "\\n")  // FFmpeg drawtext newline escape
            .replace('\r', "");     // Remove carriage returns

        // Apply drawtext with line_spacing for multiline support
        // Using line_spacing to add some space between lines
        filter_parts.push(format!(
            "[{}:v]drawtext=text='{}':fontsize={}:fontcolor={}:x=(w-text_w)/2:y=(h-text_h)/2:font=OpenSans-Bold:line_spacing=8,format=yuv420p,setsar=1[cv{}]",
            stream_idx, escaped_text, font_size, font_color, stream_idx
        ));
        filter_parts.push(format!("[{}:a]aformat=sample_rates=48000:channel_layouts=stereo[ca{}]", stream_idx + 1, stream_idx));

        concat_inputs.push(format!("[cv{}][ca{}]", stream_idx, stream_idx));
        stream_idx += 2;
    }

    for (i, item) in media_items.iter().enumerate() {
        if item.media_type == "image" {
            inputs.extend(["-loop".to_string(), "1".to_string(), "-t".to_string(), item.duration.to_string()]);
            inputs.extend(["-i".to_string(), item.path.clone()]);

            inputs.extend(["-f".to_string(), "lavfi".to_string(), "-i".to_string()]);
            inputs.push(format!("anullsrc=r=48000:cl=stereo:d={}", item.duration));

            filter_parts.push(format!(
                "[{}:v]scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps={},format=yuv420p[v{}]",
                stream_idx, width, height, width, height, framerate, i
            ));
            filter_parts.push(format!("[{}:a]aformat=sample_rates=48000:channel_layouts=stereo[a{}]", stream_idx + 1, i));

            concat_inputs.push(format!("[v{}][a{}]", i, i));
            stream_idx += 2;
        } else {
            inputs.extend(["-i".to_string(), item.path.clone()]);

            let needs_processing = item.width.map_or(true, |w| w != width)
                || item.height.map_or(true, |h| h != height)
                || item.framerate.map_or(true, |f| (f - framerate).abs() > 0.5);

            if needs_processing {
                filter_parts.push(format!(
                    "[{}:v]scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps={},format=yuv420p[v{}]",
                    stream_idx, width, height, width, height, framerate, i
                ));
            } else {
                // Even for copy, ensure consistent format
                filter_parts.push(format!("[{}:v]format=yuv420p,setsar=1[v{}]", stream_idx, i));
            }

            filter_parts.push(format!(
                "[{}:a]aformat=sample_rates=48000:channel_layouts=stereo[a{}]",
                stream_idx, i
            ));

            concat_inputs.push(format!("[v{}][a{}]", i, i));
            stream_idx += 1;
        }
    }

    let n_segments = concat_inputs.len();
    let concat_filter = format!(
        "{}concat=n={}:v=1:a=1[outv][outa]",
        concat_inputs.join(""),
        n_segments
    );
    filter_parts.push(concat_filter);

    let filter_complex = filter_parts.join(";");
    (inputs, filter_complex)
}

/// Calculate total duration from media items and cover
fn calculate_total_duration(media_items: &[MediaItem], cover: &CoverConfig) -> f64 {
    let cover_dur = if cover.enabled && !cover.text.is_empty() { cover.duration } else { 0.0 };
    let media_dur: f64 = media_items.iter().map(|m| m.duration).sum();
    cover_dur + media_dur
}

/// Single-pass export with real-time progress
#[command]
pub async fn export_video(
    app: AppHandle,
    media_items: Vec<MediaItem>,
    cover: CoverConfig,
    config: ExportConfig,
    output_path: String,
) -> Result<String, String> {
    emit_progress(&app, ExportProgress {
        stage: "preparing".to_string(),
        progress: 0.0,
        current_file: Some("Checking hardware acceleration...".to_string()),
        error: None,
    });

    let framerate = config.framerate.unwrap_or(30.0);
    let total_duration = calculate_total_duration(&media_items, &cover);

    // Check for hardware acceleration
    let use_hw = config.codec != "prores" && is_videotoolbox_available(&app);
    let hw_status = if use_hw { "HW accelerated" } else { "Software" };
    log::info!("Using {} encoding, total duration: {:.1}s", hw_status, total_duration);

    // Fast concat mode - no re-encoding, like iOS Shortcuts (instant!)
    if can_fast_concat(&media_items, &cover) {
        debug_log("Using FAST CONCAT mode - stream copy, no re-encoding");
        return export_fast_concat(&app, &media_items, &output_path);
    }

    // Single video without cover - check if we can stream copy
    if media_items.len() == 1 && !cover.enabled {
        let item = &media_items[0];
        if can_stream_copy(item, config.width, config.height, framerate) {
            return export_stream_copy(&app, item, &output_path).await;
        }
        return export_single_video(&app, item, &config, &output_path, framerate, use_hw).await;
    }

    debug_log("Using full re-encode mode (cover or mixed formats)");

    emit_progress(&app, ExportProgress {
        stage: "processing".to_string(),
        progress: 10.0,
        current_file: Some("Building filter graph...".to_string()),
        error: None,
    });

    let (inputs, filter_complex) = build_filter_graph(
        &media_items,
        &cover,
        config.width,
        config.height,
        framerate,
    );

    emit_progress(&app, ExportProgress {
        stage: "processing".to_string(),
        progress: 15.0,
        current_file: Some(format!("Starting {} encode...", hw_status)),
        error: None,
    });

    // Build ffmpeg command
    // Note: -hwaccel should only be used with file inputs, not lavfi, so we skip it for complex filters
    let mut args = vec![
        "-hide_banner".to_string(),
        "-threads".to_string(), "0".to_string(),
    ];

    args.extend(inputs);
    args.extend([
        "-filter_complex".to_string(),
        filter_complex,
        "-map".to_string(),
        "[outv]".to_string(),
        "-map".to_string(),
        "[outa]".to_string(),
    ]);

    // Add encoding settings
    if config.codec == "prores" {
        args.extend([
            "-c:v".to_string(), "prores_ks".to_string(),
            "-profile:v".to_string(), "3".to_string(),
            "-c:a".to_string(), "pcm_s16le".to_string(),
        ]);
    } else if use_hw {
        // VideoToolbox hardware encoding - optimized for speed
        // Note: VideoToolbox doesn't support -q:v (qscale), must use -b:v (bitrate)
        let bitrate = config.bitrate.unwrap_or(10_000_000); // Default 10 Mbps
        args.extend([
            "-c:v".to_string(), "h264_videotoolbox".to_string(),
            "-b:v".to_string(), format!("{}", bitrate),
            "-realtime".to_string(), "1".to_string(),   // Realtime encoding priority
            "-pix_fmt".to_string(), "yuv420p".to_string(),
            "-c:a".to_string(), "aac".to_string(),
            "-b:a".to_string(), "192k".to_string(),
        ]);
    } else {
        // Software encoding - ultrafast
        args.extend([
            "-c:v".to_string(), "libx264".to_string(),
            "-preset".to_string(), "ultrafast".to_string(),
            "-tune".to_string(), "fastdecode".to_string(),
            "-crf".to_string(), "23".to_string(),
            "-pix_fmt".to_string(), "yuv420p".to_string(),
            "-c:a".to_string(), "aac".to_string(),
            "-b:a".to_string(), "192k".to_string(),
        ]);
        if let Some(br) = config.bitrate {
            args.extend(["-b:v".to_string(), format!("{}", br)]);
        }
    }

    let final_output = if config.codec == "prores" {
        output_path.replace(".mp4", ".mov")
    } else {
        output_path.clone()
    };

    args.extend(["-y".to_string(), final_output.clone()]);

    // Log the command for debugging
    log::info!("FFmpeg command: ffmpeg {}", args.join(" "));

    // Run FFmpeg
    let stage_msg = format!("{} encoding", hw_status);
    run_ffmpeg(&app, args, &stage_msg)?;

    emit_progress(&app, ExportProgress {
        stage: "finalizing".to_string(),
        progress: 95.0,
        current_file: Some("Verifying output...".to_string()),
        error: None,
    });

    if !Path::new(&final_output).exists() {
        return Err("Output file was not created".to_string());
    }

    emit_progress(&app, ExportProgress {
        stage: "complete".to_string(),
        progress: 100.0,
        current_file: None,
        error: None,
    });

    Ok(final_output)
}

/// Stream copy for videos that already match target format
async fn export_stream_copy(
    app: &AppHandle,
    item: &MediaItem,
    output_path: &str,
) -> Result<String, String> {
    let args = vec![
        "-hide_banner".to_string(),
        "-i".to_string(), item.path.clone(),
        "-c".to_string(), "copy".to_string(),
        "-y".to_string(), output_path.to_string(),
    ];

    run_ffmpeg(app, args, "Stream copy (fast)")?;

    emit_progress(app, ExportProgress {
        stage: "complete".to_string(),
        progress: 100.0,
        current_file: None,
        error: None,
    });

    Ok(output_path.to_string())
}

/// Export single video with hardware acceleration
async fn export_single_video(
    app: &AppHandle,
    item: &MediaItem,
    config: &ExportConfig,
    output_path: &str,
    framerate: f64,
    use_hw: bool,
) -> Result<String, String> {
    let hw_status = if use_hw { "HW accelerated" } else { "Software" };

    let filter = format!(
        "scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps={}",
        config.width, config.height, config.width, config.height, framerate
    );

    let mut args = vec![
        "-hide_banner".to_string(),
        "-threads".to_string(), "0".to_string(),
    ];

    // Hardware decoding for single file
    if use_hw {
        args.extend(["-hwaccel".to_string(), "videotoolbox".to_string()]);
    }

    args.extend([
        "-i".to_string(), item.path.clone(),
        "-vf".to_string(), filter,
    ]);

    if use_hw {
        // VideoToolbox doesn't support -q:v, must use -b:v
        let bitrate = config.bitrate.unwrap_or(10_000_000); // Default 10 Mbps
        args.extend([
            "-c:v".to_string(), "h264_videotoolbox".to_string(),
            "-b:v".to_string(), format!("{}", bitrate),
            "-pix_fmt".to_string(), "yuv420p".to_string(),
        ]);
    } else {
        args.extend([
            "-c:v".to_string(), "libx264".to_string(),
            "-preset".to_string(), "ultrafast".to_string(),
            "-crf".to_string(), "23".to_string(),
            "-pix_fmt".to_string(), "yuv420p".to_string(),
        ]);
        if let Some(br) = config.bitrate {
            args.extend(["-b:v".to_string(), format!("{}", br)]);
        }
    }

    args.extend([
        "-c:a".to_string(), "aac".to_string(),
        "-ar".to_string(), "48000".to_string(),
        "-ac".to_string(), "2".to_string(),
    ]);

    args.extend(["-y".to_string(), output_path.to_string()]);

    let stage_msg = format!("{} encoding", hw_status);
    run_ffmpeg(app, args, &stage_msg)?;

    emit_progress(app, ExportProgress {
        stage: "complete".to_string(),
        progress: 100.0,
        current_file: None,
        error: None,
    });

    Ok(output_path.to_string())
}

/// Get the duration of a video file
#[command]
pub async fn get_video_duration(app: AppHandle, path: String) -> Result<f64, String> {
    let ffprobe_path = get_ffprobe_path(&app)?;

    let output = std::process::Command::new(&ffprobe_path)
        .args([
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            &path,
        ])
        .output()
        .map_err(|e| format!("Failed to get video duration: {}", e))?;

    let duration_str = String::from_utf8_lossy(&output.stdout);
    duration_str
        .trim()
        .parse::<f64>()
        .map_err(|e| format!("Failed to parse duration: {}", e))
}
